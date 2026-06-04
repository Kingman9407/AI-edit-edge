import { TOOLS, parseToolCallToAction } from "@/app/backend/api/chat/tools";
import type { ModelAction } from "@/app/backend/api/chat/types";

type VideoContext = {
  name?: string;
  type?: string;
  sizeBytes?: number;
  duration?: number;
  width?: number;
  height?: number;
  currentTime?: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  isEditorMode?: boolean;
};

type AudioContext = {
  status?: string;
  summary?: string;
  error?: string | null;
};

type ClipContext = {
  summary?: string;
};

type VisualContext = {
  summary?: string;
};

type MemoryContext = {
  summary?: string;
};

type MultiClipSummary = {
  label: string;
  summary: string;
};

type SuggestionContext = {
  start: number;
  end: number;
  note?: string;
};

type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ModelJson = {
  assistant_message: string;
  status: "ok" | "needs_info" | "error";
  follow_up?: string | null;
  actions?: ModelAction[];
};

type UsageTotals = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

const resolveChatModel = () => {
  const defaultModel = "openai/gpt-oss-120b";
  const baseModel = process.env.OPENROUTER_CHAT_MODEL ?? defaultModel;
  return process.env.OPENROUTER_CHAT_MODEL_LITE ?? baseModel;
};

// ---------------------------------------------------------------------------
// Core request with tool calling
// ---------------------------------------------------------------------------

type ToolCallResult = {
  assistantText: string;
  actions: ModelAction[];
  usage: UsageTotals | null;
  rawContent: string;
};

type OpenRouterToolResponse = {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
    };
  }>;
  usage?: UsageTotals | null;
  error?: {
    message?: string;
  };
};

async function requestWithTools({
  messages,
}: {
  messages: ChatMessage[];
}): Promise<ToolCallResult> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolveChatModel(),
        messages,
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.4,
        top_p: 0.9,
      }),
    }
  );

  const raw = await response.text();
  let data: OpenRouterToolResponse | null = null;
  try {
    data = raw ? (JSON.parse(raw) as OpenRouterToolResponse) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.error?.message || raw?.slice(0, 200) || "Chat model request failed";
    console.error("OpenRouter Response Error:", { status: response.status, message, raw });
    throw new Error(message);
  }

  const choice = data?.choices?.[0];
  const usage: UsageTotals | null = data?.usage ?? null;
  const toolCalls = choice?.message?.tool_calls;
  const assistantText: string = choice?.message?.content ?? "";

  const actions: ModelAction[] = [];

  if (toolCalls?.length) {
    for (const tc of toolCalls) {
      const name: string = tc?.function?.name ?? "";
      let args: Record<string, unknown> = {};
      try {
        args = tc?.function?.arguments
          ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
          : {};
      } catch {
        args = {};
      }
      const parsedAction = parseToolCallToAction(name, args);
      if (parsedAction) {
        actions.push(parsedAction);
      }
    }
  }

  return {
    assistantText,
    actions,
    usage,
    rawContent: raw,
  };
}

// ---------------------------------------------------------------------------
// Frame description (vision)
// ---------------------------------------------------------------------------

function formatSeconds(value: number) {
  return `${value.toFixed(2)}s`;
}

async function describeFrame(frameDataUrl: string) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe this video frame for editing. Focus on people, actions, objects, and setting.",
              },
              {
                type: "image_url",
                image_url: {
                  url: frameDataUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 256,
        temperature: 0.2,
        top_p: 0.9,
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || "Vision model request failed";
    throw new Error(message);
  }

  return {
    description: data?.choices?.[0]?.message?.content as string | undefined,
    usage: data?.usage ?? null,
  };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const {
    message,
    video,
    frame,
    audio,
    visual,
    clips,
    history,
    memory,
    allowThinking,
    multiClips,
    suggestions,
    audioFiles,
    activeTimeline,
  } = (await req.json()) as {
    message?: string;
    video?: VideoContext;
    frame?: string | null;
    audio?: AudioContext;
    visual?: VisualContext;
    clips?: ClipContext;
    history?: HistoryMessage[];
    memory?: MemoryContext;
    allowThinking?: boolean;
    multiClips?: MultiClipSummary[];
    suggestions?: SuggestionContext[];
    audioFiles?: { name: string; sizeBytes: number; index: number }[];
    activeTimeline?: { start: number; end: number }[];
  };


  const usageTotals: Required<UsageTotals> = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };
  const addUsage = (usage: UsageTotals | null | undefined) => {
    if (!usage) return;
    if (typeof usage.prompt_tokens === "number") {
      usageTotals.prompt_tokens += usage.prompt_tokens;
    }
    if (typeof usage.completion_tokens === "number") {
      usageTotals.completion_tokens += usage.completion_tokens;
    }
    if (typeof usage.total_tokens === "number") {
      usageTotals.total_tokens += usage.total_tokens;
    }
  };

  // Build video context lines
  const contextLines: string[] = [];
  if (video?.name) contextLines.push(`File: ${video.name}`);
  if (video?.type) contextLines.push(`Type: ${video.type}`);
  if (typeof video?.sizeBytes === "number" && video.sizeBytes > 0) {
    const sizeMb = video.sizeBytes / (1024 * 1024);
    contextLines.push(`Size: ${sizeMb.toFixed(2)} MB`);
  }
  if (typeof video?.duration === "number" && Number.isFinite(video.duration)) {
    contextLines.push(`Duration: ${formatSeconds(video.duration)}`);
  }
  if (
    typeof video?.width === "number" &&
    typeof video?.height === "number" &&
    video.width > 0 &&
    video.height > 0
  ) {
    contextLines.push(`Resolution: ${video.width}x${video.height}`);
  }
  if (
    typeof video?.currentTime === "number" &&
    Number.isFinite(video.currentTime)
  ) {
    contextLines.push(`Playhead: ${formatSeconds(video.currentTime)}`);
  }
  if (
    typeof video?.trimStartSeconds === "number" &&
    typeof video?.trimEndSeconds === "number" &&
    Number.isFinite(video.trimStartSeconds) &&
    Number.isFinite(video.trimEndSeconds)
  ) {
    contextLines.push(
      `Trim range: ${formatSeconds(video.trimStartSeconds)} - ${formatSeconds(
        video.trimEndSeconds
      )}`
    );
  }
  if (typeof video?.isEditorMode === "boolean") {
    contextLines.push(`Editor mode: ${video.isEditorMode ? "on" : "off"}`);
  }

  // DISABLED: audio context
  // if (audio?.summary) {
  //   contextLines.push(`Audio context:\n${audio.summary}`);
  // } else if (audio?.status && audio.status !== "done") {
  //   const statusLine = audio.error
  //     ? `Audio status: ${audio.status} (${audio.error})`
  //     : `Audio status: ${audio.status}`;
  //   contextLines.push(statusLine);
  // }

  if (clips?.summary) {
    contextLines.push(`Clip stack:\n${clips.summary}`);
  }

  if (visual?.summary) {
    contextLines.push(`Visual context:\n${visual.summary}`);
  }

  if (memory?.summary) {
    contextLines.push(`User memory: ${memory.summary}`);
  }


  if (multiClips && multiClips.length) {
    const summaries = multiClips
      .map((clip) => `- ${clip.label}: ${clip.summary}`)
      .join("\n");
    contextLines.push(`Multi-clip summaries:\n${summaries}`);
  }

  if (suggestions && suggestions.length) {
    const lines = suggestions.map((suggestion, index) => {
      const note = suggestion.note ? ` (${suggestion.note})` : "";
      return `${index + 1}. ${formatSeconds(suggestion.start)} - ${formatSeconds(
        suggestion.end
      )}${note}`;
    });
    contextLines.push(`Current trim suggestions:\n${lines.join("\n")}`);
  }

  if (audioFiles && audioFiles.length) {
    const lines = audioFiles.map(
      (f) => `Index ${f.index}: ${f.name} (${(f.sizeBytes / 1024 / 1024).toFixed(2)}MB)`
    );
    contextLines.push(`Uploaded Audio Files:\n${lines.join("\n")}`);
  }

  if (activeTimeline && activeTimeline.length) {
    const lines = activeTimeline.map(
      (s, i) => `#${i + 1}: ${formatSeconds(s.start)} - ${formatSeconds(s.end)}`
    );
    contextLines.push(`Active Timeline (remaining video parts):\n${lines.join("\n")}`);
  }

  // DISABLED: frame description (video analysis)
  // if (typeof frame === "string" && frame.startsWith("data:image/")) {
  //   try {
  //     const frameResult = await describeFrame(frame);
  //     addUsage(frameResult.usage);
  //     if (frameResult.description) {
  //       contextLines.push(`Frame description: ${frameResult.description}`);
  //     }
  //   } catch {
  //     contextLines.push("Frame description: unavailable");
  //   }
  // }

  // Build messages array
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "You are an AI video editing assistant inside a video editor.",
        "Respond as if the edit will happen in this app. Do not suggest external apps, websites, or OS-level steps.",
        "Keep replies concise, friendly, and action-focused.",
        "Use only the provided context. Do not infer content from file names or metadata.",
        "Prefer tools over prose whenever the user's intent is clear.",
        "Use cut_segment for explicit trim/cut/remove/delete requests and for confirmed suggestions.",
        "Use keep_segment for keep-only requests that preserve one exact range.",
        "Use remove_silence for requests about silence, pauses, dead air, or low-signal cleanup.",
        "Use export_video when the user asks to export, render, or combine the current single video.",
        "Use merge_videos when the user asks to merge, join, combine, or concatenate multiple video files together. After calling merge_videos, tell the user to click the '⚡ Merge' button in the Clip Stack bar to start the export.",
        "Use mute_segment when the user wants to silence, mute, or remove the audio from a specific time range — this KEEPS the video but mutes its audio.",
        "Use add_audio_overlay when the user wants to add background music, overlay audio, mix in a sound file, or play an uploaded audio file over the video. Only use this if audio files are listed in the context.",
        "NEVER use cut_segment when the user wants to add audio or overlay music — that removes video, not adds audio.",
        "The tool schemas define the action details and parameters; follow them.",
        "cut_segment always refers to ranges to remove, not keep.",
        "If the user asks to keep only a range, prefer keep_segment.",
        "If the user asks to remove the first or last N seconds/minutes and duration is known, compute the exact range.",
        "If current suggestions exist and the user says 'yes' or confirms ambiguously, ask which suggestion number.",
        "If a trim belongs to a specific clip in multi-clip mode, include the clip parameter.",
        "Never fabricate timestamps.",
        "The Active Timeline context describes the parts of the video that currently remain after edits.",
        "Prioritize making future edits (like removing silence or cutting segments) within these active regions.",
        "If the user asks to remove something, compute the range relative to the original video timeline, but ensure it overlaps with the Active Timeline.",
        "If the user is happy with the current edit, suggest 'export_video' to finalize.",
        "If 'Multi-clip summaries' are present in the context, it means the user has loaded multiple video files. Use merge_videos when they ask to merge, join, or combine them.",
        "The user is non-technical, so avoid jargon and keep the response short.",
      ].join(" "),
    },
  ];

  if (contextLines.length > 0) {
    messages.push({
      role: "system",
      content: `Video context:\n${contextLines.join("\n")}`,
    });
  }

  if (history && history.length) {
    messages.push(...history);
  } else if (message) {
    messages.push({ role: "user", content: message });
  }

  // Log all messages sent to the AI model before the request
  console.log("\n========== [Edge AI] Input Messages ==========");
  messages.forEach((msg, i) => {
    console.log(`\n[${i}] role: ${msg.role}`);
    console.log(msg.content);
  });
  console.log("==============================================\n");

  // Call model with tools
  const modelCallStart = Date.now();
  let toolResult: ToolCallResult;
  try {
    toolResult = await requestWithTools({ messages });
  } catch (error) {
    const errMessage =
      error instanceof Error ? error.message : "Chat model request failed";
    console.error("Chat API Request Error:", error);
    return Response.json({ error: { message: errMessage } }, { status: 500 });
  }
  const modelCallMs = Date.now() - modelCallStart;

  addUsage(toolResult.usage);

  // Log model performance stats
  const completionTokens = toolResult.usage?.completion_tokens ?? 0;
  const elapsedSec = modelCallMs / 1000;
  const tokensPerSec = elapsedSec > 0 ? (completionTokens / elapsedSec).toFixed(2) : "n/a";
  console.log("\n========== [Edge AI] Model Stats ============");
  console.log(`Temperature      : 0.4`);
  console.log(`Elapsed time     : ${elapsedSec.toFixed(2)}s`);
  console.log(`Prompt tokens    : ${toolResult.usage?.prompt_tokens ?? "n/a"}`);
  console.log(`Completion tokens: ${completionTokens}`);
  console.log(`Total tokens     : ${toolResult.usage?.total_tokens ?? "n/a"}`);
  console.log(`Tokens / second  : ${tokensPerSec}`);
  console.log("==============================================\n");

  const assistantMessage =
    toolResult.assistantText ||
    (toolResult.actions.length > 0
      ? toolResult.actions
        .map((a) =>
          a.type === "export"
            ? "Starting export..."
            : a.type === "keep"
              ? `Keeping ${formatSeconds(a.start ?? 0)} – ${formatSeconds(a.end ?? 0)}.`
              : a.type === "remove_silence"
                ? "Removing silence..."
                : a.type === "mute"
                  ? `Muting ${formatSeconds(a.start ?? 0)} – ${formatSeconds(a.end ?? 0)}.`
                  : a.type === "add_audio_overlay"
                    ? `Adding audio overlay (file #${(a.audioFileIndex ?? 0) + 1}) from ${formatSeconds(a.start ?? 0)} – ${formatSeconds(a.end ?? 0)}.`
                    : a.type === "merge_videos"
                      ? "Your clips are ready to merge. Click the ⚡ Merge button in the Clip Stack bar to export."
                      : `Cutting ${formatSeconds(a.start ?? 0)} – ${formatSeconds(a.end ?? 0)}.`
        )
        .join(" ")
      : "Done.");

  // Build the parsed shape the frontend expects (ModelJson-compatible)
  const parsed: ModelJson = {
    assistant_message: assistantMessage,
    status: "ok",
    follow_up: null,
    actions: toolResult.actions,
  };

  return Response.json(
    {
      assistantMessage,
      parsed,
      usage: usageTotals,
    },
    { status: 200 }
  );
}
