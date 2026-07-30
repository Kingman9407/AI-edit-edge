import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useEdgeLLM } from "@/app/hooks/useEdgeLLM";
import { runEdgeChat } from "@/app/components/Chat/EdgeChatRunner";
import { formatTime } from "@/app/backend/functions/formatTime";
import { normalizeSegments, type Segment } from "@/app/backend/functions/segments";
import { PLAN_CONFIGS, PlanId } from "@/app/backend/functions/plans";
import { useFirebaseAuth } from "@/app/context/FirebaseAuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/app/lib/firebase";
import { useRouter } from "next/navigation";
import type { Message, AudioSegment, ChatSession, InferenceMode, MultiClipFile, ClipSnapshot, VideoContext, VideoInsight, ClipSegment, SuggestionSegment, ChatMemory } from "./types";
import type { ModelAction } from "@/app/backend/api/chat/types";
import ChatMessage from "./components/ChatMessage";
import ChatTypingIndicator from "./components/ChatTypingIndicator";
import SegmentHighlights from "./components/SegmentHighlights";
import ChatInputBar from "./components/ChatInputBar";
import ChatMenu from "./components/ChatMenu";
import EdgeConfirmPanel from "./components/EdgeConfirmPanel";
import EdgeModelBanners from "./components/EdgeModelBanners";


type MessageLike = {
  id?: string | number;
  text: string;
  sender: "user" | "system";
  rawJson?: string;
  tps?: number;
};


interface ChatProps {
  planId: PlanId;
  multiClipMode?: "active" | "all";
  multiClipFiles?: MultiClipFile[];
  multiClipSnapshots?: ClipSnapshot[];
  activeClipIndex?: number;
  /** All loaded video files regardless of plan — used to detect merge eligibility */
  allLoadedFiles?: MultiClipFile[];
  /** All clip snapshots regardless of plan — used for duration info in merge context */
  allClipSnapshots?: ClipSnapshot[];
  onQueueClipTrim?: (
    clipIndex: number,
    start: number,
    end: number,
    reason?: string
  ) => string;
  onQueueClipMute?: (
    clipIndex: number,
    start: number,
    end: number,
    reason?: string
  ) => string;
  videoContext?: VideoContext;
  audioFiles?: File[];
  onAddOverlay?: (overlay: { file: File; videoStart: number; videoEnd: number; volume: number; label?: string }) => void;
  captureFrame?: () => string | null;
  audioSegments?: AudioSegment[];
  audioStatus?: "idle" | "processing" | "done" | "error" | "no-audio";
  audioError?: string | null;
  videoInsights?: VideoInsight[];
  sceneChanges?: number[];
  edits?: ClipSegment[];
  mutedSegments?: ClipSegment[];
  memoryKey?: string;
  onRequestExport?: () => Promise<{ success: boolean; error?: string }>;
  onAddEdit?: (segment: { start: number; end: number; reason?: string }) => void;
  onAddMute?: (segment: { start: number; end: number; reason?: string }) => void;
  onTokenUsage?: (usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null) => void;
  onPlanSelect?: (planId: PlanId) => void;
  activeTimeline?: Segment[];
  tokenUsage?: {
    total: number;
    chat: number;
    audio: number;
    vision: number;
  };
  audioOverlays?: { videoStart: number; videoEnd: number; label?: string }[];
  /** Called when the AI requests a merge — activates merge mode in the parent */
  onActivateMerge?: () => void;
  onUndoEdits?: (count: number) => void;
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


export default function Chat({
  planId,
  multiClipMode = "active",
  multiClipFiles = [],
  multiClipSnapshots = [],
  activeClipIndex = 0,
  audioFiles = [],
  onQueueClipTrim,
  onQueueClipMute,
  onAddOverlay,
  videoContext,
  captureFrame,
  audioSegments = [],
  audioStatus = "idle",
  audioError = null,
  videoInsights = [],
  sceneChanges = [],
  edits = [],
  mutedSegments = [],
  audioOverlays = [],
  memoryKey,
  onRequestExport,
  onAddEdit,
  onAddMute,
  onTokenUsage,
  onPlanSelect,
  tokenUsage,
  activeTimeline = [],
  onActivateMerge,
  onUndoEdits,
  allLoadedFiles = [],
  allClipSnapshots = [],
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
  const maxTrimFraction = planConfig.maxTrimFraction;
  const nextPlanLabel = planConfig.nextPlanLabel;
  const hasLoadedRef = useRef(false);
  const statusScrollRef = useRef<HTMLDivElement | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [memory, setMemory] = useState<ChatMemory | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [inferenceMode, setInferenceMode] = useState<InferenceMode>("cloud");
  const [showEdgeConfirm, setShowEdgeConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevEdgeLLMStatusRef = useRef<string>("idle");
  const edgeLLM = useEdgeLLM();
  const { user: authUser } = useFirebaseAuth();
  const router = useRouter();

  async function handleLogout() {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }

  useEffect(() => {
    if (!allowSuggestions) {
      setTimeout(() => setSuggestions([]), 0);
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
      setTimeout(() => setMemory(null), 0);
      return;
    }
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(`chat:memory:${memoryKey}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ChatMemory;
        setTimeout(() => setMemory(parsed), 0);
        return;
      } catch {
        setTimeout(() => setMemory(null), 0);
      }
    } else {
      setTimeout(() => setMemory(null), 0);
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

  useEffect(() => {
    if (!memoryKey) {
      setTimeout(() => {
        setMessages(defaultMessages);
        setSessions([]);
        setCurrentSessionId(null);
      }, 0);
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

    setTimeout(() => {
      if (activeSession) {
        setMessages(activeSession.messages);
      } else {
        setMessages(defaultMessages);
      }
      setSessions(nextSessions);
      setCurrentSessionId(activeId);
    }, 0);
    hasLoadedRef.current = true;
  }, [memoryKey]);

  // Refs to track latest messages and last-saved signature without reactive deps.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const lastSavedMsgSigRef = useRef<string>("");
  const lastMsgCountRef = useRef(0);

  // Session-save: triggered by currentSessionId/memoryKey changes only.
  // Uses messagesRef to read latest messages without subscribing to them.
  useEffect(() => {
    if (!memoryKey || !hasLoadedRef.current || !currentSessionId) return;
    if (typeof window === "undefined") return;
    const msgs = messagesRef.current;
    const sig = msgs.map((m) => m.id).join(",");
    if (sig === lastSavedMsgSigRef.current) return;
    lastSavedMsgSigRef.current = sig;
    const sessionsKey = `chat:sessions:${memoryKey}`;
    const currentKey = `chat:current:${memoryKey}`;
    try {
      const raw = window.localStorage.getItem(sessionsKey);
      const stored: ChatSession[] = raw ? JSON.parse(raw) : [];
      const updated = stored.map((session) => {
        if (session.id !== currentSessionId) return session;
        return { ...session, messages: msgs, title: buildSessionTitle(msgs), updatedAt: Date.now() };
      });
      window.localStorage.setItem(sessionsKey, JSON.stringify(updated));
      window.localStorage.setItem(currentKey, currentSessionId);
    } catch { /* ignore */ }
  }, [memoryKey, currentSessionId]);

  // Flush the save when messages actually change (write-through via ref).
  useEffect(() => {
    const sig = messages.map((m) => m.id).join(",");
    if (sig === lastSavedMsgSigRef.current) return;
    if (!memoryKey || !hasLoadedRef.current || !currentSessionId) return;
    if (typeof window === "undefined") return;
    lastSavedMsgSigRef.current = sig;
    lastMsgCountRef.current = messages.length;
    const sessionsKey = `chat:sessions:${memoryKey}`;
    const currentKey = `chat:current:${memoryKey}`;
    try {
      const raw = window.localStorage.getItem(sessionsKey);
      const stored: ChatSession[] = raw ? JSON.parse(raw) : [];
      const updated = stored.map((session) => {
        if (session.id !== currentSessionId) return session;
        return { ...session, messages, title: buildSessionTitle(messages), updatedAt: Date.now() };
      });
      window.localStorage.setItem(sessionsKey, JSON.stringify(updated));
      window.localStorage.setItem(currentKey, currentSessionId);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, memoryKey, currentSessionId]);

  useEffect(() => {
    if (!statusScrollRef.current) return;
    statusScrollRef.current.scrollTop = statusScrollRef.current.scrollHeight;
  }, [statusLog, status]);

  useEffect(() => {
    if (status !== null) return;
    if (!statusLog.length) return;
    setTimeout(() => setStatusLog([]), 0);
  }, [status, statusLog.length]);

  const handleNewChat = () => {
    // Cancel any in-flight request before switching
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setStatus(null);
    const session = createSession(defaultMessages);
    setSessions((prev) => [session, ...prev]);
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setIsHistoryOpen(false);
    setIsMenuOpen(false);
  };

  const handleSelectSession = (sessionId: string) => {
    // Cancel any in-flight request before switching chats
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setStatus(null);
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

  const updateMemory = useCallback((patch: Partial<ChatMemory>) => {
    setMemory((prev) => ({
      ...(prev ?? {}),
      ...patch,
    }));
  }, []);

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

  const buildTrimLimitMessage = () => {
    const percent = Math.round(maxTrimFraction * 100);
    const base = `${planConfig.label} plan allows trimming up to ${percent}% of the video.`;
    if (nextPlanLabel) {
      return `${base} Upgrade to ${nextPlanLabel} to trim more.`;
    }
    return base;
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
      `I found ${nextSuggestions.length} trim suggestion${nextSuggestions.length > 1 ? "s" : ""
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

  const getClipDurationForAction = (clipIndex: number | null) => {
    if (clipIndex === null || clipIndex === activeClipIndex || !multiClipFiles.length) {
      return videoContext?.duration ?? 0;
    }
    const targetFile = multiClipFiles[clipIndex];
    const targetSnapshot = targetFile
      ? multiClipSnapshots.find((snapshot) => snapshot.id === targetFile.id)
      : null;
    return targetSnapshot?.duration ?? 0;
  };

  const buildKeepCuts = (start: number, end: number, duration: number) => {
    const cuts: Array<{ start: number; end: number }> = [];
    if (start > 0) {
      cuts.push({ start: 0, end: start });
    }
    if (duration > end) {
      cuts.push({ start: end, end: duration });
    }
    return cuts.filter((segment) => segment.end - segment.start > 0.001);
  };

  const buildSilenceCuts = (
    segments: AudioSegment[],
    duration: number
  ) => {
    const removable = segments
      .filter(
        (segment) =>
          segment.category === "sfx" && segment.transcript.trim().length === 0
      )
      .map((segment) => ({ start: segment.start, end: segment.end }));

    return normalizeSegments(removable, duration).filter(
      (segment) => segment.end - segment.start > 0.001
    );
  };

  const applyActionsFromJson = (actions: ModelAction[] | undefined | null) => {
    if (!actions?.length || !onAddEdit) return 0;
    let applied = 0;
    let limitHit = false;
    const snapshotById = new Map(
      multiClipSnapshots.map((snapshot) => [snapshot.id, snapshot])
    );
    const timelineByClipIndex = new Map<number, Array<{ start: number; end: number }>>();

    const getTimelineForClip = (clipIndex: number | null) => {
      if (clipIndex === null || clipIndex === activeClipIndex || !multiClipFiles.length) {
        if (!timelineByClipIndex.has(activeClipIndex)) {
          timelineByClipIndex.set(
            activeClipIndex,
            edits.map((edit) => ({ start: edit.start, end: edit.end }))
          );
        }
        return timelineByClipIndex.get(activeClipIndex) ?? [];
      }

      if (!timelineByClipIndex.has(clipIndex)) {
        const targetFile = multiClipFiles[clipIndex];
        const targetSnapshot = targetFile
          ? snapshotById.get(targetFile.id)
          : null;
        timelineByClipIndex.set(
          clipIndex,
          (targetSnapshot?.edits ?? []).map((edit) => ({
            start: edit.start,
            end: edit.end,
          }))
        );
      }
      return timelineByClipIndex.get(clipIndex) ?? [];
    };

    const updateTimelineForClip = (
      clipIndex: number | null,
      nextTimeline: Array<{ start: number; end: number }>
    ) => {
      if (clipIndex === null || clipIndex === activeClipIndex || !multiClipFiles.length) {
        timelineByClipIndex.set(activeClipIndex, nextTimeline);
        return;
      }
      timelineByClipIndex.set(clipIndex, nextTimeline);
    };

    const canQueueTrimSegmentsForClip = (
      clipIndex: number | null,
      segments: { start: number; end: number }[]
    ) => {
      const duration = getClipDurationForAction(clipIndex);
      if (!duration || maxTrimFraction >= 1) return true;
      const timeline = getTimelineForClip(clipIndex);
      const normalized = normalizeSegments([...timeline, ...segments], duration);
      const total = normalized.reduce(
        (sum, segment) => sum + (segment.end - segment.start),
        0
      );
      const limit = duration * maxTrimFraction;
      return total <= limit + 0.001;
    };

    actions.forEach((action) => {
      const actionType = (action?.type ?? "").toLowerCase();
      const clipIndex = resolveActionClipIndex(action?.clip);
      const queueOrApplyCuts = (
        segments: Array<{ start: number; end: number }>,
        reason: string,
        targetClipIndex: number | null
      ) => {
        if (!segments.length) return;
        if (
          targetClipIndex !== null &&
          targetClipIndex !== activeClipIndex &&
          multiClipFiles.length
        ) {
          if (segments.length > 1) {
            pushSystemMessage(
              "Keep-only and silence cleanup currently work on the open clip. Open that clip and ask again."
            );
            return;
          }
          if (typeof onQueueClipTrim === "function") {
            const segment = segments[0];
            const message = onQueueClipTrim(
              targetClipIndex,
              segment.start,
              segment.end,
              reason
            );
            const timeline = getTimelineForClip(targetClipIndex);
            updateTimelineForClip(targetClipIndex, [...timeline, segment]);
            pushSystemMessage(message);
          }
          return;
        }
        if (!canQueueTrimSegmentsForClip(targetClipIndex, segments)) {
          limitHit = true;
          return;
        }
        const timeline = getTimelineForClip(targetClipIndex);
        updateTimelineForClip(targetClipIndex, [...timeline, ...segments]);
        segments.forEach((segment) => {
          onAddEdit({
            start: segment.start,
            end: segment.end,
            reason,
          });
          applied += 1;
        });
      };

      if (actionType === "undo") {
        const count = Number(action?.count) || 1;
        if (onUndoEdits) {
          onUndoEdits(count);
          pushSystemMessage(`Undoing last ${count} edit${count > 1 ? "s" : ""}.`);
          applied += 1;
        } else {
          pushSystemMessage("Undo is not supported in this view.");
        }
        return;
      }

      if (["trim", "cut", "remove", "delete"].includes(actionType)) {
        const start = Number(action?.start);
        const end = Number(action?.end);
        if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
          return;
        }
        queueOrApplyCuts(
          [{ start, end }],
          action?.reason ?? `AI ${actionType}`,
          clipIndex
        );
        return;
      }

      if (actionType === "keep") {
        const start = Number(action?.start);
        const end = Number(action?.end);
        if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
          return;
        }
        const duration = getClipDurationForAction(clipIndex);
        if (!duration || end > duration + 0.001) return;
        const keepCuts = buildKeepCuts(start, end, duration);
        queueOrApplyCuts(
          keepCuts,
          action?.reason ?? "AI keep only",
          clipIndex
        );
        return;
      }

      if (actionType === "remove_silence") {
        if (clipIndex !== null && clipIndex !== activeClipIndex && multiClipFiles.length) {
          pushSystemMessage(
            "Silence cleanup currently works on the open clip only. Open that clip and ask again."
          );
          return;
        }
        const duration = getClipDurationForAction(clipIndex);
        const silenceCuts = buildSilenceCuts(audioSegments, duration);
        if (!silenceCuts.length) {
          pushSystemMessage("I couldn't find any silent ranges to remove.");
          return;
        }
        queueOrApplyCuts(
          silenceCuts,
          action?.reason ?? "AI silence removal",
          clipIndex
        );
        return;
      }

      if (actionType === "add_audio_overlay") {
        const fileIndex = action?.audioFileIndex ?? 0;
        const file = audioFiles[fileIndex];
        if (!file) {
          pushSystemMessage(`Audio file index ${fileIndex + 1} not found.`);
          return;
        }
        const start = Number(action?.start) || 0;
        const end = Number(action?.end) || 10;
        const vol = Number(action?.volume) ?? 0.8;
        if (onAddOverlay) {
          onAddOverlay({
            file,
            videoStart: start,
            videoEnd: end,
            volume: vol,
            label: file.name
          });
          applied += 1;
        } else {
          pushSystemMessage("Audio overlays are not supported here.");
        }
        return;
      }

      if (actionType === "mute") {
        const start = Number(action?.start);
        const end = Number(action?.end);
        if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
          return;
        }
        if (onAddMute) {
          onAddMute({
            start,
            end,
            reason: action?.reason ?? "AI mute segment",
          });
          applied += 1;
        } else {
          pushSystemMessage("Muting segments is not supported in this view.");
        }
        return;
      }

      if (actionType === "export") {
        void handleExportRequest();
        return;
      }

      if (actionType === "merge_videos") {
        onActivateMerge?.();
        pushSystemMessage(
          "✅ Merge queued! The timeline now shows all clips. Click **Export Timeline** below to download the merged video."
        );
        applied += 1;
        return;
      }
    });
    if (limitHit) {
      pushSystemMessage(buildTrimLimitMessage());
    }
    return applied;
  };

  const handleExportRequest = useCallback(async () => {
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
  }, [onRequestExport, edits.length, updateMemory]);

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
    if (isProcessing) return;
    setIsProcessing(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

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

    // Filter out error/system messages and limit history to avoid overwhelming the lite model
    const relevantMessages = [...messages, userMessage].filter((msg) => {
      if (msg.sender === "system") {
        if (
          msg.text.startsWith("Error:") ||
          msg.text.includes("couldn't return a valid JSON") ||
          msg.text.includes("Welcome to the video editor") ||
          msg.text.startsWith("Applied ") ||
          msg.text.startsWith("Starting export") ||
          msg.text.startsWith("Export ")
        ) {
          return false;
        }

        if (msg.rawJson) {
          try {
            JSON.parse(msg.rawJson);
          } catch (e) {
            return false;
          }
        }
      }
      return true;
    });
    const maxHistoryMessages = 4;
    const trimmedHistory = relevantMessages.length > maxHistoryMessages
      ? relevantMessages.slice(-maxHistoryMessages)
      : relevantMessages;
    const historyForModel = trimmedHistory.map((msg) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.sender === "system" && msg.rawJson ? msg.rawJson : msg.text,
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
      const snapshotLastEdit = edits.length ? edits[edits.length - 1] : null;
      const memorySnapshot = buildMemorySummary({
        ...(memory ?? {}),
        lastIntent: currentInput.trim(),
        clipCount: edits.length,
        lastTrim: snapshotLastEdit ? { start: snapshotLastEdit.start, end: snapshotLastEdit.end } : undefined,
      });

      pushStatus("Sending context to the AI...");

      const requestBody = {
        message: currentInput,
        history: historyForModel,
        memory: memorySnapshot ? { summary: memorySnapshot } : undefined,
        multiClips:
          multiClipMode === "all" && multiClipSummaries.length
            ? multiClipSummaries
            : loadedClipsList.length
              ? loadedClipsList
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
        activeTimeline: activeTimeline.length
          ? activeTimeline.map((s) => ({ start: s.start, end: s.end }))
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
        audioFiles: audioFiles.length
          ? audioFiles.map((f, index) => ({ name: f.name, sizeBytes: f.size, index }))
          : undefined,
      };

      let data: { assistantMessage?: string; parsed?: { assistant_message?: string; status?: string; follow_up?: string; actions?: ModelAction[] }; usage?: unknown; raw?: string; tps?: number } | null = null;

      if (inferenceMode.startsWith("edge")) {
        // ─── Edge (local) path ─────────────────────────────────────────────────
        if (edgeLLM.status !== "ready") {
          throw new Error("Edge model is not loaded yet. Click the ⚡ Edge button first.");
        }
        pushStatus("Running on your device (edge inference)...");
        const edgeHistoryForModel =
          historyForModel.at(-1)?.role === "user" &&
            historyForModel.at(-1)?.content === currentInput
            ? historyForModel.slice(0, -1)
            : historyForModel;
        const edgeRes = await runEdgeChat(
          {
            message: currentInput,
            history: edgeHistoryForModel as { role: "user" | "assistant"; content: string }[],
            videoContext: videoContext
              ? {
                name: videoContext.name,
                duration: videoContext.duration,
                width: videoContext.width,
                height: videoContext.height,
                currentTime: videoContext.currentTime,
              }
              : null,
            existingCuts: edits.map((e) => ({ start: e.start, end: e.end })),
            mutedSegments: mutedSegments.map((e) => ({ start: e.start, end: e.end })),
            audioOverlays: audioOverlays.map((o) => ({
              start: o.videoStart,
              end: o.videoEnd,
              track: o.label,
            })),
            recentEdits: [],
            lastAction: "None",
          },
          edgeLLM
        );
        data = edgeRes;
      } else {
        // ─── Cloud path (original) ─────────────────────────────────────────────
        let res: Response | null = null;
        let raw = "";
        const maxParseRetries = 5;

        for (let attempt = 1; attempt <= maxParseRetries; attempt += 1) {
          console.log("AI Request:", { url: "/api/chat", attempt, payload: requestBody });

          // Abort if the user switched chat or started a new one
          if (abortController.signal.aborted) throw new Error("Request cancelled.");

          res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: abortController.signal,
          });

          raw = await res.text();
          console.log("AI Raw Response:", raw);
          try {
            data = raw ? JSON.parse(raw) : null;
          } catch (err) {
            console.error("❌ AI Response failed to parse as JSON. Raw response was:", raw, err);
            data = null;
          }

          if (!res.ok) {
            const errorMessage =
              (data as { error?: { message?: string } } | null)?.error?.message ||
              raw?.slice(0, 200) ||
              `Request failed (${res.status})`;
            throw new Error(errorMessage);
          }

          if (data) break;

          if (attempt < maxParseRetries) {
            pushStatus(`AI response was invalid JSON. Retrying (${attempt + 1}/${maxParseRetries})...`);
          }
        }

        if (!data || !res) {
          throw new Error("AI response was not valid JSON. Please try again.");
        }
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
            `Shared ${suggestionCount} trim suggestion${suggestionCount > 1 ? "s" : ""
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
        rawJson: data?.raw,
        tps: data?.tps,
      };

      setMessages((prev) => [...prev, botMessage]);
      pushStatus("Ready. Waiting for your next instruction.");
    } catch (error) {
      console.error(error);
      const isAborted =
        (error instanceof Error && error.name === "AbortError") ||
        (error instanceof Error && error.message === "Request cancelled.");
      if (!isAborted) {
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
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
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

  const lastEdit = edits.length ? edits[edits.length - 1] : null;
  const memorySummary = buildMemorySummary({
    ...(memory ?? {}),
    clipCount: edits.length,
    lastTrim: lastEdit ? { start: lastEdit.start, end: lastEdit.end } : undefined,
  });

  // Always build a lightweight clip list when 2+ files are loaded so the AI
  // can detect all clips regardless of multiClipMode or plan tier.
  // Uses allLoadedFiles (all videos, not gated by plan) for merge detection.
  const loadedClipsList = useMemo(() => {
    const files = allLoadedFiles.length >= 2 ? allLoadedFiles : multiClipFiles.length >= 2 ? multiClipFiles : [];
    if (!files.length) return [];
    // Prefer allClipSnapshots (plan-unrestricted) then fall back to multiClipSnapshots
    const allSnaps = allClipSnapshots.length ? allClipSnapshots : multiClipSnapshots;
    const snapshotMap = new Map(
      allSnaps.map((snapshot) => [snapshot.id, snapshot])
    );
    return files.map((file, index) => {
      const snapshot = snapshotMap.get(file.id);
      const duration = snapshot?.duration ? ` (${formatTime(snapshot.duration)})` : "";
      return {
        label: `Clip ${index + 1}: ${file.name}${duration}`,
        summary: snapshot?.duration
          ? `Duration: ${formatTime(snapshot.duration)}`
          : "Loaded, analyzing…",
      };
    });
  }, [allLoadedFiles, allClipSnapshots, multiClipFiles, multiClipSnapshots]);

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

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, status, scrollToBottom]);

  // ── Edge model status watcher: push in-chat notifications on state changes ──
  useEffect(() => {
    const prev = prevEdgeLLMStatusRef.current;
    const curr = edgeLLM.status;
    if (prev === curr) return;
    prevEdgeLLMStatusRef.current = curr;

    if (curr === "downloading") {
      pushSystemMessage("⏬ Downloading edge model... please wait.");
    } else if (curr === "loading") {
      pushSystemMessage("⚙️ Loading model into memory...");
    } else if (curr === "ready") {
      const formatLabel = inferenceMode === "edge-fp16"
        ? "FP16"
        : inferenceMode === "edge-fp32"
          ? "FP32"
          : "INT8";
      pushSystemMessage(`✅ Edge model (${formatLabel}) is ready! You can now chat on-device.`);
    } else if (curr === "error") {
      pushSystemMessage(`❌ Edge model failed to load: ${edgeLLM.error ?? "Unknown error"}. Switched back to Cloud.`);
      setInferenceMode("cloud");
    } else if (curr === "idle" && prev !== "idle") {
      // Model was deleted/reset
      pushSystemMessage("🗑️ Edge model removed. Switched back to Cloud.");
      setInferenceMode("cloud");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgeLLM.status]);

  const handleEdgeConfirm = (format: "int8" | "fp16" | "fp32") => {
    setInferenceMode(`edge-${format}`);
    setShowEdgeConfirm(false);
    edgeLLM.loadModel(format);
  };

  return (
    <div className="flex h-full min-h-[520px] max-h-[82vh] flex-col overflow-hidden rounded-3xl border border-zinc-800/70 bg-gradient-to-b from-zinc-900/90 via-zinc-950/95 to-zinc-950/98 backdrop-blur-2xl shadow-2xl shadow-black/40">

      {/* ── Messages Area ── */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5 overscroll-y-contain scroll-smooth bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_45%)]">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} msg={msg} />
        ))}
        <ChatTypingIndicator
          status={status}
          statusLog={statusLog}
          statusScrollRef={statusScrollRef}
        />
        <div ref={messagesEndRef} />
      </div>

      {/* ── Segment Highlights ── */}
      <SegmentHighlights
        segments={audioSegments}
        onAskAbout={(prompt) => void submitMessage(prompt)}
      />

      {/* ── Input Area ── */}
      <div className="border-t border-zinc-800/50 bg-gradient-to-r from-zinc-950/90 via-zinc-900/50 to-zinc-950/90 p-4 relative">

        {/* Menu panel */}
        {isMenuOpen && (
          <ChatMenu
            authUser={authUser}
            sessions={sessions}
            currentSessionId={currentSessionId}
            planId={planId}
            inferenceMode={inferenceMode}
            memorySummary={memorySummary}
            tokenUsage={tokenUsage}
            edgeLLM={edgeLLM}
            onNewChat={handleNewChat}
            onSelectSession={handleSelectSession}
            onLogout={handleLogout}
            onPlanSelect={onPlanSelect}
            setInferenceMode={setInferenceMode}
            setShowEdgeConfirm={setShowEdgeConfirm}
            onClose={() => setIsMenuOpen(false)}
          />
        )}

        {/* Edge model selection panel */}
        {showEdgeConfirm && (
          <EdgeConfirmPanel
            inferenceMode={inferenceMode}
            edgeLLM={edgeLLM}
            onConfirm={handleEdgeConfirm}
            onClose={() => setShowEdgeConfirm(false)}
            onDeleteModels={async () => {
              try {
                await edgeLLM.clearCache();
                edgeLLM.reset();
                if (inferenceMode.startsWith("edge")) setInferenceMode("cloud");
                setShowEdgeConfirm(false);
              } catch (e) {
                console.error("Failed to clear edge model cache.");
              }
            }}
          />
        )}

        {/* Edge model download/error banners */}
        <EdgeModelBanners
          inferenceMode={inferenceMode}
          edgeLLM={edgeLLM}
          onSwitchCloud={() => { edgeLLM.reset(); setInferenceMode("cloud"); }}
        />

        {/* Bottom input row */}
        <ChatInputBar
          input={input}
          isProcessing={isProcessing}
          isMenuOpen={isMenuOpen}
          inferenceMode={inferenceMode}
          edgeLLM={edgeLLM}
          onInputChange={setInput}
          onSubmit={handleSend}
          onCancel={() => {
            if (abortControllerRef.current) {
              abortControllerRef.current.abort();
              abortControllerRef.current = null;
            }
            setIsProcessing(false);
            setStatus(null);
          }}
          onToggleMenu={() => setIsMenuOpen((prev) => !prev)}
          onOpenEdgeConfirm={() => setShowEdgeConfirm(true)}
        />
      </div>
    </div>
  );
}
