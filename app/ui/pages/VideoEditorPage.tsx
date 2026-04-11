"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useVideoPlayer } from "@/app/ui/hooks/useVideoPlayer";
import VideoUpload from "../components/VideoUpload/VideoUpload";
import VideoPlayer from "../components/VideoPlayer/VideoPlayer";
import TrimEditor from "../components/TrimEditor/TrimEditor";
import Chat from "../components/Chat/Chat";
import SegmentedPreview from "../components/SegmentedPreview/SegmentedPreview";
import EditList from "../components/EditList/EditList";
import ExportPanel from "../components/ExportPanel/ExportPanel";
import { buildKeptSegments, normalizeSegments } from "@/app/backend/functions/segments";
import MediaSidebar from "../components/MediaSidebar/MediaSidebar";
import { PLAN_CONFIGS, PLAN_ORDER, PlanId } from "@/app/backend/functions/plans";
import { formatTime } from "@/app/backend/functions/formatTime";
import { analyzeAudioFile, getVideoMetadata } from "@/app/backend/functions/mediaAnalysis";

type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type TokenSource = "chat" | "audio" | "vision";

export default function VideoEditor() {
  const [editMode, setEditMode] = useState<"single" | "multi">("single");
  const [multiAiScope, setMultiAiScope] = useState<"active" | "all">("active");
  const [planId, setPlanId] = useState<PlanId>("free");
  const planConfig = PLAN_CONFIGS[planId];
  const [exportCounts, setExportCounts] = useState<Record<PlanId, number>>({
    free: 0,
    plus: 0,
    pro: 0,
  });
  const exportCount = exportCounts[planId];
  const handleExportSuccess = useCallback((planUsed: PlanId) => {
    setExportCounts((prev) => ({
      ...prev,
      [planUsed]: prev[planUsed] + 1,
    }));
  }, []);

  const [exporter, setExporter] = useState<
    null | (() => Promise<{ success: boolean; error?: string }>)
  >(null);
  const handleRegisterExporter = useCallback(
    (exporterFn: () => Promise<{ success: boolean; error?: string }>) => {
      setExporter(() => exporterFn);
    },
    []
  );
  const [tokenUsage, setTokenUsage] = useState({
    total: 0,
    chat: 0,
    audio: 0,
    vision: 0,
  });
  const [showTokenUsage, setShowTokenUsage] = useState(true);
  const addTokenUsage = useCallback((source: TokenSource, usage?: TokenUsage | null) => {
    if (!usage) return;
    const total =
      typeof usage.total_tokens === "number"
        ? usage.total_tokens
        : (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0);
    if (!total) return;
    setTokenUsage((prev) => ({
      total: prev.total + total,
      chat: source === "chat" ? prev.chat + total : prev.chat,
      audio: source === "audio" ? prev.audio + total : prev.audio,
      vision: source === "vision" ? prev.vision + total : prev.vision,
    }));
  }, []);
  const {
    videoFile,
    videoSrc,
    isPlaying,
    duration,
    currentTime,
    volume,
    isMuted,
    trimStart,
    trimEnd,
    isEditorMode,
    videoWidth,
    videoHeight,
    audioSegments,
    audioStatus,
    audioError,
    audioProgress,
    videoInsights,
    videoInsightStatus,
    videoInsightError,
    sceneChanges,
    sceneStatus,
    sceneError,
    edits,
    videoRef,
    progressRef,
    handleFileUpload,
    loadVideoFile,
    togglePlay,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleProgressClick,
    handleVolumeChange,
    toggleMute,
    handleTrimStartChange,
    handleTrimEndChange,
    resetTrim,
    clearVideo,
    toggleEditorMode,
    requestFullscreen,
    addEdit,
    clearEdits,
    undoLastEdit,
    removeEdit,
    captureFrame,
    seekToTime,
    replaceEdits,
  } = useVideoPlayer({
    onTokenUsage: addTokenUsage,
    analysis: planConfig.analysis,
  });

  const [multiFiles, setMultiFiles] = useState<File[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const multiInputRef = useRef<HTMLInputElement | null>(null);
  const lastActiveKeyRef = useRef<string | null>(null);
  const clipSignatureRef = useRef<Record<string, string>>({});
  const [pendingClipTrim, setPendingClipTrim] = useState<{
    clipIndex: number;
    start: number;
    end: number;
    reason?: string;
  } | null>(null);
  const [clipSnapshots, setClipSnapshots] = useState<
    Record<
      string,
      {
        id: string;
        name: string;
        type: string;
        sizeBytes: number;
        duration: number;
        width: number;
        height: number;
        audioSegments: typeof audioSegments;
        audioStatus: typeof audioStatus;
        audioError: typeof audioError;
        audioProgress: number;
        videoInsights: typeof videoInsights;
        videoInsightStatus: typeof videoInsightStatus;
        videoInsightError: typeof videoInsightError;
        sceneChanges: typeof sceneChanges;
        sceneStatus: typeof sceneStatus;
        sceneError: typeof sceneError;
        edits: typeof edits;
      }
    >
  >({});
  const clipSnapshotsRef = useRef(clipSnapshots);
  const [multiAnalysisTick, setMultiAnalysisTick] = useState(0);
  const analysisInFlightRef = useRef<Set<string>>(new Set());
  const startedAnalysisRef = useRef<Set<string>>(new Set());

  const getFileKey = useCallback(
    (file: File) => `${file.name}-${file.size}-${file.lastModified}`,
    []
  );

  const areEditsEquivalent = useCallback(
    (
      left: { start: number; end: number; reason?: string }[],
      right: { start: number; end: number; reason?: string }[]
    ) => {
      if (left.length !== right.length) return false;
      for (let i = 0; i < left.length; i += 1) {
        const a = left[i];
        const b = right[i];
        if (a.start !== b.start || a.end !== b.end) return false;
        if ((a.reason ?? "") !== (b.reason ?? "")) return false;
      }
      return true;
    },
    []
  );

  useEffect(() => {
    if (editMode === "multi" && planId !== "pro") {
      setEditMode("single");
    }
  }, [editMode, planId]);

  useEffect(() => {
    if (editMode !== "multi" || planId !== "pro") {
      setMultiAiScope("active");
    }
  }, [editMode, planId]);

  useEffect(() => {
    if (editMode !== "multi") return;
    if (!multiFiles.length) {
      if (videoFile || videoSrc) {
        clearVideo();
      }
      return;
    }
    const safeIndex = Math.min(activeIndex, multiFiles.length - 1);
    if (safeIndex !== activeIndex) {
      setActiveIndex(safeIndex);
      return;
    }
    const nextFile = multiFiles[safeIndex];
    if (nextFile && nextFile !== videoFile) {
      loadVideoFile(nextFile);
    }
  }, [
    editMode,
    multiFiles,
    activeIndex,
    loadVideoFile,
    clearVideo,
    videoFile,
    videoSrc,
  ]);

  useEffect(() => {
    if (!videoFile) return;
    const id = getFileKey(videoFile);
    const isSameClip = lastActiveKeyRef.current === id;
    lastActiveKeyRef.current = id;
    const existingSnapshot = clipSnapshotsRef.current[id];
    const shouldPreserveAudio =
      editMode === "multi" &&
      existingSnapshot &&
      (existingSnapshot.audioStatus === "done" ||
        existingSnapshot.audioStatus === "error" ||
        existingSnapshot.audioStatus === "no-audio" ||
        existingSnapshot.audioStatus === "processing") &&
      (audioStatus === "idle" || audioStatus === "processing") &&
      audioSegments.length === 0;
    const nextAudioSegments = shouldPreserveAudio
      ? existingSnapshot.audioSegments
      : audioSegments;
    const nextAudioStatus = shouldPreserveAudio
      ? existingSnapshot.audioStatus
      : audioStatus;
    const nextAudioError = shouldPreserveAudio
      ? existingSnapshot.audioError
      : audioError;
    const nextAudioProgress = shouldPreserveAudio
      ? existingSnapshot.audioProgress
      : audioProgress;

    const hasExistingVisual =
      Boolean(existingSnapshot?.videoInsights.length) ||
      Boolean(existingSnapshot?.sceneChanges.length) ||
      existingSnapshot?.videoInsightStatus === "processing" ||
      existingSnapshot?.sceneStatus === "processing";
    const visualResetting =
      !videoInsights.length &&
      !sceneChanges.length &&
      (videoInsightStatus === "idle" || videoInsightStatus === "processing") &&
      (sceneStatus === "idle" || sceneStatus === "processing");
    const shouldPreserveVisual =
      editMode === "multi" && hasExistingVisual && visualResetting;
    const nextVideoInsights = shouldPreserveVisual
      ? existingSnapshot?.videoInsights ?? []
      : videoInsights;
    const nextVideoInsightStatus = shouldPreserveVisual
      ? existingSnapshot?.videoInsightStatus ?? videoInsightStatus
      : videoInsightStatus;
    const nextVideoInsightError = shouldPreserveVisual
      ? existingSnapshot?.videoInsightError ?? videoInsightError
      : videoInsightError;
    const nextSceneChanges = shouldPreserveVisual
      ? existingSnapshot?.sceneChanges ?? []
      : sceneChanges;
    const nextSceneStatus = shouldPreserveVisual
      ? existingSnapshot?.sceneStatus ?? sceneStatus
      : sceneStatus;
    const nextSceneError = shouldPreserveVisual
      ? existingSnapshot?.sceneError ?? sceneError
      : sceneError;

    const nextDuration =
      duration > 0
        ? duration
        : editMode === "multi" && existingSnapshot?.duration
        ? existingSnapshot.duration
        : duration;
    const nextWidth =
      videoWidth > 0
        ? videoWidth
        : editMode === "multi" && existingSnapshot?.width
        ? existingSnapshot.width
        : videoWidth;
    const nextHeight =
      videoHeight > 0
        ? videoHeight
        : editMode === "multi" && existingSnapshot?.height
        ? existingSnapshot.height
        : videoHeight;

    const safeEdits =
      editMode === "multi" && !isSameClip ? existingSnapshot?.edits ?? [] : edits;
    const audioSignature = nextAudioSegments
      .map(
        (segment) =>
          `${segment.start}-${segment.end}-${segment.category}-${segment.transcript.slice(
            0,
            32
          )}`
      )
      .join("|");
    const insightSignature = nextVideoInsights
      .map(
        (insight) =>
          `${insight.time}-${insight.description.slice(0, 32)}`
      )
      .join("|");
    const sceneSignature = nextSceneChanges.join("|");
    const editSignature = safeEdits
      .map(
        (edit) =>
          `${edit.start}-${edit.end}-${(edit.reason ?? "").slice(0, 32)}`
      )
      .join("|");
    const nextSignature = [
      nextDuration,
      nextWidth,
      nextHeight,
      nextAudioStatus,
      nextAudioError ?? "",
      nextAudioProgress,
      nextVideoInsightStatus,
      nextVideoInsightError ?? "",
      nextSceneStatus,
      nextSceneError ?? "",
      audioSignature,
      insightSignature,
      sceneSignature,
      editSignature,
      editMode,
    ].join("||");
    if (clipSignatureRef.current[id] === nextSignature) {
      return;
    }
    clipSignatureRef.current[id] = nextSignature;
    setClipSnapshots((prev) => {
      return {
        ...prev,
        [id]: {
          id,
          name: videoFile.name,
          type: videoFile.type,
          sizeBytes: videoFile.size,
          duration: nextDuration,
          width: nextWidth,
          height: nextHeight,
          audioSegments: nextAudioSegments,
          audioStatus: nextAudioStatus,
          audioError: nextAudioError,
          audioProgress: nextAudioProgress,
          videoInsights: nextVideoInsights,
          videoInsightStatus: nextVideoInsightStatus,
          videoInsightError: nextVideoInsightError,
          sceneChanges: nextSceneChanges,
          sceneStatus: nextSceneStatus,
          sceneError: nextSceneError,
          edits: safeEdits,
        },
      };
    });
  }, [
    videoFile,
    duration,
    videoWidth,
    videoHeight,
    audioSegments,
    audioStatus,
    audioError,
    audioProgress,
    videoInsights,
    videoInsightStatus,
    videoInsightError,
    sceneChanges,
    sceneStatus,
    sceneError,
    edits,
    getFileKey,
    editMode,
  ]);

  useEffect(() => {
    clipSnapshotsRef.current = clipSnapshots;
  }, [clipSnapshots]);

  useEffect(() => {
    if (editMode !== "multi" || !videoFile) return;
    const key = getFileKey(videoFile);
    const snapshot = clipSnapshots[key];
    if (!snapshot) {
      if (edits.length) {
        replaceEdits([]);
      }
      return;
    }
    if (snapshot.edits === edits) return;
    const snapshotEdits = snapshot.edits ?? [];
    if (areEditsEquivalent(snapshotEdits, edits)) return;
    replaceEdits(snapshotEdits);
  }, [
    editMode,
    videoFile,
    clipSnapshots,
    getFileKey,
    edits,
    replaceEdits,
    areEditsEquivalent,
  ]);

  useEffect(() => {
    if (!pendingClipTrim) return;
    const targetFile = multiFiles[pendingClipTrim.clipIndex];
    if (!targetFile || !videoFile) return;
    const targetKey = getFileKey(targetFile);
    const activeKey = getFileKey(videoFile);
    if (targetKey !== activeKey) return;
    addEdit({
      start: pendingClipTrim.start,
      end: pendingClipTrim.end,
      reason: pendingClipTrim.reason ?? "AI clip trim",
    });
    setPendingClipTrim(null);
  }, [pendingClipTrim, multiFiles, videoFile, addEdit, getFileKey]);

  useEffect(() => {
    if (editMode !== "multi") return;
    const allowed = new Set(multiFiles.map((file) => getFileKey(file)));
    setClipSnapshots((prev) => {
      const next: typeof prev = {};
      Object.entries(prev).forEach(([key, value]) => {
        if (allowed.has(key)) {
          next[key] = value;
        }
      });
      return next;
    });
  }, [editMode, multiFiles, getFileKey]);

  const startClipAnalysis = useCallback(
    async (pendingFile: File) => {
      const key = getFileKey(pendingFile);
      if (analysisInFlightRef.current.has(key)) return;
      analysisInFlightRef.current.add(key);

      const existingSnapshot = clipSnapshotsRef.current[key] ?? {
        id: key,
        name: pendingFile.name,
        type: pendingFile.type,
        sizeBytes: pendingFile.size,
        duration: 0,
        width: 0,
        height: 0,
        audioSegments: [],
        audioStatus: "idle" as const,
        audioError: null,
        audioProgress: 0,
        videoInsights: [],
        videoInsightStatus: "idle" as const,
        videoInsightError: null,
        sceneChanges: [],
        sceneStatus: "idle" as const,
        sceneError: null,
        edits: [],
      };

      setClipSnapshots((prev) => ({
        ...prev,
        [key]: {
          ...existingSnapshot,
          audioStatus: "processing",
          audioError: null,
        },
      }));

      let metadata: { duration: number; width: number; height: number } | null =
        null;
      try {
        metadata = await getVideoMetadata(pendingFile);
      } catch {
        metadata = null;
      }

      if (metadata) {
        setClipSnapshots((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            duration: metadata?.duration ?? prev[key]?.duration ?? 0,
            width: metadata?.width ?? prev[key]?.width ?? 0,
            height: metadata?.height ?? prev[key]?.height ?? 0,
          },
        }));
      }

      try {
        const audioResult = await analyzeAudioFile(pendingFile, {
          onUsage: (usage) => addTokenUsage("audio", usage),
        });

        setClipSnapshots((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            audioSegments: audioResult.segments,
            audioStatus: audioResult.status,
            audioError: audioResult.error ?? null,
            audioProgress: audioResult.status === "done" ? 1 : 0,
            duration: prev[key]?.duration ?? metadata?.duration ?? 0,
            width: prev[key]?.width ?? metadata?.width ?? 0,
            height: prev[key]?.height ?? metadata?.height ?? 0,
          },
        }));
      } catch {
        setClipSnapshots((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            audioStatus: "error",
            audioError: "Audio analysis failed",
            audioProgress: 0,
          },
        }));
      } finally {
        analysisInFlightRef.current.delete(key);
        setMultiAnalysisTick((prev) => prev + 1);
      }
    },
    [addTokenUsage, getFileKey]
  );

  useEffect(() => {
    if (editMode !== "multi" || planId !== "pro") {
      return;
    }
    const activeKeys = new Set(multiFiles.map((file) => getFileKey(file)));
    startedAnalysisRef.current.forEach((key) => {
      if (!activeKeys.has(key)) {
        startedAnalysisRef.current.delete(key);
      }
    });

    const maxConcurrent = 2;
    const inFlight = analysisInFlightRef.current;
    const pendingFiles = multiFiles.filter((file) => {
      const key = getFileKey(file);
      if (startedAnalysisRef.current.has(key)) return false;
      if (inFlight.has(key)) return false;
      return true;
    });

    if (!pendingFiles.length) return;
    const available = Math.max(0, maxConcurrent - inFlight.size);
    if (!available) return;
    pendingFiles.slice(0, available).forEach((file) => {
      const key = getFileKey(file);
      startedAnalysisRef.current.add(key);
      void startClipAnalysis(file);
    });
  }, [
    editMode,
    planId,
    multiFiles,
    getFileKey,
    startClipAnalysis,
    multiAnalysisTick,
  ]);

  const handleMultiUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith("video/")
    );
    if (!files.length) return;
    setMultiFiles((prev) => [...prev, ...files]);
    if (editMode === "multi" && !videoFile && files.length) {
      setActiveIndex(0);
    }
    event.target.value = "";
  };

  const handleSelectFile = (index: number) => {
    if (index < 0 || index >= multiFiles.length) return;
    setActiveIndex(index);
    const nextFile = multiFiles[index];
    if (nextFile) {
      loadVideoFile(nextFile);
    }
  };

  const handleRemoveFile = (index: number) => {
    setMultiFiles((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      const removed = prev[index];
      if (index === activeIndex) {
        setActiveIndex(Math.max(0, index - 1));
      } else if (index < activeIndex) {
        setActiveIndex((current) => Math.max(0, current - 1));
      }
      if (removed) {
        const key = getFileKey(removed);
        setClipSnapshots((prevSnapshots) => {
          const { [key]: _, ...rest } = prevSnapshots;
          return rest;
        });
      }
      return next;
    });
  };

  const buildTrimLimitMessage = useCallback(() => {
    const percent = Math.round(planConfig.maxTrimFraction * 100);
    const base = `${planConfig.label} plan allows trimming up to ${percent}% of the video.`;
    if (planConfig.nextPlanLabel) {
      return `${base} Upgrade to ${planConfig.nextPlanLabel} to trim more.`;
    }
    return base;
  }, [planConfig]);

  const handleQueueClipTrim = useCallback(
    (clipIndex: number, start: number, end: number, reason?: string) => {
      if (clipIndex < 0 || clipIndex >= multiFiles.length) {
        return "I couldn't find that clip in the multi-video queue.";
      }
      const targetFile = multiFiles[clipIndex];
      const key = getFileKey(targetFile);
      const snapshot = clipSnapshots[key];
      if (!snapshot || !snapshot.duration) {
        return `Open "${targetFile.name}" so I can analyze it, then ask again.`;
      }
      if (planConfig.maxTrimFraction < 1) {
        const combined = [
          ...snapshot.edits.map((edit) => ({
            start: edit.start,
            end: edit.end,
          })),
          { start, end },
        ];
        const normalized = normalizeSegments(combined, snapshot.duration);
        const total = normalized.reduce(
          (sum, segment) => sum + (segment.end - segment.start),
          0
        );
        const limit = snapshot.duration * planConfig.maxTrimFraction;
        if (total > limit + 0.001) {
          return buildTrimLimitMessage();
        }
      }
      setPendingClipTrim({ clipIndex, start, end, reason });
      setActiveIndex(clipIndex);
      loadVideoFile(targetFile);
      return `Switching to clip #${clipIndex + 1} (${targetFile.name}) and queuing trim ${formatTime(
        start
      )}-${formatTime(end)}.`;
    },
    [
      buildTrimLimitMessage,
      clipSnapshots,
      getFileKey,
      loadVideoFile,
      multiFiles,
      planConfig.maxTrimFraction,
    ]
  );

  const handleResetVideo = () => {
    if (editMode === "multi") {
      setMultiFiles([]);
      setActiveIndex(0);
      setClipSnapshots({});
    }
    clearVideo();
  };

  const multiClipFiles = editMode === "multi" && planId === "pro"
    ? multiFiles.map((file) => ({
        id: getFileKey(file),
        name: file.name,
        type: file.type,
        sizeBytes: file.size,
      }))
    : [];

  const multiClipSnapshots = editMode === "multi" && planId === "pro"
    ? Object.values(clipSnapshots)
    : [];

  const activeClipKey =
    editMode === "multi" && videoFile ? getFileKey(videoFile) : null;
  const activeSnapshot =
    activeClipKey && clipSnapshots[activeClipKey]
      ? clipSnapshots[activeClipKey]
      : null;
  const activeDuration =
    editMode === "multi" && activeSnapshot?.duration
      ? activeSnapshot.duration
      : duration;
  const activeWidth =
    editMode === "multi" && activeSnapshot?.width
      ? activeSnapshot.width
      : videoWidth;
  const activeHeight =
    editMode === "multi" && activeSnapshot?.height
      ? activeSnapshot.height
      : videoHeight;
  const activeAudioSegments =
    editMode === "multi" && activeSnapshot
      ? activeSnapshot.audioSegments
      : audioSegments;
  const activeAudioStatus =
    editMode === "multi" && activeSnapshot
      ? activeSnapshot.audioStatus ?? audioStatus
      : audioStatus;
  const activeAudioError =
    editMode === "multi" && activeSnapshot
      ? activeSnapshot.audioError ?? audioError
      : audioError;
  const activeAudioProgress =
    editMode === "multi" && activeSnapshot
      ? activeSnapshot.audioProgress ?? audioProgress
      : audioProgress;
  const activeVideoInsights =
    editMode === "multi" && activeSnapshot
      ? activeSnapshot.videoInsights
      : videoInsights;
  const activeVideoInsightStatus =
    editMode === "multi" && activeSnapshot
      ? activeSnapshot.videoInsightStatus ?? videoInsightStatus
      : videoInsightStatus;
  const activeVideoInsightError =
    editMode === "multi" && activeSnapshot
      ? activeSnapshot.videoInsightError ?? videoInsightError
      : videoInsightError;
  const activeSceneChanges =
    editMode === "multi" && activeSnapshot
      ? activeSnapshot.sceneChanges
      : sceneChanges;
  const activeSceneStatus =
    editMode === "multi" && activeSnapshot
      ? activeSnapshot.sceneStatus ?? sceneStatus
      : sceneStatus;
  const activeSceneError =
    editMode === "multi" && activeSnapshot
      ? activeSnapshot.sceneError ?? sceneError
      : sceneError;

  const normalizedEdits = normalizeSegments(
    edits.map((edit) => ({ start: edit.start, end: edit.end })),
    activeDuration
  );
  const keptSegments = buildKeptSegments(activeDuration, normalizedEdits);
  const removedSegments = normalizedEdits;

  if (!videoSrc) {
    if (editMode === "multi") {
      if (planId !== "pro") {
        return (
          <div className="flex h-screen w-full items-center justify-center bg-zinc-950 p-4">
            <div className="flex max-w-md flex-col items-center justify-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 text-center backdrop-blur-xl">
              <div className="text-xl font-semibold text-zinc-100">
                Multiple Video Editing
              </div>
              <div className="text-sm text-zinc-400">
                Multiple video editing is available on the Pro plan.
              </div>
              <button
                type="button"
                onClick={() => setEditMode("single")}
                className="rounded-full border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-blue-500 hover:text-white"
              >
                Switch to Single Video
              </button>
            </div>
          </div>
        );
      }
      return (
        <div className="flex h-screen w-full items-center justify-center bg-zinc-950 p-4">
          <div className="flex max-w-lg flex-col items-center justify-center gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center backdrop-blur-xl">
            <div className="text-2xl font-semibold text-zinc-100">
              Upload Multiple Videos
            </div>
            <p className="text-zinc-400">
              Add multiple clips and switch between them. AI will follow the
              selected video.
            </p>
            <label className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-full bg-blue-600 px-8 py-3 font-medium text-white transition-all hover:bg-blue-500 active:scale-95">
              <span>Choose Videos</span>
              <input
                ref={multiInputRef}
                type="file"
                accept="video/mp4,video/webm"
                multiple
                className="absolute inset-0 hidden"
                onChange={handleMultiUpload}
              />
            </label>
          </div>
        </div>
      );
    }
    return <VideoUpload onFileUpload={handleFileUpload} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 text-zinc-100 sm:p-8">
      <div className="mx-auto max-w-[1400px]">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-center gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-500">
              <button
                type="button"
                onClick={() => setShowTokenUsage((prev) => !prev)}
                className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-blue-500 hover:text-white"
              >
                {showTokenUsage ? "Hide Tokens" : "Show Tokens"}
              </button>
              {showTokenUsage ? (
                <>
                  <span>Tokens</span>
                  <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-zinc-200">
                    {tokenUsage.total.toLocaleString()}
                  </span>
                  <span className="text-zinc-500">Chat</span>
                  <span className="font-mono text-zinc-300">
                    {tokenUsage.chat.toLocaleString()}
                  </span>
                  <span className="text-zinc-500">Audio</span>
                  <span className="font-mono text-zinc-300">
                    {tokenUsage.audio.toLocaleString()}
                  </span>
                  <span className="text-zinc-500">Vision</span>
                  <span className="font-mono text-zinc-300">
                    {tokenUsage.vision.toLocaleString()}
                  </span>
                </>
              ) : null}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Video Editor Toolkit
            </h1>
            <p className="text-sm text-zinc-400">
              Editing: <span className="font-mono text-zinc-300">{videoFile?.name}</span>
            </p>
          </div>
          <div className="flex w-full justify-center sm:w-auto sm:flex-1">
            <div className="flex items-center rounded-full border border-zinc-800 bg-zinc-900/70 p-1 shadow-xl">
              {(["single", "multi"] as const).map((mode) => {
                const isActive = editMode === mode;
                const isProOnly = mode === "multi" && planId !== "pro";
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      if (isProOnly) return;
                      setEditMode(mode);
                    }}
                    disabled={isProOnly}
                    title={isProOnly ? "Pro plan required" : undefined}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                      isActive
                        ? "bg-emerald-500 text-white shadow"
                        : "text-zinc-300 hover:text-white"
                    } ${isProOnly ? "cursor-not-allowed opacity-50 hover:text-zinc-300" : ""}`}
                  >
                    {mode === "single" ? "Single Video" : "Multiple Video"}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
            <div className="flex items-center rounded-full border border-zinc-800 bg-zinc-900/70 p-1 shadow-xl">
              {PLAN_ORDER.map((planOption) => {
                const isActive = planOption === planId;
                return (
                  <button
                    key={planOption}
                    type="button"
                    onClick={() => setPlanId(planOption)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                      isActive
                        ? "bg-blue-600 text-white shadow"
                        : "text-zinc-300 hover:text-white"
                    }`}
                  >
                    {PLAN_CONFIGS[planOption].label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleResetVideo}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-800 hover:text-white shadow-xl hover:shadow-blue-900/20"
            >
              {editMode === "multi" ? "Clear All" : "Upload New"}
            </button>
          </div>
        </header>

        {editMode === "multi" && planId === "pro" ? (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-zinc-200">
                Multiple Video Queue
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[11px] text-zinc-400">
                  <span>AI Scope</span>
                  <div className="flex items-center rounded-full border border-zinc-700 bg-zinc-900/80 p-0.5">
                    {(["active", "all"] as const).map((scope) => {
                      const isActive = multiAiScope === scope;
                      return (
                        <button
                          key={scope}
                          type="button"
                          onClick={() => setMultiAiScope(scope)}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition ${
                            isActive
                              ? "bg-emerald-500 text-white"
                              : "text-zinc-300 hover:text-white"
                          }`}
                        >
                          {scope === "active" ? "Active" : "All Clips"}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => multiInputRef.current?.click()}
                  className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-emerald-400 hover:text-white"
                >
                  Add Videos
                </button>
                <input
                  ref={multiInputRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  multiple
                  className="hidden"
                  onChange={handleMultiUpload}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {multiFiles.length ? (
                multiFiles.map((file, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <div
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
                        isActive
                          ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                          : "border-zinc-800 bg-zinc-950/60 text-zinc-300"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectFile(index)}
                        className="max-w-[160px] truncate text-left"
                      >
                        {file.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:border-red-500 hover:text-white"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-full border border-dashed border-zinc-700 px-3 py-1.5 text-xs text-zinc-500">
                  No videos uploaded yet.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (Video + Trim Editor) - Takes up 2 columns */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <VideoPlayer
              videoRef={videoRef}
              progressRef={progressRef}
              videoSrc={videoSrc}
              isPlaying={isPlaying}
              duration={duration}
              currentTime={currentTime}
              volume={volume}
              isMuted={isMuted}
              isEditorMode={isEditorMode}
              onTogglePlay={togglePlay}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => {}}
              onProgressClick={handleProgressClick}
              onVolumeChange={handleVolumeChange}
              onToggleMute={toggleMute}
              onToggleEditorMode={toggleEditorMode}
              onRequestFullscreen={requestFullscreen}
            />

            {/* Trim Editor (only shown in editor mode) */}
            {isEditorMode && (
              <TrimEditor
                duration={duration}
                trimStart={trimStart}
                trimEnd={trimEnd}
                onTrimStartChange={handleTrimStartChange}
                onTrimEndChange={handleTrimEndChange}
                onReset={resetTrim}
              />
            )}
          </div>

          {/* Right Column (Sidebar + Chat) - Takes up 1 column */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <MediaSidebar
              planId={planId}
              videoContext={{
                name: videoFile?.name ?? "unknown",
                type: videoFile?.type ?? "unknown",
                sizeBytes: videoFile?.size ?? 0,
                duration: activeDuration,
                width: activeWidth,
                height: activeHeight,
              }}
              audioSegments={activeAudioSegments}
              audioStatus={activeAudioStatus}
              audioError={activeAudioError}
              audioProgress={activeAudioProgress}
              videoInsights={activeVideoInsights}
              videoInsightStatus={activeVideoInsightStatus}
              videoInsightError={activeVideoInsightError}
              sceneChanges={activeSceneChanges}
              sceneStatus={activeSceneStatus}
              sceneError={activeSceneError}
            />
            <div className="h-full min-h-[500px]">
             <Chat
               planId={planId}
               memoryKey={
                 videoFile
                   ? `${videoFile.name}-${videoFile.size}-${videoFile.lastModified}`
                   : undefined
               }
               multiClipMode={
                 editMode === "multi" && planId === "pro" ? multiAiScope : "active"
               }
               activeClipIndex={
                 editMode === "multi" && planId === "pro" ? activeIndex : 0
               }
               onQueueClipTrim={
                 editMode === "multi" && planId === "pro"
                   ? handleQueueClipTrim
                   : undefined
               }
               multiClipFiles={multiClipFiles}
               multiClipSnapshots={multiClipSnapshots}
               videoContext={{
                 name: videoFile?.name ?? "unknown",
                 type: videoFile?.type ?? "unknown",
                 sizeBytes: videoFile?.size ?? 0,
                 duration: activeDuration,
                 width: activeWidth,
                 height: activeHeight,
                 currentTime,
                 trimStart,
                 trimEnd,
                 isEditorMode,
               }}
               captureFrame={captureFrame}
               audioSegments={activeAudioSegments}
               audioStatus={activeAudioStatus}
               audioError={activeAudioError}
               videoInsights={activeVideoInsights}
               sceneChanges={activeSceneChanges}
              edits={edits}
              onTokenUsage={(usage) => addTokenUsage("chat", usage)}
              onRequestExport={async () => {
                if (!exporter) {
                  return {
                    success: false,
                     error: "Exporter not ready. Click Load FFmpeg & Export once.",
                   };
                 }
                 return exporter();
               }}
               onAddEdit={addEdit}
             />
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SegmentedPreview
            title="Trimmed Preview"
            videoSrc={videoSrc}
            segments={keptSegments}
            emptyLabel="No trims yet. Ask the AI to remove a segment."
          />
          <SegmentedPreview
            title="Removed Preview"
            videoSrc={videoSrc}
            segments={removedSegments}
            emptyLabel="No removed segments yet."
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <EditList
            edits={edits}
            videoSrc={videoSrc}
            previewSegments={normalizedEdits}
            planId={planId}
            onSelect={(time) => seekToTime(time, true)}
            onUndoLast={undoLastEdit}
            onRemove={removeEdit}
            onClear={clearEdits}
          />
          <ExportPanel
            videoFile={videoFile}
            keptSegments={keptSegments}
            removedSegments={removedSegments}
            planId={planId}
            exportCount={exportCount}
            onExportSuccess={handleExportSuccess}
            registerExporter={handleRegisterExporter}
          />
        </div>
      </div>
    </div>
  );
}
