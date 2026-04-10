import React, { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { formatTime } from "../../utils/formatTime";
import { normalizeSegments } from "../../utils/segments";
import { PLAN_CONFIGS, PlanId } from "../../utils/plans";

interface Message {
  id: string;
  text: string;
  sender: "user" | "system";
}

type MessageLike = {
  id?: string | number;
  text: string;
  sender: "user" | "system";
};

interface VideoContext {
  name: string;
  type: string;
  sizeBytes: number;
  duration: number;
  width: number;
  height: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  isEditorMode: boolean;
}

type AudioSegment = {
  start: number;
  end: number;
  transcript: string;
  category: "speech" | "music" | "sfx";
};

type ClipSegment = {
  id: string;
  start: number;
  end: number;
  reason?: string;
};

type SuggestionSegment = {
  start: number;
  end: number;
  note: string;
};

type VideoInsight = {
  time: number;
  description: string;
};

type ModelAction = {
  type?: string;
  start?: number | null;
  end?: number | null;
  clip?: number | null;
  reason?: string | null;
};

type MultiClipFile = {
  id: string;
  name: string;
  type: string;
  sizeBytes: number;
};

type ClipSnapshot = {
  id: string;
  name: string;
  type: string;
  sizeBytes: number;
  duration: number;
  width: number;
  height: number;
  audioSegments: AudioSegment[];
  audioStatus: "idle" | "processing" | "done" | "error" | "no-audio";
  audioError: string | null;
  videoInsights: VideoInsight[];
  sceneChanges: number[];
  edits: ClipSegment[];
};

type ChatMemory = {
  lastIntent?: string;
  lastTrim?: { start: number; end: number };
  clipCount?: number;
  lastExportAt?: number;
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

interface ChatProps {
  planId: PlanId;
  multiClipMode?: "active" | "all";
  multiClipFiles?: MultiClipFile[];
  multiClipSnapshots?: ClipSnapshot[];
  activeClipIndex?: number;
  onQueueClipTrim?: (
    clipIndex: number,
    start: number,
    end: number,
    reason?: string
  ) => string;
  videoContext?: VideoContext;
  captureFrame?: () => string | null;
  audioSegments?: AudioSegment[];
  audioStatus?: "idle" | "processing" | "done" | "error" | "no-audio";
  audioError?: string | null;
  videoInsights?: VideoInsight[];
  sceneChanges?: number[];
  edits?: ClipSegment[];
  memoryKey?: string;
  onRequestExport?: () => Promise<{ success: boolean; error?: string }>;
  onAddEdit?: (segment: { start: number; end: number; reason?: string }) => void;
  onTokenUsage?: (usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null) => void;
}

const createMessageId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const ensureUniqueMessages = (input: MessageLike[]) => {
  const used = new Set<string>();
  return input.map((message) => {
    const rawId =
      typeof message.id === "string" || typeof message.id === "number"
        ? String(message.id)
        : "";
    let nextId = rawId && !used.has(rawId) ? rawId : createMessageId();
    while (used.has(nextId)) {
      nextId = createMessageId();
    }
    used.add(nextId);
    return { ...message, id: nextId };
  });
};

const hasDuplicateMessageIds = (input: Message[]) => {
  const seen = new Set<string>();
  return input.some((message) => {
    if (seen.has(message.id)) return true;
    seen.add(message.id);
    return false;
  });
};

export default function Chat({
  planId,
  multiClipMode = "active",
  multiClipFiles = [],
  multiClipSnapshots = [],
  activeClipIndex = 0,
  onQueueClipTrim,
  videoContext,
  captureFrame,
  audioSegments = [],
  audioStatus = "idle",
  audioError = null,
  videoInsights = [],
  sceneChanges = [],
  edits = [],
  memoryKey,
  onRequestExport,
  onAddEdit,
  onTokenUsage,
}: ChatProps) {
  const planConfig = PLAN_CONFIGS[planId];
  const defaultMessages = useMemo<Message[]>(
    () => [
      {
        id: createMessageId(),
        text: "Welcome to the video editor! How can I help you today?",
        sender: "system",
      },
    ],
    []
  );
  const [messages, setMessages] = useState<Message[]>(defaultMessages);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionSegment[]>([]);
  const allowLocalEdits = planConfig.chat.allowSimpleEdits;
  const allowSuggestions = planConfig.clips.allowSuggestions;
  const allowAutoApply = planConfig.clips.allowAutoApply;
  const includeAudioContext = planConfig.chat.includeAudio;
  const includeVisualContext = planConfig.chat.includeVisual;
  const includeClipContext = planConfig.chat.includeClips;
  const allowThinking = planConfig.allowThinking;
  const maxTrimFraction = planConfig.maxTrimFraction;
  const nextPlanLabel = planConfig.nextPlanLabel;
  const hasLoadedRef = useRef(false);
  const statusScrollRef = useRef<HTMLDivElement | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [memory, setMemory] = useState<ChatMemory | null>(null);

  useEffect(() => {
    if (!allowSuggestions) {
      setSuggestions([]);
    }
  }, [allowSuggestions]);

  

  const buildSessionTitle = (sessionMessages: MessageLike[]) => {
    const firstUser = sessionMessages.find((msg) => msg.sender === "user");
    if (!firstUser) return "New chat";
    const text = firstUser.text.trim();
    if (!text) return "New chat";
    return text.split(/\s+/).slice(0, 6).join(" ");
  };

  const createSession = (sessionMessages: MessageLike[]) => {
    const timestamp = Date.now();
    const normalizedMessages = ensureUniqueMessages(sessionMessages);
    return {
      id: `${timestamp}-${Math.random().toString(16).slice(2)}`,
      title: buildSessionTitle(normalizedMessages),
      messages: normalizedMessages,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  };

  useEffect(() => {
    if (!memoryKey) {
      setMemory(null);
      return;
    }
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(`chat:memory:${memoryKey}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ChatMemory;
        setMemory(parsed);
        return;
      } catch {
        setMemory(null);
      }
    } else {
      setMemory(null);
    }
  }, [memoryKey]);

  useEffect(() => {
    if (!memoryKey) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      `chat:memory:${memoryKey}`,
      JSON.stringify(memory ?? {})
    );
  }, [memoryKey, memory]);

  const lastEdit = edits.length ? edits[edits.length - 1] : null;
  const lastEditStart = lastEdit?.start ?? null;
  const lastEditEnd = lastEdit?.end ?? null;

  useEffect(() => {
    if (!memoryKey) return;
    const clipCount = edits.length;
    const nextTrim =
      clipCount && lastEditStart !== null && lastEditEnd !== null
        ? { start: lastEditStart, end: lastEditEnd }
        : undefined;

    setMemory((prev) => {
      const sameCount = (prev?.clipCount ?? 0) === clipCount;
      const sameTrim = nextTrim
        ? prev?.lastTrim?.start === nextTrim.start &&
          prev?.lastTrim?.end === nextTrim.end
        : !prev?.lastTrim;
      if (sameCount && sameTrim) return prev;
      return { ...(prev ?? {}), clipCount, lastTrim: nextTrim };
    });
  }, [memoryKey, edits.length, lastEditStart, lastEditEnd]);

  useEffect(() => {
    if (!memoryKey) {
      setMessages(defaultMessages);
      setSessions([]);
      setCurrentSessionId(null);
      hasLoadedRef.current = true;
      return;
    }
    if (typeof window === "undefined") return;

    const sessionsKey = `chat:sessions:${memoryKey}`;
    const currentKey = `chat:current:${memoryKey}`;
    const storedSessions = window.localStorage.getItem(sessionsKey);
    const storedCurrent = window.localStorage.getItem(currentKey);

    let nextSessions: ChatSession[] = [];
    if (storedSessions) {
      try {
        const parsed = JSON.parse(storedSessions) as ChatSession[];
        if (Array.isArray(parsed) && parsed.length) {
          nextSessions = parsed.map((session) => {
            const rawMessages = Array.isArray(session.messages)
              ? session.messages
              : [];
            const normalizedMessages = rawMessages.length
              ? ensureUniqueMessages(rawMessages)
              : defaultMessages;
            return {
              ...session,
              messages: normalizedMessages,
            };
          });
        }
      } catch {
        nextSessions = [];
      }
    }

    if (!nextSessions.length) {
      const legacy = window.localStorage.getItem(`chat:${memoryKey}`);
      let legacyMessages = defaultMessages;
      if (legacy) {
        try {
          const parsedLegacy = JSON.parse(legacy) as MessageLike[];
          if (Array.isArray(parsedLegacy) && parsedLegacy.length) {
            legacyMessages = ensureUniqueMessages(parsedLegacy);
          }
        } catch {
          legacyMessages = defaultMessages;
        }
      }
      const initialSession = createSession(legacyMessages);
      nextSessions = [initialSession];
      window.localStorage.setItem(sessionsKey, JSON.stringify(nextSessions));
      window.localStorage.setItem(currentKey, initialSession.id);
    }

    const activeId =
      storedCurrent && nextSessions.some((session) => session.id === storedCurrent)
        ? storedCurrent
        : nextSessions[0].id;
    const activeSession = nextSessions.find((session) => session.id === activeId);
    if (activeSession) {
      setMessages(activeSession.messages);
    } else {
      setMessages(defaultMessages);
    }
    setSessions(nextSessions);
    setCurrentSessionId(activeId);
    hasLoadedRef.current = true;
  }, [memoryKey]);

  useEffect(() => {
    if (!memoryKey || !hasLoadedRef.current || !currentSessionId) return;
    if (typeof window === "undefined") return;
    const sessionsKey = `chat:sessions:${memoryKey}`;
    const currentKey = `chat:current:${memoryKey}`;
    setSessions((prev) => {
      const updated = prev.map((session) => {
        if (session.id !== currentSessionId) return session;
        const nextMessages = messages;
        return {
          ...session,
          messages: nextMessages,
          title: buildSessionTitle(nextMessages),
          updatedAt: Date.now(),
        };
      });
      window.localStorage.setItem(sessionsKey, JSON.stringify(updated));
      window.localStorage.setItem(currentKey, currentSessionId);
      return updated;
    });
  }, [messages, memoryKey, currentSessionId]);

  useEffect(() => {
    if (!messages.length) return;
    if (!hasDuplicateMessageIds(messages)) return;
    setMessages((prev) => ensureUniqueMessages(prev));
  }, [messages]);

  useEffect(() => {
    if (!statusScrollRef.current) return;
    statusScrollRef.current.scrollTop = statusScrollRef.current.scrollHeight;
  }, [statusLog, status]);

  const handleNewChat = () => {
    const session = createSession(defaultMessages);
    setSessions((prev) => [session, ...prev]);
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setIsHistoryOpen(false);
  };

  const handleSelectSession = (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setIsHistoryOpen(false);
  };

  const countWords = (text: string) =>
    text.trim() ? text.trim().split(/\s+/).length : 0;

  const resolveActionClipIndex = (clipValue?: number | null) => {
    if (clipValue === null || clipValue === undefined) return null;
    const numeric = Number(clipValue);
    if (!Number.isFinite(numeric)) return null;
    const index = Math.floor(numeric) - 1;
    return index >= 0 ? index : null;
  };

  const truncateText = (text: string, maxLength = 90) => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 3).trim()}...`;
  };

  const updateMemory = (patch: Partial<ChatMemory>) => {
    setMemory((prev) => ({
      ...(prev ?? {}),
      ...patch,
    }));
  };

  const buildMemorySummary = (current: ChatMemory | null) => {
    if (!current) return "";
    const parts: string[] = [];
    if (current.lastIntent) {
      parts.push(`Last request: "${truncateText(current.lastIntent, 60)}"`);
    }
    if (current.lastTrim) {
      parts.push(
        `Last trim: ${formatTime(current.lastTrim.start)}-${formatTime(
          current.lastTrim.end
        )}`
      );
    }
    if (typeof current.clipCount === "number") {
      parts.push(`Clips: ${current.clipCount}`);
    }
    if (current.lastExportAt) {
      parts.push(
        `Last export: ${new Date(current.lastExportAt).toLocaleString()}`
      );
    }
    return parts.join(" - ");
  };

  const getTotalTrimmedSeconds = (
    extraSegments: { start: number; end: number }[] = []
  ) => {
    const duration = videoContext?.duration ?? 0;
    if (!duration) return 0;
    const combined = [
      ...edits.map((edit) => ({ start: edit.start, end: edit.end })),
      ...extraSegments,
    ];
    const normalized = normalizeSegments(combined, duration);
    return normalized.reduce(
      (total, segment) => total + (segment.end - segment.start),
      0
    );
  };

  const buildTrimLimitMessage = () => {
    const percent = Math.round(maxTrimFraction * 100);
    const base = `${planConfig.label} plan allows trimming up to ${percent}% of the video.`;
    if (nextPlanLabel) {
      return `${base} Upgrade to ${nextPlanLabel} to trim more.`;
    }
    return base;
  };

  const canQueueTrimSegments = (
    segments: { start: number; end: number }[]
  ) => {
    const duration = videoContext?.duration ?? 0;
    if (!duration || maxTrimFraction >= 1) return true;
    const limitSeconds = duration * maxTrimFraction;
    const nextTotal = getTotalTrimmedSeconds(segments);
    return nextTotal <= limitSeconds + 0.001;
  };

  const buildActionSuggestions = (
    actions: ModelAction[] | undefined | null
  ) => {
    if (!actions?.length) return [] as SuggestionSegment[];
    return actions
      .filter((action) => {
        const type = (action?.type ?? "").toLowerCase();
        return ["trim", "cut", "remove", "delete"].includes(type);
      })
      .map((action) => ({
        start: Number(action?.start),
        end: Number(action?.end),
        note: action?.reason ?? "AI suggestion",
      }))
      .filter(
        (segment) =>
          Number.isFinite(segment.start) &&
          Number.isFinite(segment.end) &&
          segment.start < segment.end
      );
  };

  const pushActionSuggestions = (actions: ModelAction[] | undefined | null) => {
    const nextSuggestions = buildActionSuggestions(actions);
    if (!nextSuggestions.length) return 0;
    setSuggestions(nextSuggestions);
    const lines = nextSuggestions.map(
      (segment, index) =>
        `${index + 1}. ${formatTime(segment.start)}-${formatTime(
          segment.end
        )} - ${segment.note}`
    );
    pushSystemMessage(
      `I found ${nextSuggestions.length} trim suggestion${
        nextSuggestions.length > 1 ? "s" : ""
      }:\n${lines.join("\n")}\nReply with "trim 1" to apply one.`
    );
    return nextSuggestions.length;
  };

  const pushSystemMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: createMessageId(),
        text,
        sender: "system",
      },
    ]);
  };

  const pushStatus = (text: string) => {
    setStatus(text);
    setStatusLog((prev) => {
      const next = prev[prev.length - 1] === text ? prev : [...prev, text];
      return next.slice(-18);
    });
  };

  const applyActionsFromJson = (actions: ModelAction[] | undefined | null) => {
    if (!actions?.length || !onAddEdit) return 0;
    let applied = 0;
    let limitHit = false;
    actions.forEach((action) => {
      const actionType = (action?.type ?? "").toLowerCase();
      if (!["trim", "cut", "remove", "delete"].includes(actionType)) return;
      const start = Number(action?.start);
      const end = Number(action?.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return;
      if (start >= end) return;
      const clipIndex = resolveActionClipIndex(action?.clip);
      if (
        clipIndex !== null &&
        multiClipFiles.length &&
        typeof onQueueClipTrim === "function"
      ) {
        if (clipIndex !== activeClipIndex) {
          const message = onQueueClipTrim(
            clipIndex,
            start,
            end,
            action?.reason ?? `AI ${actionType}`
          );
          pushSystemMessage(message);
          return;
        }
      }
      if (!canQueueTrimSegments([{ start, end }])) {
        limitHit = true;
        return;
      }
      onAddEdit({
        start,
        end,
        reason: action?.reason ?? `AI ${actionType}`,
      });
      applied += 1;
    });
    if (limitHit) {
      pushSystemMessage(buildTrimLimitMessage());
    }
    return applied;
  };

  const handleExportRequest = async () => {
    if (!onRequestExport) {
      pushSystemMessage(
        "Export isn't ready yet. Please use the Export panel button once to load it."
      );
      return;
    }
    pushSystemMessage("Starting export...");
    pushStatus("Starting export...");
    const result = await onRequestExport();
    if (result?.success) {
      updateMemory({ lastExportAt: Date.now() });
      const note =
        edits.length > 0
          ? "Export complete. Use the Removed Export panel for the collected clips."
          : "Export complete. Check the Export panel for the video.";
      pushSystemMessage(note);
    } else {
      pushSystemMessage(
        `Export failed: ${result?.error ?? "Unknown error"}`
      );
    }
    setStatus(null);
  };

  const buildAudioSummaryFor = (
    segments: AudioSegment[],
    status: "idle" | "processing" | "done" | "error" | "no-audio",
    error: string | null,
    allowVisualFallback: boolean
  ) => {
    if (!segments.length) {
      if (status === "no-audio") {
        return allowVisualFallback
          ? "No audio track detected. Relying on visual frames."
          : "No audio track detected.";
      }
      if (status === "processing") {
        return "Audio transcription is processing.";
      }
      if (status === "error") {
        return `Audio transcription failed: ${error ?? "unknown error"}`;
      }
      return "";
    }

    const speechSegments = segments.filter(
      (segment) => segment.category === "speech"
    );
    const musicSegments = segments.filter(
      (segment) => segment.category === "music"
    );
    const sfxSegments = segments.filter(
      (segment) => segment.category === "sfx"
    );

    const formatSegments = (items: AudioSegment[]) =>
      items.map((segment) => {
        const range = `${formatTime(segment.start)}-${formatTime(segment.end)}`;
        if (segment.category === "music") {
          return `${range} music`;
        }
        if (segment.category === "sfx") {
          return `${range} background sound`;
        }
        const text = segment.transcript.trim() || "speech";
        return `${range} ${text}`;
      });

    const speechLines = formatSegments(speechSegments);
    const musicLines = formatSegments(musicSegments);
    const sfxLines = formatSegments(sfxSegments);

    const sections: string[] = [];
    if (speechLines.length) {
      sections.push("Speech:", ...speechLines);
    }
    if (musicLines.length) {
      sections.push("Music:", ...musicLines);
    }
    if (sfxLines.length) {
      sections.push("Background sounds:", ...sfxLines);
    }
    return sections.join("\n");
  };

  const buildAudioKeySummaryFor = (segments: AudioSegment[]) => {
    if (!segments.length) return "No audio highlights yet.";
    const speech = segments.filter(
      (segment) => segment.category === "speech" && segment.transcript.trim()
    );
    if (!speech.length) {
      const musicCount = segments.filter(
        (segment) => segment.category === "music"
      ).length;
      const sfxCount = segments.filter(
        (segment) => segment.category === "sfx"
      ).length;
      const notes = [
        musicCount ? `${musicCount} music segments` : "",
        sfxCount ? `${sfxCount} sfx segments` : "",
      ].filter(Boolean);
      return notes.length ? notes.join(" + ") : "Audio detected.";
    }

    const ranked = speech
      .map((segment) => ({
        segment,
        score: countWords(segment.transcript),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return ranked
      .map(({ segment }) => {
        const range = `${formatTime(segment.start)}-${formatTime(segment.end)}`;
        return `${range} ${truncateText(segment.transcript.trim(), 80)}`;
      })
      .join(" | ");
  };

  const buildAudioKeySummaryWithStatus = (
    segments: AudioSegment[],
    status: "idle" | "processing" | "done" | "error" | "no-audio",
    error: string | null,
    allowVisualFallback: boolean
  ) => {
    if (!segments.length) {
      if (status === "no-audio") {
        return allowVisualFallback
          ? "No audio track detected (visual-only)."
          : "No audio track detected.";
      }
      if (status === "processing") {
        return "Audio processing.";
      }
      if (status === "error") {
        return `Audio error: ${error ?? "unknown error"}`;
      }
      if (status === "done") {
        return "No audio highlights yet.";
      }
      if (status === "idle") {
        return "Audio not analyzed yet.";
      }
      return "";
    }
    return buildAudioKeySummaryFor(segments);
  };

  const buildVisualKeySummaryFor = (
    insights: VideoInsight[],
    scenes: number[]
  ) => {
    if (!insights.length && !scenes.length) return "";
    const parts: string[] = [];
    if (insights.length) {
      const top = insights.slice(0, 2);
      parts.push(
        ...top.map(
          (insight) => `${formatTime(insight.time)} ${insight.description}`
        )
      );
    }
    if (scenes.length) {
      parts.push(`${scenes.length} scene changes`);
    }
    return parts.join(" | ");
  };

  const buildAudioSummary = (allowVisualFallback: boolean) =>
    buildAudioSummaryFor(audioSegments, audioStatus, audioError, allowVisualFallback);

  const buildClipKeySummaryFor = (clipEdits: ClipSegment[]) => {
    if (!clipEdits.length) return "";
    const last = clipEdits[clipEdits.length - 1];
    const range = `${formatTime(last.start)}-${formatTime(last.end)}`;
    if (clipEdits.length === 1) {
      return `1 trim (${range})`;
    }
    return `${clipEdits.length} trims (latest ${range})`;
  };

  const buildClipSummaryFor = (
    clipEdits: ClipSegment[],
    segments: AudioSegment[]
  ) => {
    if (!clipEdits.length) return "";
    return clipEdits
      .map((edit, index) => {
        const overlapping = segments.filter(
          (segment) => segment.end >= edit.start && segment.start <= edit.end
        );
        const audioNotes = overlapping.map((segment) => {
          if (segment.category === "music") {
            return `${formatTime(segment.start)}-${formatTime(segment.end)} music`;
          }
          if (segment.category === "sfx") {
            return `${formatTime(segment.start)}-${formatTime(
              segment.end
            )} background`;
          }
          const text = segment.transcript.trim() || "speech";
          return `${formatTime(segment.start)}-${formatTime(segment.end)} ${text}`;
        });
        const reason = edit.reason
          ? `Reason: ${edit.reason}`
          : "Reason: user request";
        const audioLine = audioNotes.length
          ? ` Audio: ${audioNotes.join(" | ")}`
          : "";
        return `Clip ${index + 1}: ${formatTime(edit.start)}-${formatTime(
          edit.end
        )}. ${reason}.${audioLine}`;
      })
      .join("\n");
  };

  const buildClipSummary = () => buildClipSummaryFor(edits, audioSegments);

  const buildVisualSummaryFor = (
    insights: VideoInsight[],
    scenes: number[]
  ) => {
    const lines: string[] = [];
    if (insights.length) {
      lines.push(
        "Visual scenes:",
        ...insights.map(
          (insight) => `${formatTime(insight.time)} ${insight.description}`
        )
      );
    }
    if (scenes.length) {
      lines.push("Scene changes:", scenes.map((time) => formatTime(time)).join(", "));
    }
    return lines.join("\n");
  };

  const buildVisualSummary = () => buildVisualSummaryFor(videoInsights, sceneChanges);

  const submitMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: createMessageId(),
      text,
      sender: "user",
    };

    updateMemory({ lastIntent: text.trim() });
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = text;
    setInput("");
    setStatusLog([]);

    const historyForModel = [...messages, userMessage].map((msg) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.text,
    }));

    pushStatus(
      `Got it — checking "${truncateText(currentInput, 60)}"...`
    );
    try {
      const trimmedDuration = videoContext?.duration ?? 0;
      const safeTrimStart = videoContext?.trimStart ?? 0;
      const safeTrimEnd = videoContext?.trimEnd ?? 100;
      const trimStartSeconds =
        trimmedDuration > 0 ? (safeTrimStart / 100) * trimmedDuration : 0;
      const trimEndSeconds =
        trimmedDuration > 0 ? (safeTrimEnd / 100) * trimmedDuration : 0;

      pushStatus("Reviewing the timeline and trim range...");
      if (includeAudioContext) {
        if (audioSegments.length) {
          pushStatus("Scanning speech, music, and background sounds...");
        } else if (audioStatus === "processing") {
          pushStatus("Audio is still processing - using visuals for now...");
        } else if (audioStatus === "no-audio") {
          pushStatus("No audio track detected - using visuals only...");
        }
      }

      const frameDataUrl =
        includeVisualContext && videoContext && captureFrame
          ? captureFrame()
          : null;

      if (includeAudioContext || includeVisualContext || includeClipContext) {
        pushStatus("Summarizing context...");
      }

      const audioSummary = includeAudioContext
        ? buildAudioSummary(includeVisualContext)
        : "";
      const clipSummary = includeClipContext ? buildClipSummary() : "";
      const visualSummary = includeVisualContext ? buildVisualSummary() : "";
      const memorySnapshot = buildMemorySummary({
        ...(memory ?? {}),
        lastIntent: currentInput.trim(),
      });

      pushStatus("Sending context to the AI...");

      const requestBody = {
        message: currentInput,
        history: historyForModel,
        memory: memorySnapshot ? { summary: memorySnapshot } : undefined,
        allowThinking,
        multiClips:
          multiClipMode === "all" && multiClipSummaries.length
            ? multiClipSummaries
            : undefined,
        suggestions: suggestions.length
          ? suggestions.map((suggestion) => ({
              start: suggestion.start,
              end: suggestion.end,
              note: suggestion.note,
            }))
          : undefined,
        video: videoContext
          ? {
              name: videoContext.name,
              type: videoContext.type,
              sizeBytes: videoContext.sizeBytes,
              duration: videoContext.duration,
              width: videoContext.width,
              height: videoContext.height,
              currentTime: videoContext.currentTime,
              trimStartSeconds,
              trimEndSeconds,
              isEditorMode: videoContext.isEditorMode,
            }
          : undefined,
        frame: frameDataUrl,
        audio: audioSummary
          ? {
              status: audioStatus,
              summary: audioSummary,
              error: audioError,
            }
          : undefined,
        visual: visualSummary
          ? {
              summary: visualSummary,
            }
          : undefined,
        clips: clipSummary
          ? {
              summary: clipSummary,
            }
          : undefined,
      };

      let res: Response | null = null;
      let data: any = null;
      let raw = "";
      const maxParseRetries = 5;

      for (let attempt = 1; attempt <= maxParseRetries; attempt += 1) {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        raw = await res.text();
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          data = null;
        }

        if (!res.ok) {
          const errorMessage =
            data?.error?.message ||
            raw?.slice(0, 200) ||
            `Request failed (${res.status})`;
          throw new Error(errorMessage);
        }

        if (data) break;

        if (attempt < maxParseRetries) {
          pushStatus(
            `AI response was invalid JSON. Retrying (${attempt + 1}/${maxParseRetries})...`
          );
        }
      }

      if (!data || !res) {
        throw new Error("AI response was not valid JSON. Please try again.");
      }

      if (data?.usage) {
        onTokenUsage?.(data.usage);
      }

      pushStatus("Parsing the AI response...");

      const responseStatus = data?.parsed?.status;
      const aiText =
        data?.assistantMessage ||
        (responseStatus === "needs_info"
          ? data?.parsed?.follow_up || data?.parsed?.assistant_message
          : data?.parsed?.assistant_message || data?.parsed?.follow_up) ||
        data?.choices?.[0]?.message?.content ||
        "No response from AI";

      const parsedActions = data?.parsed?.actions;
      let appliedCount = 0;
      const canApplyActions = allowAutoApply || allowLocalEdits;
      const allowActionProcessing = responseStatus !== "needs_info";
      if (canApplyActions && allowActionProcessing) {
        appliedCount = applyActionsFromJson(parsedActions);
        if (appliedCount > 0) {
          pushStatus(
            `Applying ${appliedCount} edit${appliedCount > 1 ? "s" : ""}...`
          );
          pushSystemMessage(
            `Applied ${appliedCount} edit${appliedCount > 1 ? "s" : ""} from AI.`
          );
        }
      }

      if (appliedCount === 0 && allowSuggestions && allowActionProcessing) {
        const suggestionCount = pushActionSuggestions(parsedActions);
        if (suggestionCount > 0) {
          pushStatus(
            `Shared ${suggestionCount} trim suggestion${
              suggestionCount > 1 ? "s" : ""
            } for review.`
          );
        }
      } else if (parsedActions?.length && !canApplyActions && allowActionProcessing) {
        pushSystemMessage(
          "Edits are not auto-applied on this plan. Try a simple time range like 00:12-00:18."
        );
      }

      if (
        allowAutoApply &&
        parsedActions?.some((action: ModelAction) =>
          ["export", "render", "combine"].includes(
            (action?.type ?? "").toLowerCase()
          )
        )
      ) {
        pushStatus("Starting export...");
        await handleExportRequest();
      }

      const botMessage: Message = {
        id: createMessageId(),
        text: aiText,
        sender: "system",
      };

      setMessages((prev) => [...prev, botMessage]);
      pushStatus("Ready. Waiting for your next instruction.");
    } catch (error) {
      console.error(error);
      const errorText =
        error instanceof Error ? error.message : "Error connecting to AI";

      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          text: `Error: ${errorText}`,
          sender: "system",
        },
      ]);
    } finally {
      setStatus(null);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    void submitMessage(input);
  };

  const buildSegmentNote = (segment: AudioSegment) => {
    if (segment.category === "music") return "music";
    if (segment.category === "sfx") return "background sound";
    const text = segment.transcript.trim();
    return text ? truncateText(text, 80) : "speech";
  };

  const buildQuickPrompt = (segment: AudioSegment) => {
    const range = `${formatTime(segment.start)}-${formatTime(segment.end)}`;
    const note = buildSegmentNote(segment);
    return `Explain what happens in ${range} (${note}).`;
  };

  const memorySummary = buildMemorySummary(memory);

  const multiClipSummaries = useMemo(() => {
    if (multiClipMode !== "all" || !multiClipFiles.length) return [];
    const snapshotMap = new Map(
      multiClipSnapshots.map((snapshot) => [snapshot.id, snapshot])
    );

    return multiClipFiles.map((file, index) => {
      const snapshot = snapshotMap.get(file.id);
      if (!snapshot) {
        return {
          label: `Clip ${index + 1}: ${file.name}`,
          summary: "No analysis yet. Open this clip to analyze it.",
        };
      }

      const parts: string[] = [];
      if (snapshot.duration) {
        parts.push(`Duration: ${formatTime(snapshot.duration)}`);
      }
      if (snapshot.width && snapshot.height) {
        parts.push(`Resolution: ${snapshot.width}x${snapshot.height}`);
      }

      if (includeAudioContext) {
        const audioSummary = buildAudioKeySummaryWithStatus(
          snapshot.audioSegments,
          snapshot.audioStatus,
          snapshot.audioError,
          includeVisualContext
        );
        if (audioSummary) parts.push(`Audio: ${audioSummary}`);
      }

      if (includeVisualContext) {
        const visualSummary = buildVisualKeySummaryFor(
          snapshot.videoInsights,
          snapshot.sceneChanges
        );
        if (visualSummary) {
          parts.push(`Visual: ${visualSummary}`);
        } else {
          parts.push("Visual: not analyzed yet.");
        }
      }

      if (includeClipContext) {
        const clipSummary = buildClipKeySummaryFor(snapshot.edits);
        if (clipSummary) parts.push(`Clips: ${clipSummary}`);
      }

      const summary = parts.length
        ? parts.join("\n")
        : "No extra analysis available.";
      return { label: `Clip ${index + 1}: ${snapshot.name}`, summary };
    });
  }, [
    multiClipMode,
    multiClipFiles,
    multiClipSnapshots,
    includeAudioContext,
    includeVisualContext,
    includeClipContext,
  ]);

  return (
    <div className="flex h-full min-h-[500px] max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl shadow-2xl">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950/50 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
            AI Assistant
          </h2>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                allowThinking
                  ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                  : "border-zinc-700 text-zinc-400"
              }`}
            >
              Thinking {allowThinking ? "On" : "Off"}
            </span>
            <button
              type="button"
              onClick={() => setIsHistoryOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-blue-500 hover:text-white"
            >
              <span className="flex flex-col gap-0.5">
                <span className="h-0.5 w-4 rounded-full bg-zinc-400"></span>
                <span className="h-0.5 w-4 rounded-full bg-zinc-400"></span>
                <span className="h-0.5 w-4 rounded-full bg-zinc-400"></span>
              </span>
              History
            </button>
            <button
              type="button"
              onClick={handleNewChat}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-emerald-400 hover:text-white"
            >
              New Chat
            </button>
          </div>
        </div>
      </div>

      {memorySummary ? (
        <div className="border-b border-zinc-800 bg-zinc-950/40 px-6 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Memory
          </div>
          <div className="mt-1 text-xs text-zinc-300">{memorySummary}</div>
        </div>
      ) : null}

      {isHistoryOpen ? (
        <div className="border-b border-zinc-800 bg-zinc-950/40 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Chat History
          </div>
          <div className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs text-zinc-300">
            {sessions.length ? (
              sessions.map((session) => {
                const isActive = session.id === currentSessionId;
                const updated = new Date(session.updatedAt).toLocaleString();
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => handleSelectSession(session.id)}
                    className={`flex w-full flex-col rounded-xl border px-3 py-2 text-left transition ${
                      isActive
                        ? "border-blue-500 bg-blue-500/10 text-zinc-100"
                        : "border-zinc-800 bg-zinc-950/60 hover:border-blue-500"
                    }`}
                  >
                    <span className="text-sm font-semibold text-zinc-200">
                      {session.title}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {updated}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 p-4 text-center text-xs text-zinc-500">
                No chat history yet.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 overscroll-y-contain">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2 ${
                msg.sender === "user"
                  ? "bg-blue-600 justify-end text-white rounded-tr-none"
                  : "bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700/50"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {status || statusLog.length ? (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl border border-zinc-700/60 bg-zinc-800/70 px-4 py-3 text-xs text-zinc-300 shadow-sm">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                AI Progress
              </div>
              <div
                ref={statusScrollRef}
                className="mt-2 max-h-32 space-y-1 overflow-y-auto pr-2 text-[11px] text-zinc-400"
              >
                {statusLog.map((line, index) => {
                  const isLatest = index === statusLog.length - 1 && status;
                  return (
                    <div
                      key={`${line}-${index}`}
                      className={isLatest ? "text-zinc-200 animate-pulse" : ""}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Segment Highlights */}
      {audioSegments.length ? (
        <div className="border-t border-zinc-800 bg-zinc-950/40 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Segment Highlights
          </div>
          <div className="mt-2 max-h-32 space-y-2 overflow-y-auto text-xs text-zinc-300">
            {audioSegments.map((segment, index) => {
              const range = `${formatTime(segment.start)}-${formatTime(
                segment.end
              )}`;
              const note = buildSegmentNote(segment);
              return (
                <div
                  key={`${segment.start}-${segment.end}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-zinc-200">{range}</div>
                    <div className="text-[11px] text-zinc-400">{note}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void submitMessage(buildQuickPrompt(segment))}
                    className="shrink-0 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
                  >
                    Ask AI
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Input Area */}
      <div className="border-t border-zinc-800 bg-zinc-950/50 p-4">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="w-full rounded-full border border-zinc-700 bg-zinc-900 py-3 pl-5 pr-12 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
