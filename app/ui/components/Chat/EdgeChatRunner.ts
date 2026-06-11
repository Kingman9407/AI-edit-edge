import type { ModelAction } from "@/app/backend/api/chat/types";
import type { EdgeLLMState } from "@/app/ui/hooks/useEdgeLLM";

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
}

interface ChatMLMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function formatHistoryUserTurn(content: string): string {
  if (content.includes("[USER REQUEST]")) return content;
  return [
    "[VIDEO METADATA]",
    "Duration: 0.0s",
    "",
    "[TIMELINE STATE]",
    "Cuts:",
    "- None",
    "",
    "Muted Sections:",
    "- None",
    "",
    "Subtitles:",
    "- None",
    "",
    "Background Music:",
    "- None",
    "",
    "[USER REQUEST]",
    content
  ].join("\n");
}

/**
 * Build a structured messages array for SmolLM2-Instruct matching the SFT training structure.
 */
function buildMessages(req: EdgeChatRequest): ChatMLMessage[] {
  const messages: ChatMLMessage[] = [];

  // 1. System instruction turn
  messages.push({
    role: "system",
    content:
      "You are Hornet, a natural language processing (NLP) assistant. " +
      "You analyze the user's video editing requests and return a structured JSON object " +
      "containing two fields: 'message' (a natural response) and 'operations' (a list of video edit actions " +
      "like 'cut', 'mute', 'add_audio_overlay' with start and end timestamps in seconds). " +
      "Output ONLY a raw JSON object. Do NOT use markdown formatting, backticks, or extra text outside the JSON."
  });

  // 2. History turns (exclude the active user request if it is at the end of the history array)
  if (req.history?.length) {
    let historyTurns = req.history;
    const lastTurn = historyTurns[historyTurns.length - 1];
    if (lastTurn && lastTurn.role === "user" && lastTurn.content === req.message) {
      historyTurns = historyTurns.slice(0, -1);
    }

    for (const turn of historyTurns.slice(-6)) {
      messages.push({
        role: turn.role,
        content: turn.role === "user" ? formatHistoryUserTurn(turn.content) : turn.content
      });
    }
  }

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

  const messages = buildMessages(req);
  const raw = await edgeLLM.generate(messages as any);

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
        const startVal = op.start !== undefined && op.start !== null ? Number(op.start) : null;
        const endVal = op.end !== undefined && op.end !== null ? Number(op.end) : null;

        return {
          type: op.operation,
          start: startVal,
          end: endVal,
          reason: op.reason || "Edge LLM Edit"
        };
      });
    }
  } catch (err) {
    console.error("🤖 [Edge LLM] Failed to parse JSON:", raw);
    assistantMessage = raw.replace(/<\|im_end\|>[\s\S]*$/, "").trim();
  }

  console.log("🤖 [Edge LLM] Final Actions sent to UI:\n", actions);

  return {
    assistantMessage,
    parsed: {
      assistant_message: assistantMessage,
      status: "ok",
      actions,
    },
    usage: null,
    raw,
  };
}
