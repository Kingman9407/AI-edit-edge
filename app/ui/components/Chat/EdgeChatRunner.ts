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
}

export interface EdgeChatResponse {
  assistantMessage: string;
  parsed: {
    assistant_message: string;
    status: "ok" | "error";
    actions: ModelAction[];
  };
  usage: null;
}

/**
 * Build a minimal chat-style prompt for SmolLM2-Instruct using the
 * ChatML / SmolLM2 instruction template.
 */
function buildPrompt(req: EdgeChatRequest): string {
  const lines: string[] = [];

  lines.push("<|im_start|>system");
  lines.push(
    "You are Hornet, a natural language processing (NLP) assistant. " +
    "You analyze the user's video editing requests and return a structured JSON object " +
    "containing two fields: 'message' (a natural response) and 'operations' (a list of video edit actions " +
    "like 'cut', 'mute', 'add_audio_overlay' with start and end timestamps in seconds). " +
    "Output ONLY a raw JSON object. Do NOT use markdown formatting, backticks, or extra text outside the JSON."
  );
  
  if (req.videoContext?.name) {
    lines.push(`\n[VIDEO METADATA]`);
    lines.push(`Name: ${req.videoContext.name}`);
    if (req.videoContext.duration) {
      lines.push(`Duration: ${req.videoContext.duration.toFixed(1)}s`);
    }
    if (req.videoContext.width && req.videoContext.height) {
      lines.push(`Resolution: ${req.videoContext.width}x${req.videoContext.height}`);
    }
    lines.push(`Playhead: ${req.videoContext.currentTime?.toFixed(1) || 0}s\n`);
  }
  lines.push("<|im_end|>");

  // Append history
  if (req.history?.length) {
    for (const turn of req.history.slice(-6)) {
      lines.push(`<|im_start|>${turn.role}`);
      lines.push(turn.content);
      lines.push("<|im_end|>");
    }
  }

  // Current user message
  lines.push("<|im_start|>user");
  lines.push(req.message);
  lines.push("<|im_end|>");
  lines.push("<|im_start|>assistant\n");

  return lines.join("\n");
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

  const prompt = buildPrompt(req);
  const raw = await edgeLLM.generate(prompt);

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
        let startVal = op.start !== undefined && op.start !== null ? Number(op.start) : null;
        let endVal = op.end !== undefined && op.end !== null ? Number(op.end) : null;

        // Fallback for 135M model dropping timestamps
        if (startVal === null || endVal === null) {
          const textToParse = (op.reason || req.message || "").toLowerCase();
          const duration = req.videoContext?.duration || 60;
          
          let amount = 10; // default to 10s if no number is found
          const match = textToParse.match(/(\d+(?:\.\d+)?)\s*(min|minute|sec|second)/);
          if (match) {
            const val = parseFloat(match[1]);
            const unit = match[2];
            amount = unit.startsWith('min') ? val * 60 : val;
          }

          if (textToParse.includes("first") || textToParse.includes("start") || textToParse.includes("beginning") || textToParse.includes("intro")) {
            startVal = 0;
            endVal = Math.min(amount, duration);
          } else if (textToParse.includes("last") || textToParse.includes("end") || textToParse.includes("outro")) {
            startVal = Math.max(0, duration - amount);
            endVal = duration;
          } else {
            // Default arbitrary edit if we can't determine direction
            startVal = 0;
            endVal = Math.min(amount, duration);
          }
        }

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
  };
}
