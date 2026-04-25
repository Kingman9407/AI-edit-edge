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

type ModelAction = {
  type: string;
  start?: number | null;
  end?: number | null;
  clip?: number | null;
  reason?: string | null;
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
// Tool definitions (OpenAI-compatible function calling schema)
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    type: "function",
    function: {
      name: "cut_segment",
      description:
        "Remove (cut out) a segment of the video. Use this when the user asks to cut, trim, remove, or delete a specific time range.",
      parameters: {
        type: "object",
        properties: {
          start: {
            type: "number",
            description: "Start time in seconds of the segment to remove.",
          },
          end: {
            type: "number",
            description: "End time in seconds of the segment to remove.",
          },
          clip: {
            type: "number",
            description:
              "1-based clip index when multiple clips are loaded. Omit if only one clip.",
          },
          reason: {
            type: "string",
            description: "Short human-readable reason for the cut.",
          },
        },
        required: ["start", "end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_trims",
      description:
        "Suggest one or more trim ranges for the user to review before applying. Use this when the user asks for suggestions, highlights, or key moments.",
      parameters: {
        type: "object",
        properties: {
          segments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                start: { type: "number", description: "Start time in seconds." },
                end: { type: "number", description: "End time in seconds." },
                reason: {
                  type: "string",
                  description: "Why this segment should be trimmed.",
                },
              },
              required: ["start", "end"],
            },
          },
        },
        required: ["segments"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_video",
      description:
        "Trigger a video export/render. Use this when the user asks to export, render, or combine clips.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
] as const;

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
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
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
  const toolCalls: any[] | undefined = choice?.message?.tool_calls;
  const assistantText: string = choice?.message?.content ?? "";

  const actions: ModelAction[] = [];

  if (toolCalls?.length) {
    for (const tc of toolCalls) {
      const name: string = tc?.function?.name ?? "";
      let args: any = {};
      try {
        args = tc?.function?.arguments
          ? JSON.parse(tc.function.arguments)
          : {};
      } catch {
        args = {};
      }

      if (name === "cut_segment") {
        const start = Number(args.start);
        const end = Number(args.end);
        if (Number.isFinite(start) && Number.isFinite(end) && start < end) {
          actions.push({
            type: "cut",
            start,
            end,
            clip: typeof args.clip === "number" ? args.clip : null,
            reason: args.reason ?? null,
          });
        }
      } else if (name === "suggest_trims") {
        const segments: any[] = Array.isArray(args.segments)
          ? args.segments
          : [];
        for (const seg of segments) {
          const start = Number(seg.start);
          const end = Number(seg.end);
          if (Number.isFinite(start) && Number.isFinite(end) && start < end) {
            actions.push({
              type: "trim",
              start,
              end,
              clip: null,
              reason: seg.reason ?? null,
            });
          }
        }
      } else if (name === "export_video") {
        actions.push({ type: "export", start: null, end: null, clip: null, reason: null });
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
  } = (await req.json()) as {
    message?: string;
    video?: VideoContext;
    frame?: string | null;
    audio?: AudioContext;
    visual?: VisualContext;
    clips?: ClipContext;
    history?: HistoryMessage[];
    memory?: MemoryContext;
    multiClips?: MultiClipSummary[];
    suggestions?: SuggestionContext[];
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
        "Use ONLY the provided video context, audio context, clip stack, user memory, multi-clip summaries, and frame description.",
        "Do NOT infer or guess content from the file name, title, or metadata.",
        "The user is a casual, non-technical editor: avoid jargon like \"timestamps\" unless necessary.",
        "If they don't know exact times, offer simple choices like \"beginning / middle / end\" or suggest they move the playhead and say \"use current time\".",
        "Keep responses short and do not add lengthy rationales.",
        "One-mode-per-reply: respond in exactly one of these modes: Summarize OR Suggest OR Apply.",
        "Summarize mode: provide 3-6 key moments max with a short title and one-line reason each. End with one short question like \"Want me to trim any of these?\"",
        "Suggest mode: call the suggest_trims tool with trim ranges. Only do this if the user asked for suggestions or highlights.",
        "Apply mode: if the user requests a cut/trim/remove with an explicit range, call the cut_segment tool. If they confirm a single suggestion, call cut_segment. If multiple suggestions exist and intent is unclear, ask which number.",
        "IMPORTANT: cut_segment and suggest_trims represent sections to REMOVE (cut out), not keep.",
        "Treat remove-like verbs (remove, cut out, delete, drop, trim out, get rid of) as removing that exact range.",
        "Treat keep-like phrases (keep only, use only, retain, focus on just this part) as keep-only: call cut_segment twice to remove before and after the range.",
        "Keep-only confirmation rule: first ask a short confirmation before calling cut_segment for keep-only operations.",
        "If the user asks to remove the first or last N seconds/minutes and the duration is known, compute exact times from duration.",
        "If current trim suggestions are provided, only use them when the user references a suggestion (like \"trim 2\") or confirms. If multiple exist and the user says \"yes\", ask which number.",
        "If multi-clip summaries are provided and a trim belongs to a specific clip, use the clip parameter in cut_segment.",
        "Never fabricate timestamps.",
        "If the user asks to export/merge/render, call the export_video tool.",
        "If the request is ambiguous, reply with plain text asking a short clarifying question — do NOT call any tool.",
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

  // Call model with tools
  let toolResult: ToolCallResult;
  try {
    toolResult = await requestWithTools({ messages });
  } catch (error) {
    const errMessage =
      error instanceof Error ? error.message : "Chat model request failed";
    console.error("Chat API Request Error:", error);
    return Response.json({ error: { message: errMessage } }, { status: 500 });
  }

  addUsage(toolResult.usage);

  const assistantMessage =
    toolResult.assistantText ||
    (toolResult.actions.length > 0
      ? toolResult.actions
          .map((a) =>
            a.type === "export"
              ? "Starting export..."
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

  // Persist last response for debugging
  const record = {
    savedAt: new Date().toISOString(),
    request: {
      message,
      video,
      audio,
      visual,
      clips,
      history,
      multiClips,
      suggestions,
    },
    response: {
      raw: toolResult.rawContent,
      toolActions: toolResult.actions,
      parsed,
    },
  };

  try {
    const { mkdir, writeFile } = await import("fs/promises");
    const { join } = await import("path");
    const dir = join(process.cwd(), ".ai");
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "last-response.json"),
      JSON.stringify(record, null, 2),
      "utf8"
    );
  } catch {
    // ignore write errors in serverless environments
  }

  return Response.json(
    {
      assistantMessage,
      parsed,
      usage: usageTotals,
    },
    { status: 200 }
  );
}
