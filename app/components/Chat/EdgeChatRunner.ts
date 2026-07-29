import { parseToolCallToAction } from "@/app/backend/api/chat/tools";
import type { ModelAction } from "@/app/backend/api/chat/types";
import type { EdgeLLMState } from "@/app/hooks/useEdgeLLM";
import { supabase } from "@/app/lib/supabase";
export interface EdgeChatRequest {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  videoContext?: {
    name?: string;
    duration?: number;
    width?: number;
    height?: number;
    currentTime?: number;
  } | null;
  existingCuts?: { start: number; end: number }[];
  mutedSegments?: { start: number; end: number }[];
  audioOverlays?: { start: number; end: number; track?: string }[];
  recentEdits?: string[];
  lastAction?: string;
}

export interface EdgeChatResponse {
  assistantMessage: string;
  parsed: {
    assistant_message: string;
    status: "ok" | "error";
    actions: ModelAction[];
  };
  usage: null;
  raw: string;
  tps?: number;
}

interface ChatMLMessage {
  role: "system" | "user" | "assistant";
  content: string;
}


/**
 * Build a structured messages array for SmolLM2-Instruct matching the SFT training structure.
 */
function buildMessages(req: EdgeChatRequest): ChatMLMessage[] {
  const messages: ChatMLMessage[] = [];

  // 1. System instruction turn
  // NOTE: This string must match SYSTEM_INSTRUCTION in trainer/prepare_data.py exactly.
  messages.push({
    role: "system",
    content: "You are Hornet, a video editing AI. Return JSON with 'message' and 'operations' (cut, mute, add_audio_overlay). If the user mentions time expressions requiring calculation, output a <tool_call> block first. Otherwise, output the final JSON directly."
  });

  // 3. Current user message turn (context + query matching SFT training format)
  const userLines: string[] = [];

  userLines.push("[VIDEO METADATA]");
  userLines.push(`Name: ${req.videoContext?.name || "untitled_video.mp4"}`);
  const duration = req.videoContext?.duration ?? 0;
  userLines.push(`Duration: ${duration.toFixed(1)}s`);
  if (req.videoContext?.width && req.videoContext?.height) {
    userLines.push(`Resolution: ${req.videoContext.width}x${req.videoContext.height}`);
  } else {
    userLines.push("Resolution: 1920x1080");
  }
  userLines.push(`Playhead: ${req.videoContext?.currentTime?.toFixed(1) || "0.0"}s`);
  userLines.push("");

  userLines.push("[TIMELINE STATE]");
  const formatList = (items?: { start: number; end: number }[]) => {
    if (!items || items.length === 0) return "- None";
    return items.map(i => `- ${i.start.toFixed(1)} -> ${i.end.toFixed(1)}`).join("\n");
  };

  userLines.push("Cuts:");
  userLines.push(formatList(req.existingCuts));
  userLines.push("");
  userLines.push("Muted Sections:");
  userLines.push(formatList(req.mutedSegments));
  userLines.push("");
  userLines.push("Subtitles:");
  userLines.push("- None");
  userLines.push("");
  userLines.push("Background Music:");
  if (req.audioOverlays && req.audioOverlays.length > 0) {
    userLines.push(req.audioOverlays.map(o => `- ${o.start.toFixed(1)} -> ${o.end.toFixed(1)}`).join("\n"));
  } else {
    userLines.push("- None");
  }
  userLines.push("");

  userLines.push("[RECENT EDITS]");
  if (req.recentEdits && req.recentEdits.length > 0) {
    userLines.push(req.recentEdits.map((e, idx) => `${idx + 1}. ${e}`).join("\n"));
  } else {
    userLines.push("None");
  }
  userLines.push("");

  userLines.push("[LAST ACTION]");
  userLines.push(req.lastAction || "None");
  userLines.push("");

  userLines.push("[USER REQUEST]");
  userLines.push(req.message);

  messages.push({
    role: "user",
    content: userLines.join("\n")
  });

  return messages;
}


/**
 * Run inference on the edge model and return a cloud-handler-compatible response.
 */
export async function runEdgeChat(
  req: EdgeChatRequest,
  edgeLLM: EdgeLLMState
): Promise<EdgeChatResponse> {
  if (edgeLLM.status !== "ready") {
    throw new Error("Edge model is not loaded. Please wait for it to initialize.");
  }

  const startTime = Date.now();
  const messages = buildMessages(req);
  const { text: raw, tps } = await edgeLLM.generate(
    messages as any,
    undefined,
    {
      duration: req.videoContext?.duration ?? 0,
      playhead: req.videoContext?.currentTime ?? 0,
    }
  );
  const latencyMs = Date.now() - startTime;

  console.log("🤖 [Edge LLM] RAW Output:\n", raw);

  let assistantMessage = "I'm ready to help with your video editing!";
  let actions: ModelAction[] = [];

  try {
    // The WebWorker guarantees `raw` is just the JSON block
    const parsedObj = JSON.parse(raw);
    console.log("🤖 [Edge LLM] Parsed JSON:\n", parsedObj);

    if (parsedObj.message) {
      assistantMessage = parsedObj.message;
    }

    if (Array.isArray(parsedObj.operations)) {
      actions = parsedObj.operations.map((op: any) => {
        let toolName = op.operation;
        if (toolName === "cut") toolName = "cut_segment";
        if (toolName === "mute") toolName = "mute_segment";
        if (toolName === "keep") toolName = "keep_segment";
        
        const action = parseToolCallToAction(
          toolName,
          op,
          req.videoContext?.duration ?? 0,
          req.videoContext?.currentTime ?? 0
        );

        if (action) return action;

        // Fallback for absolute timestamps if parse fails or it wasn't a known tool
        const startVal = op.start !== undefined && op.start !== null ? Number(op.start) : null;
        const endVal = op.end !== undefined && op.end !== null ? Number(op.end) : null;

        return {
          type: op.operation,
          start: startVal,
          end: endVal,
          reason: op.reason || "Edge LLM Edit"
        };
      }).filter(Boolean) as ModelAction[];
    }
  } catch (err) {
    console.error("🤖 [Edge LLM] Failed to parse JSON:", raw);
    assistantMessage = raw.replace(/<\|im_end\|>[\s\S]*$/, "").trim();
  }

  console.log("🤖 [Edge LLM] Final Actions sent to UI:\n", actions);

  // Log to Supabase for further training
  console.group("🚀 [Edge LLM -> Supabase Logging]");
  if (supabase) {
    try {
      // Estimate token count: raw output word count as a rough proxy
      const tokenEstimate = raw ? raw.split(/\s+/).filter(Boolean).length : 0;
      
      const payload = {
        user_input: req.message,            // the raw user message (short)
        ai_output: raw,                     // full raw model output
        model_name: "hornet-edge-llm",
        latency_ms: latencyMs,
        tokens: tokenEstimate,
      };

      console.log("  Sending payload to 'ai_logs':", payload);
      
      const { data, error: sbError, status, statusText } = await supabase
        .from("ai_logs")
        .insert(payload)
        .select();

      if (sbError) {
        console.error("❌ [Edge LLM] Supabase insert FAILED:", {
          statusCode: status,
          statusText: statusText,
          code: sbError.code,
          message: sbError.message,
          details: sbError.details,
          hint: sbError.hint,
        });

        if (sbError.code === "42501") {
          console.warn("  💡 DIAGNOSTIC: Supabase returned 42501 (Permission Denied / RLS Violation).");
          console.warn("     Solution: Go to Supabase Dashboard -> Table Editor -> 'ai_logs' -> RLS Policies.");
          console.warn("     Add an INSERT policy allowing 'anon' / 'public' role to insert into 'ai_logs'.");
        } else if (sbError.code === "42P01") {
          console.warn("  💡 DIAGNOSTIC: Supabase returned 42P01 (Undefined Table).");
          console.warn("     Solution: Create table 'ai_logs' in your Supabase SQL Editor with columns:");
          console.warn("     id (uuid/int8), created_at (timestamp), user_input (text), ai_output (text), model_name (text), latency_ms (numeric), tokens (numeric)");
        } else if (sbError.code === "PGRST204" || sbError.message?.includes("column")) {
          console.warn("  💡 DIAGNOSTIC: Column mismatch.");
          console.warn("     Make sure 'ai_logs' has user_input, ai_output, model_name, latency_ms, and tokens columns.");
        }
      } else {
        console.log("✅ [Edge LLM] Successfully logged to Supabase 'ai_logs'! Returned record:", data);
      }
    } catch (e) {
      console.error("❌ [Edge LLM] Unexpected exception during Supabase logging:", e);
    }
  } else {
    console.warn("⚠️ [Edge LLM] Supabase client is null — check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  }
  console.groupEnd();

  return {
    assistantMessage,
    parsed: {
      assistant_message: assistantMessage,
      status: "ok",
      actions,
    },
    usage: null,
    raw,
    tps,
  };
}

