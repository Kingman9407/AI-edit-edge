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

const resolveChatModel = (allowThinking?: boolean) => {
  const defaultModel = "nvidia/nemotron-3-super-120b-a12b";
  const baseModel = process.env.NVIDIA_CHAT_MODEL ?? defaultModel;
  const liteModel = process.env.NVIDIA_CHAT_MODEL_LITE ?? baseModel;
  const thinkingModel = process.env.NVIDIA_CHAT_MODEL_THINKING ?? baseModel;
  return allowThinking ? thinkingModel : liteModel;
};

type JsonAttempt = {
  content: string;
  parsed: ModelJson | null;
  usage: UsageTotals | null;
};

type JsonResponse = {
  content: string;
  parsed: ModelJson | null;
  usage: UsageTotals | null;
  attempts: number;
  rawAttempts: string[];
};

function parseModelJson(value: string): ModelJson | null {
  try {
    let cleaned = value.trim();
    // Strip markdown code fences the model sometimes wraps JSON in
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    }
    const parsed = JSON.parse(cleaned) as Partial<ModelJson> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.assistant_message !== "string") return null;
    // Default status to "ok" if the model returned an unexpected value
    const status: ModelJson["status"] =
      parsed.status === "ok" ||
      parsed.status === "needs_info" ||
      parsed.status === "error"
        ? parsed.status
        : "ok";
    // Default actions to [] if missing or non-array
    const actions = Array.isArray(parsed.actions)
      ? (parsed.actions as ModelAction[])
      : [];
    return {
      assistant_message: parsed.assistant_message,
      status,
      follow_up:
        typeof parsed.follow_up === "string" ? parsed.follow_up : null,
      actions,
    };
  } catch {
    return null;
  }
}

async function requestJsonAttempt({
  messages,
  allowThinking,
  temperature,
  top_p,
  extraSystem,
}: {
  messages: ChatMessage[];
  allowThinking?: boolean;
  temperature: number;
  top_p: number;
  extraSystem?: string;
}): Promise<JsonAttempt> {
  const attemptMessages = extraSystem
    ? [
        messages[0],
        { role: "system", content: extraSystem },
        ...messages.slice(1),
      ]
    : messages;

  const response = await fetch(
    "https://integrate.api.nvidia.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolveChatModel(allowThinking),
        messages: attemptMessages,
        max_tokens: 16384,
        temperature,
        top_p,
        chat_template_kwargs: { enable_thinking: Boolean(allowThinking) },
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
    throw new Error(message);
  }

  const content = data?.choices?.[0]?.message?.content ?? raw ?? "";
  const parsed = parseModelJson(content);
  return { content, parsed, usage: data?.usage ?? null };
}

async function requestJsonWithRetry({
  messages,
  allowThinking,
}: {
  messages: ChatMessage[];
  allowThinking?: boolean;
}): Promise<JsonResponse> {
  const attempts: { temperature: number; top_p: number; extraSystem?: string }[] = [
    { temperature: 0.6, top_p: 0.8 },
    {
      temperature: 0,
      top_p: 0.1,
      extraSystem:
        "Your previous response was not valid JSON. Fix it and reply ONLY with the JSON object that matches the schema. No markdown, no backticks, no extra text.",
    },
    {
      temperature: 0,
      top_p: 0.1,
      extraSystem:
        "Return STRICT JSON only. Use double quotes, no trailing commas. Make sure all keys exist and types match the schema exactly.",
    },
    {
      temperature: 0,
      top_p: 0.1,
      extraSystem:
        "Output only the JSON object (no prose). If you are unsure, return status \"needs_info\" with a follow_up question. Always include actions as an array.",
    },
    {
      temperature: 0,
      top_p: 0.1,
      extraSystem:
        "Final attempt: output ONLY a valid JSON object that matches the schema. No extra text.",
    },
  ];
  let last: JsonAttempt | null = null;
  const rawAttempts: string[] = [];
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

  const buildRepairPrompt = (template: string, raw?: string) => {
    const snippet =
      typeof raw === "string" && raw.trim().length
        ? raw.trim().slice(0, 1200)
        : "No response content.";
    return `${template}\nInvalid response:\n${snippet}`;
  };

  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    const extraSystem =
      attempt.extraSystem && i > 0
        ? buildRepairPrompt(attempt.extraSystem, last?.content)
        : attempt.extraSystem;
    last = await requestJsonAttempt({
      messages,
      allowThinking,
      temperature: attempt.temperature,
      top_p: attempt.top_p,
      extraSystem,
    });
    rawAttempts.push(last.content);
    addUsage(last.usage);
    if (last.parsed) {
      return {
        content: last.content,
        parsed: last.parsed,
        usage: usageTotals,
        attempts: i + 1,
        rawAttempts,
      };
    }
  }

  return {
    content: last?.content ?? "",
    parsed: null,
    usage: usageTotals,
    attempts: attempts.length,
    rawAttempts,
  };
}

function formatSeconds(value: number) {
  return `${value.toFixed(2)}s`;
}

async function describeFrame(frameDataUrl: string) {
  const response = await fetch(
    "https://integrate.api.nvidia.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "microsoft/phi-4-multimodal-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Describe this video frame for editing. Focus on people, actions, objects, and setting.",
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
    allowThinking?: boolean;
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

  if (audio?.summary) {
    contextLines.push(`Audio context:
${audio.summary}`);
  } else if (audio?.status && audio.status !== "done") {
    const statusLine = audio.error
      ? `Audio status: ${audio.status} (${audio.error})`
      : `Audio status: ${audio.status}`;
    contextLines.push(statusLine);
  }

  if (clips?.summary) {
    contextLines.push(`Clip stack:
${clips.summary}`);
  }

  if (visual?.summary) {
    contextLines.push(`Visual context:
${visual.summary}`);
  }

  if (memory?.summary) {
    contextLines.push(`User memory: ${memory.summary}`);
  }

  if (typeof allowThinking === "boolean") {
    contextLines.push(`Thinking mode: ${allowThinking ? "on" : "off"}`);
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

  if (typeof frame === "string" && frame.startsWith("data:image/")) {
    try {
      const frameResult = await describeFrame(frame);
      addUsage(frameResult.usage);
      if (frameResult.description) {
        contextLines.push(`Frame description: ${frameResult.description}`);
      }
    } catch {
      contextLines.push("Frame description: unavailable");
    }
  }

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
        "If they don't know exact times, offer simple choices like \"beginning / middle / end\" or \"about how long\" and suggest they can move the playhead and say \"use current time\" or adjust the trim handles and say \"use current trim range.\"",
        "Thinking mode rule: if Thinking mode is off, keep responses short and do not add reasoning or multi-step explanations. If Thinking mode is on, you may add at most 1-2 short rationale lines.",
        "One-mode-per-reply: respond in exactly one of these modes unless the user explicitly asks otherwise: Summarize OR Suggest OR Apply.",
        "Summarize mode (highlights/key moments): provide 3-6 key moments max. Each item should have a short title and a one-line reason. Include a time range if available. End with one short question like \"Want me to trim any of these?\" Do NOT include trim suggestions or extra lists in the same reply.",
        "Suggest mode (trim options): only provide trim suggestions if the user asked for suggestions or highlights. Provide a single list once. Do not repeat the list on confirmation.",
        "Apply mode (trim/export): if the user requests a trim/cut/remove with an explicit range, apply it. If they confirm after you already suggested items, do not re-list; if only one option exists, apply it, otherwise ask which number.",
        "If the user asks to show/describe/what happens in a moment, do NOT create trim actions. Reply with a summary or suggestions only.",
        "IMPORTANT: In this app, actions represent sections to REMOVE (cut out), not sections to keep.",
        "Use natural language understanding to infer intent from phrasing. Treat remove-like verbs (remove, cut out, delete, drop, trim out, get rid of) as removing that exact range.",
        "Treat keep-like phrases (keep only, select this part, use only, retain, focus on just this part) as keep-only: remove everything outside the range.",
        "If the user provides a time range but does not include a clear remove-like or keep-like intent (for example \"1:20 to 2:00\"), ask one short clarification question before creating actions.",
        "If the user says \"trim\" with an explicit range and no keep-only phrasing, assume they want to remove that range (do NOT keep-only).",
        "If the user asks to remove the first or last N seconds/minutes and the duration is known, compute the exact start/end times from duration. If duration is missing, ask a short follow-up question.",
        "Only create keep-only actions (remove before and after) when the user clearly asks to keep only a specific range.",
        "Keep-only confirmation rule: if the user asks to keep only a range, first ask a short confirmation that everything else will be removed. Do NOT create actions until the user confirms.",
        "After confirmation, create actions that remove everything outside that range (0-start and end-duration). Use the video duration to compute the end.",
        "If the intent is ambiguous between keeping and removing, ask one short clarification question and do NOT create actions yet.",
        "If current trim suggestions are provided, only use them when the user references a suggestion (like \"trim 2\") or confirms they want to apply one. If multiple suggestions exist and the user says \"trim it\" or \"yes\", ask which number.",
        "When using a current trim suggestion, copy its exact start/end times and include them in the action; do not invent new timestamps.",
        "If multi-clip summaries are provided and a trim belongs to a specific clip, include the 1-based clip number in the action's \"clip\" field.",
        "If multi-clip summaries are provided, assume multiple videos are uploaded. Do not say there is only one video unless explicitly told.",
        "Multi-clip summaries are brief key points. Go deeper only when the user asks about a specific incident or clip, and ask one short follow-up if needed.",
        "If the user describes an incident, use the multi-clip summaries to pick the most likely clip and either provide a time range or ask a short clarifying question. When you pick a clip, include its 1-based clip number in the action's \"clip\" field.",
        "If the user asks to trim/cut/remove and does not provide an explicit time range, use the last mentioned range if it exists and confirm briefly; otherwise ask one short follow-up question and do not guess.",
        "If the user references a clip without specifying which one, ask which clip number.",
        "If the request requires content you do not have (e.g., transcript still processing), say so briefly and ask whether to wait or proceed with visual-only suggestions.",
        "If the user asks to export/merge, say you are starting the export and include an action with type \"export\". Do not claim it is complete.",
        "Never fabricate timestamps.",
        "Formatting rules: output must be a single JSON object with double quotes only. No trailing commas. Do not wrap in markdown or backticks.",
        "Always include all keys: assistant_message, status, follow_up, actions. follow_up must be null unless you ask a question. actions must be an array (can be empty).",
        "Numbers must be finite (no NaN/Infinity).",
        "Return ONLY strict JSON (no markdown, no extra keys) using this schema: {\"assistant_message\": string, \"status\": \"ok\"|\"needs_info\"|\"error\", \"follow_up\": string|null, \"actions\": [{\"type\": string, \"start\": number|null, \"end\": number|null, \"clip\": number|null, \"reason\": string|null}]}."
      ].join(" "),
    },
  ];

  if (contextLines.length > 0) {
    messages.push({
      role: "system",
      content: `Video context:
${contextLines.join("\n")}`,
    });
  }

  if (history && history.length) {
    messages.push(...history);
  } else if (message) {
    messages.push({ role: "user", content: message });
  }

  let jsonResult: JsonResponse;
  try {
    jsonResult = await requestJsonWithRetry({
      messages,
      allowThinking,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Chat model request failed";
    return Response.json({ error: { message } }, { status: 500 });
  }
  addUsage(jsonResult.usage);
  const content = jsonResult.content;
  let parsed = jsonResult.parsed;

  if (!parsed) {
    parsed = {
      assistant_message:
        "I couldn't return a valid JSON response. Please rephrase your request.",
      status: "error",
      follow_up: "Please rephrase your request or try again.",
      actions: [],
    };
  }

  const assistantMessage =
    parsed.assistant_message || parsed.follow_up || "No response from AI";

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
      raw: content,
      attempts: jsonResult.attempts,
      rawAttempts: jsonResult.rawAttempts,
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
