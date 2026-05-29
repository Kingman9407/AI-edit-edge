"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useVideoPlayer } from "@/app/ui/hooks/useVideoPlayer";
import VideoUpload from "../components/VideoUpload/VideoUpload";
import VideoPlayer from "../components/VideoPlayer/VideoPlayer";

import Chat from "../components/Chat/Chat";
import SegmentedPreview from "../components/SegmentedPreview/SegmentedPreview";
import EditList from "../components/EditList/EditList";
import ExportPanel from "../components/ExportPanel/ExportPanel";
import { buildKeptSegments, normalizeSegments } from "@/app/backend/functions/segments";
import MediaSidebar from "../components/MediaSidebar/MediaSidebar";
import { PLAN_CONFIGS, PLAN_ORDER, PlanId } from "@/app/backend/functions/plans";
import { formatTime } from "@/app/backend/functions/formatTime";
import { analyzeAudioFile, getVideoMetadata } from "@/app/backend/functions/mediaAnalysis";
import TimelineControls from "../components/TimelineControls/TimelineControls";
import MediaLibraryDrawer from "../components/MediaLibraryDrawer/MediaLibraryDrawer";
import { Library, ChevronDown, List } from "lucide-react";
export type AudioOverlay = {
  id: string;
  file: File;
  videoStart: number;
  videoEnd: number;
  volume: number;
  label?: string;
};

type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type TokenSource = "chat" | "audio" | "vision";

type TimelineEdit = {
  id: string;
  start: number;
  end: number;
  reason?: string;
};

type ClipSnapshot = {
  id: string;
  name: string;
  type: string;
  sizeBytes: number;
  duration: number;
  width: number;
  height: number;
  audioSegments: {
    start: number;
    end: number;
    transcript: string;
    category: "speech" | "music" | "sfx";
  }[];
  audioStatus: "idle" | "processing" | "done" | "error" | "no-audio";
  audioError: string | null;
  audioProgress: number;
  videoInsights: {
    time: number;
    description: string;
  }[];
  videoInsightStatus: "idle" | "processing" | "done" | "error";
  videoInsightError: string | null;
  sceneChanges: number[];
  sceneStatus: "idle" | "processing" | "done" | "error";
  sceneError: string | null;
  edits: TimelineEdit[];
  muteEdits: TimelineEdit[];
};

export default function VideoEditor() {
  const [editMode, setEditMode] = useState<"single" | "multi">("multi");
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [mergeActive, setMergeActive] = useState(false);

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
    timelineDuration,
    timelineCurrentTime,
    isSkippingEdits,
    volume,
    isMuted,
    trimStart,
    trimEnd,

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
    handleEnded,
    handleProgressClick,
    handleVolumeChange,
    toggleMute,
    handleTrimStartChange,
    handleTrimEndChange,
    resetTrim,
    clearVideo,

    requestFullscreen,
    addEdit,
    clearEdits,
    undoLastEdit,
    removeEdit,
    captureFrame,
    seekToTime,
    replaceEdits,
    toggleIsSkippingEdits,
  } = useVideoPlayer({
    onTokenUsage: addTokenUsage,
    analysis: planConfig.analysis,
  });

  const [isBottomBarOpen, setIsBottomBarOpen] = useState(true);
  const [multiFiles, setMultiFiles] = useState<File[]>([]);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const multiInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const lastActiveKeyRef = useRef<string | null>(null);
  const lastRestoredClipKeyRef = useRef<string | null>(null);
  const clipSignatureRef = useRef<Record<string, string>>({});
  const processedPendingTrimRef = useRef<string | null>(null);
  const processedPendingMuteRef = useRef<string | null>(null);
  const [muteEdits, setMuteEdits] = useState<TimelineEdit[]>([]);
  const [audioOverlays, setAudioOverlays] = useState<AudioOverlay[]>([]);
  const [pendingClipTrim, setPendingClipTrim] = useState<{
    clipIndex: number;
    start: number;
    end: number;
    reason?: string;
  } | null>(null);
  const [pendingClipMute, setPendingClipMute] = useState<{
    clipIndex: number;
    start: number;
    end: number;
    reason?: string;
  } | null>(null);
  const [clipSnapshots, setClipSnapshots] = useState<Record<string, ClipSnapshot>>({});
  const clipSnapshotsRef = useRef(clipSnapshots);
  const [multiAnalysisTick, setMultiAnalysisTick] = useState(0);
  const analysisInFlightRef = useRef<Set<string>>(new Set());
  const startedAnalysisRef = useRef<Set<string>>(new Set());


  const getFileKey = useCallback(
    (file: File) => `${file.name}-${file.size}-${file.lastModified}`,
    []
  );

  const buildClipSnapshotSignature = useCallback(
    (snapshot: ClipSnapshot, mode: "single" | "multi") => {
      const audioSignature = snapshot.audioSegments
        .map(
          (segment) =>
            `${segment.start}-${segment.end}-${segment.category}-${segment.transcript.slice(
              0,
              32
            )}`
        )
        .join("|");
      const insightSignature = snapshot.videoInsights
        .map(
          (insight) => `${insight.time}-${insight.description.slice(0, 32)}`
        )
        .join("|");
      const sceneSignature = snapshot.sceneChanges.join("|");
      const editSignature = snapshot.edits
        .map(
          (edit) =>
            `${edit.start}-${edit.end}-${(edit.reason ?? "").slice(0, 32)}`
        )
        .join("|");
      const muteSignature = snapshot.muteEdits
        .map(
          (edit) =>
            `${edit.start}-${edit.end}-${(edit.reason ?? "").slice(0, 32)}`
        )
        .join("|");

      return [
        snapshot.duration,
        snapshot.width,
        snapshot.height,
        snapshot.audioStatus,
        snapshot.audioError ?? "",
        snapshot.audioProgress,
        snapshot.videoInsightStatus,
        snapshot.videoInsightError ?? "",
        snapshot.sceneStatus,
        snapshot.sceneError ?? "",
        audioSignature,
        insightSignature,
        sceneSignature,
        editSignature,
        muteSignature,
        mode,
      ].join("||");
    },
    []
  );

  const createTimelineEdit = useCallback(
    (start: number, end: number, reason?: string): TimelineEdit => ({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      start,
      end,
      reason,
    }),
    []
  );

  const addMuteEdit = useCallback(
    (edit: { start: number; end: number; reason?: string }) => {
      setMuteEdits((prev) => [
        ...prev,
        createTimelineEdit(edit.start, edit.end, edit.reason),
      ]);
    },
    [createTimelineEdit]
  );

  const removeMuteEdit = useCallback((id: string) => {
    setMuteEdits((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearMuteEdits = useCallback(() => setMuteEdits([]), []);

  const replaceMuteEdits = useCallback((next: TimelineEdit[]) => {
    setMuteEdits(
      next.map((edit) => ({
        id: edit.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        start: edit.start,
        end: edit.end,
        reason: edit.reason,
      }))
    );
  }, []);

  // Audio overlays CRUD
  const addAudioOverlay = useCallback((overlay: Omit<AudioOverlay, "id">) => {
    setAudioOverlays((prev) => [
      ...prev,
      { ...overlay, id: `${Date.now()}-${Math.random().toString(16).slice(2)}` },
    ]);
  }, []);

  const removeAudioOverlay = useCallback((id: string) => {
    setAudioOverlays((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const updateAudioOverlay = useCallback(
    (id: string, patch: Partial<Pick<AudioOverlay, "volume" | "videoStart" | "videoEnd">>) => {
      setAudioOverlays((prev) =>
        prev.map((o) => (o.id === id ? { ...o, ...patch } : o))
      );
    },
    []
  );

  const clearAudioOverlays = useCallback(() => setAudioOverlays([]), []);

  const handleClearAllChanges = useCallback(() => {
    clearEdits();
    clearMuteEdits();
    clearAudioOverlays();
  }, [clearAudioOverlays, clearEdits, clearMuteEdits]);

  const handleUndoLastChange = useCallback(() => {
    const toTime = (id: string) => {
      const value = Number(id.split("-")[0]);
      return Number.isFinite(value) ? value : 0;
    };

    const candidates = [
      ...edits.map((edit) => ({ type: "edit" as const, id: edit.id, time: toTime(edit.id) })),
      ...muteEdits.map((edit) => ({ type: "mute" as const, id: edit.id, time: toTime(edit.id) })),
      ...audioOverlays.map((overlay) => ({
        type: "overlay" as const,
        id: overlay.id,
        time: toTime(overlay.id),
      })),
    ];
    const latest = candidates.sort((a, b) => b.time - a.time)[0];
    if (!latest) return;

    if (latest.type === "edit") {
      undoLastEdit();
    } else if (latest.type === "mute") {
      removeMuteEdit(latest.id);
    } else {
      removeAudioOverlay(latest.id);
    }
  }, [audioOverlays, edits, muteEdits, removeAudioOverlay, removeMuteEdit, undoLastEdit]);


  useEffect(() => {
    if (editMode !== "multi" || planId !== "pro") {
      setTimeout(() => setMultiAiScope("active"), 0);
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
      setTimeout(() => setActiveIndex(safeIndex), 0);
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
    const safeMuteEdits =
      editMode === "multi" && !isSameClip ? existingSnapshot?.muteEdits ?? [] : muteEdits;
    const nextSnapshot: ClipSnapshot = {
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
      muteEdits: safeMuteEdits,
    };
    const nextSignature = buildClipSnapshotSignature(nextSnapshot, editMode);
    if (clipSignatureRef.current[id] === nextSignature) {
      return;
    }
    clipSignatureRef.current[id] = nextSignature;
    setClipSnapshots((prev) => {
      const prevSnapshot = prev[id];
      if (
        prevSnapshot &&
        buildClipSnapshotSignature(prevSnapshot, editMode) === nextSignature
      ) {
        clipSnapshotsRef.current = prev;
        return prev;
      }
      const next = {
        ...prev,
        [id]: nextSnapshot,
      };
      clipSnapshotsRef.current = next;
      return next;
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
    muteEdits,
    getFileKey,
    editMode,
    buildClipSnapshotSignature,
  ]);

  useEffect(() => {
    clipSnapshotsRef.current = clipSnapshots;
  }, [clipSnapshots]);

  useEffect(() => {
    if (editMode !== "multi" || !videoFile) {
      lastRestoredClipKeyRef.current = null;
      return;
    }
    const key = getFileKey(videoFile);
    if (lastRestoredClipKeyRef.current === key) {
      return;
    }
    lastRestoredClipKeyRef.current = key;
    const snapshot = clipSnapshotsRef.current[key];
    replaceEdits(snapshot?.edits ?? []);
    replaceMuteEdits(snapshot?.muteEdits ?? []);
  }, [editMode, videoFile, getFileKey, replaceEdits, replaceMuteEdits]);

  useEffect(() => {
    if (!pendingClipTrim) {
      processedPendingTrimRef.current = null;
      return;
    }
    const targetFile = multiFiles[pendingClipTrim.clipIndex];
    if (!targetFile || !videoFile) return;
    const targetKey = getFileKey(targetFile);
    const activeKey = getFileKey(videoFile);
    if (targetKey !== activeKey) return;
    const trimRequestKey = [
      targetKey,
      pendingClipTrim.start,
      pendingClipTrim.end,
      pendingClipTrim.reason ?? "",
    ].join("::");
    if (processedPendingTrimRef.current === trimRequestKey) return;
    processedPendingTrimRef.current = trimRequestKey;
    setPendingClipTrim(null);
    addEdit({
      start: pendingClipTrim.start,
      end: pendingClipTrim.end,
      reason: pendingClipTrim.reason ?? "AI clip trim",
    });
  }, [pendingClipTrim, multiFiles, videoFile, addEdit, getFileKey]);

  useEffect(() => {
    if (!pendingClipMute) {
      processedPendingMuteRef.current = null;
      return;
    }
    const targetFile = multiFiles[pendingClipMute.clipIndex];
    if (!targetFile || !videoFile) return;
    const targetKey = getFileKey(targetFile);
    const activeKey = getFileKey(videoFile);
    if (targetKey !== activeKey) return;
    const muteRequestKey = [
      targetKey,
      pendingClipMute.start,
      pendingClipMute.end,
      pendingClipMute.reason ?? "",
    ].join("::");
    if (processedPendingMuteRef.current === muteRequestKey) return;
    processedPendingMuteRef.current = muteRequestKey;
    setPendingClipMute(null);
    addMuteEdit({
      start: pendingClipMute.start,
      end: pendingClipMute.end,
      reason: pendingClipMute.reason ?? "AI mute segment",
    });
  }, [pendingClipMute, multiFiles, videoFile, addMuteEdit, getFileKey]);

  useEffect(() => {
    if (editMode !== "multi") return;
    const allowed = new Set(multiFiles.map((file) => getFileKey(file)));
    setTimeout(() => {
      setClipSnapshots((prev) => {
        let changed = false;
        const next: typeof prev = {};
        Object.entries(prev).forEach(([key, value]) => {
          if (allowed.has(key)) {
            next[key] = value;
          } else {
            changed = true;
          }
        });
        if (!changed && Object.keys(prev).length === Object.keys(next).length) {
          return prev;
        }
        return next;
      });
    }, 0);
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
        muteEdits: [],
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

  const handleAudioUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith("audio/") || file.type.startsWith("video/")
    );
    if (!files.length) return;
    setAudioFiles((prev) => [...prev, ...files]);
    event.target.value = "";
  };

  const handleRemoveAudioFile = (index: number) => {
    setAudioFiles((prev) => prev.filter((_, idx) => idx !== index));
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
    setAudioFiles([]);
    setMuteEdits([]);
    setAudioOverlays([]);
    clearVideo();
  };

  const handleQueueClipMute = useCallback(
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
      setPendingClipMute({ clipIndex, start, end, reason });
      setActiveIndex(clipIndex);
      loadVideoFile(targetFile);
      return `Switching to clip #${clipIndex + 1} (${targetFile.name}) and queuing mute ${formatTime(
        start
      )}-${formatTime(end)}.`;
    },
    [clipSnapshots, getFileKey, loadVideoFile, multiFiles]
  );

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

  // Build mergeModeClips: each loaded video with its kept segments for merge export
  const mergeModeClips = multiFiles.length >= 2
    ? multiFiles.map((file) => {
      const key = getFileKey(file);
      const snapshot = clipSnapshots[key];
      const clipDuration = snapshot?.duration ?? 0;
      if (!clipDuration) {
        // Duration not yet known: let the worker read the whole file
        return { file, segments: [{ start: 0, end: 1e9 }] as { start: number; end: number }[] };
      }
      const clipEdits = normalizeSegments(
        (snapshot?.edits ?? []).map((e) => ({ start: e.start, end: e.end })),
        clipDuration
      );
      const clipKept = buildKeptSegments(clipDuration, clipEdits);
      return { file, segments: clipKept.length ? clipKept : [{ start: 0, end: clipDuration }] };
    })
    : undefined;

  // Full-detail {name, originalDuration, keptSegments, removedSegments} list for merge timeline bar
  const mergeTimelineClips = mergeActive && mergeModeClips
    ? mergeModeClips.map((clip) => {
      const key = getFileKey(clip.file);
      const snapshot = clipSnapshots[key];
      const clipDuration = snapshot?.duration ?? 0;
      // keptSegments relative to the clip's own timeline
      const keptSegs = clip.segments[0]?.end === 1e9
        ? [{ start: 0, end: clipDuration }]
        : clip.segments;
      // removedSegments = gaps between kept segments
      const removed: { start: number; end: number }[] = [];
      let cursor = 0;
      for (const seg of keptSegs) {
        if (seg.start > cursor) removed.push({ start: cursor, end: seg.start });
        cursor = seg.end;
      }
      if (cursor < clipDuration) removed.push({ start: cursor, end: clipDuration });
      return {
        name: clip.file.name,
        originalDuration: clipDuration,
        keptSegments: keptSegs,
        removedSegments: removed,
      };
    })
    : undefined;

  if (!videoSrc) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 p-4">
        <div className="flex w-full max-w-2xl flex-col items-center justify-center gap-8 rounded-3xl border border-zinc-800 bg-zinc-900/30 p-12 text-center backdrop-blur-2xl shadow-2xl">
          <div className="space-y-3">
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-zinc-100">
              Welcome
            </h1>
            <p className="text-zinc-400 text-sm md:text-lg">
              Upload your media to begin your creative journey.
            </p>
          </div>

          <div className="grid w-full grid-cols-1 md:grid-cols-2 gap-6">
            {/* Video Upload Section */}
            <div className="flex flex-col items-center gap-4 p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:border-blue-500/50 transition-colors">
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" /><rect width="12" height="10" x="2" y="7" rx="2" /></svg>
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-zinc-200 text-lg">Video Clips</h3>
                <p className="text-xs text-zinc-500">MP4, WebM supported</p>
              </div>
              <label className="cursor-pointer inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-500 active:scale-95 shadow-lg shadow-blue-600/20">
                <span>Add Videos</span>
                <input
                  ref={multiInputRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  multiple
                  className="hidden"
                  onChange={handleMultiUpload}
                />
              </label>
            </div>

            {/* Audio Upload Section */}
            <div className="flex flex-col items-center gap-4 p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:border-purple-500/50 transition-colors">
              <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-zinc-200 text-lg">Audio Assets</h3>
                <p className="text-xs text-zinc-500">MP3, WAV, Background Music</p>
              </div>
              <label className="cursor-pointer inline-flex items-center justify-center rounded-full bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-purple-500 active:scale-95 shadow-lg shadow-purple-600/20">
                <span>Add Audio</span>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  className="hidden"
                  onChange={handleAudioUpload}
                />
              </label>
            </div>
          </div>

          {(multiFiles.length > 0 || audioFiles.length > 0) && (
            <div className="w-full space-y-4 pt-4 border-t border-zinc-800">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-zinc-400">Queue</h4>
                <span className="text-xs text-zinc-500">
                  {multiFiles.length} videos, {audioFiles.length} audio files
                </span>
              </div>

              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {multiFiles.map((f, i) => (
                  <div key={`v-${i}`} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
                    <span className="opacity-60 font-bold mr-1">#{i + 1}</span>
                    <span className="truncate max-w-[120px]">{f.name}</span>
                    <button onClick={() => handleRemoveFile(i)} className="hover:text-blue-200">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                  </div>
                ))}
                {audioFiles.map((f, i) => (
                  <div key={`a-${i}`} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-400">
                    <span className="opacity-60 font-bold mr-1">#{i + 1}</span>
                    <span className="truncate max-w-[120px]">{f.name}</span>
                    <button onClick={() => handleRemoveAudioFile(i)} className="hover:text-purple-200">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-5 md:p-2 md:pt-10 pb-48">
      <div className="mx-auto max-w-[1400px]">
        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (Video + Trim Editor) - Takes up 2 columns */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="space-y-4">
              <VideoPlayer
                videoRef={videoRef}
                progressRef={progressRef}
                videoSrc={videoSrc}
                isPlaying={isPlaying}
                duration={duration}
                currentTime={currentTime}
                timelineDuration={timelineDuration}
                timelineCurrentTime={timelineCurrentTime}
                volume={volume}
                isMuted={isMuted}
                onTogglePlay={togglePlay}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                onProgressClick={handleProgressClick}
                onVolumeChange={handleVolumeChange}
                onToggleMute={toggleMute}
                onRequestFullscreen={requestFullscreen}
                audioOverlays={audioOverlays}
              />

              <TimelineControls
                progressRef={progressRef}
                currentTime={currentTime}
                duration={duration}
                timelineCurrentTime={timelineCurrentTime}
                timelineDuration={timelineDuration}
                edits={edits}
                isSkippingEdits={isSkippingEdits}
                toggleIsSkippingEdits={toggleIsSkippingEdits}
                onProgressClick={handleProgressClick}
                mergeActive={mergeActive}
                mergeClips={mergeTimelineClips}
              />
            </div>
          </div>

          {/* Right Column (Sidebar + Chat) - Takes up 1 column */}
          <div className="lg:col-span-1 flex flex-col gap-6">
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
                onQueueClipMute={
                  editMode === "multi" && planId === "pro"
                    ? handleQueueClipMute
                    : undefined
                }
                multiClipFiles={multiClipFiles}
                multiClipSnapshots={multiClipSnapshots}
                allLoadedFiles={multiFiles.map((file) => ({
                  id: getFileKey(file),
                  name: file.name,
                  type: file.type,
                  sizeBytes: file.size,
                }))}
                allClipSnapshots={Object.values(clipSnapshots)}
                audioFiles={audioFiles}
                onAddOverlay={addAudioOverlay}
                tokenUsage={tokenUsage}
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
                  isEditorMode: true,
                }}
                captureFrame={captureFrame}
                audioSegments={activeAudioSegments}
                audioStatus={activeAudioStatus}
                audioError={activeAudioError}
                videoInsights={activeVideoInsights}
                sceneChanges={activeSceneChanges}
                edits={edits}
                mutedSegments={muteEdits}
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
                onAddMute={addMuteEdit}
                onPlanSelect={setPlanId}
                activeTimeline={keptSegments}
                onActivateMerge={() => setMergeActive(true)}
              />
            </div>
          </div>
        </div>

      </div>

      {/* Collapsible Clip Stack bar */}
      <div className={`fixed bottom-0 inset-x-0 z-50 transform transition-transform duration-500 ease-out ${isBottomBarOpen ? "translate-y-0" : "translate-y-full"}`}>
        {/* Toggle Button (Attached to top edge) */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[-1px]">
          <button
            onClick={() => setIsBottomBarOpen(!isBottomBarOpen)}
            className="flex items-center gap-2 rounded-t-2xl bg-zinc-950/90 border-x border-t border-zinc-700/60 px-6 py-2 text-xs font-bold text-zinc-300 shadow-2xl backdrop-blur-xl transition-all hover:bg-zinc-900 hover:text-white group"
          >
            <List size={16} className="text-emerald-500 group-hover:scale-110 transition-transform" />
            <span className="tracking-widest uppercase text-[10px] text-zinc-400 group-hover:text-zinc-200 transition-colors">Clip Stack</span>
            <div className={`transform transition-transform duration-500 ${isBottomBarOpen ? "rotate-0" : "rotate-180"}`}>
              <ChevronDown size={14} className="text-zinc-500 ml-1" />
            </div>
          </button>
        </div>

        <div className="border-t border-zinc-700/60 bg-zinc-950/90 backdrop-blur-xl shadow-2xl shadow-black/50">
          <div className="mx-auto max-w-[1400px] px-2 py-3">
            <EditList
              edits={edits}
              activeTimeline={keptSegments}
              videoSrc={videoSrc}
              planId={planId}
              onSelect={(time) => seekToTime(time, true)}
              onUndoLast={handleUndoLastChange}
              onRemove={removeEdit}
              onClear={handleClearAllChanges}
              mutedSegments={muteEdits}
              audioOverlays={audioOverlays.map((o) => ({
                id: o.id,
                label: o.label,
                videoStart: o.videoStart,
                videoEnd: o.videoEnd,
                volume: o.volume,
              }))}
              onRemoveMute={removeMuteEdit}
              onRemoveAudioOverlay={removeAudioOverlay}
              onUpdateAudioOverlayVolume={(id, volume) =>
                updateAudioOverlay(id, { volume })
              }
              exportNode={
                <ExportPanel
                  videoFile={videoFile}
                  keptSegments={keptSegments}
                  removedSegments={removedSegments}
                  mutedSegments={muteEdits.map((e) => ({ start: e.start, end: e.end }))}
                  audioOverlays={audioOverlays.map((o) => ({
                    file: o.file,
                    videoStart: o.videoStart,
                    videoEnd: o.videoEnd,
                    volume: o.volume,
                  }))}
                  planId={planId}
                  exportCount={exportCount}
                  onExportSuccess={handleExportSuccess}
                  registerExporter={handleRegisterExporter}
                  mergeModeClips={mergeModeClips}
                  mergeActive={mergeActive}
                />
              }
            />
          </div>
        </div>
      </div>

      <MediaLibraryDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOpen={() => setIsDrawerOpen(true)}
        multiFiles={multiFiles}
        audioFiles={audioFiles}
        activeIndex={activeIndex}
        onSelectFile={handleSelectFile}
        onRemoveFile={handleRemoveFile}
        onRemoveAudioFile={handleRemoveAudioFile}
        onAddVideo={handleMultiUpload}
        onAddAudio={handleAudioUpload}
      />
    </div>
  );
}
