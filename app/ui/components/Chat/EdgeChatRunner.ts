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
    "You are an AI video editing assistant. Help the user edit their video. Keep replies concise and friendly."
  );
  if (req.videoContext?.name) {
    lines.push(`Video: ${req.videoContext.name}`);
    if (req.videoContext.duration) {
      lines.push(`Duration: ${req.videoContext.duration.toFixed(1)}s`);
    }
    if (req.videoContext.width && req.videoContext.height) {
      lines.push(`Resolution: ${req.videoContext.width}x${req.videoContext.height}`);
    }
  }
  lines.push("<|im_end|>");

  // Append history
  if (req.history?.length) {
    for (const turn of req.history.slice(-6)) {
      // last 6 turns
      lines.push(`<|im_start|>${turn.role}`);
      lines.push(turn.content);
      lines.push("<|im_end|>");
    }
  }

  // Current user message
  lines.push("<|im_start|>user");
  lines.push(req.message);
  lines.push("<|im_end|>");
  lines.push("<|im_start|>assistant");

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

  // Strip any trailing im_end tokens that slipped through
  const clean = raw.replace(/<\|im_end\|>.*$/s, "").trim();
  const assistantMessage = clean || "I'm ready to help with your video editing!";

  return {
    assistantMessage,
    parsed: {
      assistant_message: assistantMessage,
      status: "ok",
      actions: [], // Edge model doesn't emit structured tool calls
    },
    usage: null,
  };
}
