"use client";

import React, { useMemo, useRef, useState } from "react";
import { Segment } from "@/app/backend/functions/segments";
import { PLAN_CONFIGS, PlanId } from "@/app/backend/functions/plans";

/** Shape coming from the parent (VideoEditorPage) — contains raw File objects */
type AudioOverlayInput = {
  file: File;
  videoStart: number;
  videoEnd: number;
  volume: number;
};

interface ExportPanelProps {
  videoFile: File | null;
  keptSegments: Segment[];
  removedSegments: Segment[];
  mutedSegments?: MutedSegment[];
  audioOverlays?: AudioOverlayInput[];
  planId: PlanId;
  exportCount: number;
  onExportSuccess?: (planId: PlanId) => void;
  registerExporter?: (
    exporter: () => Promise<{ success: boolean; error?: string }>
  ) => void;
  /** When provided (>=2 clips), enables merge export */
  mergeModeClips?: MergeClip[];
  /** When true, Export Timeline runs the merge export instead of single-clip export */
  mergeActive?: boolean;
}

type ExportMode = "sequential" | "ai";

type ClipOrderResponse = {
  order: number[];
};

import {
  QualityOption,
  ExportWorkerMessage,
  ExportWorkerResponse,
  MutedSegment,
  DecodedPCM,
  AudioOverlayPCM,
  MergeClip,
} from "./export.worker";


const QUALITY_PRESETS: QualityOption[] = [
  { id: "fast", label: "Fast (720p)", desc: "Quick export, lower quality", bitrate: 2_500_000, maxHeight: 720, codec: "avc" },
  { id: "standard", label: "Standard (1080p)", desc: "Good balance of speed and quality", bitrate: 5_000_000, maxHeight: 1080, codec: "avc" },
  { id: "high", label: "High (Original)", desc: "Best quality, slower export", bitrate: 10_000_000, codec: "avc" }
];

const DECODE_SAMPLE_RATE = 44100;

/**
 * Decode an audio/video File to raw PCM Float32Array channels on the main thread.
 * Uses OfflineAudioContext which IS available on the main thread.
 */
async function decodeFileToPCM(
  file: File,
  targetSampleRate = DECODE_SAMPLE_RATE
): Promise<DecodedPCM | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    if (typeof OfflineAudioContext === "undefined") {
      console.warn("[ExportPanel] OfflineAudioContext not available");
      return null;
    }

    // Decode the audio data
    const probeCtx = new OfflineAudioContext(1, 1, targetSampleRate);
    let decoded: AudioBuffer;
    try {
      decoded = await new Promise<AudioBuffer>((resolve, reject) => {
        const promise = probeCtx.decodeAudioData(
          arrayBuffer.slice(0),
          (buffer: AudioBuffer) => resolve(buffer),
          (error: DOMException) => reject(error)
        );
        if (promise && typeof promise.catch === "function") {
          promise.catch(reject);
        }
      });
    } catch (e) {
      console.warn("[ExportPanel] decodeAudioData failed:", e);
      return null;
    }

    // Resample to target sample rate
    const numCh = decoded.numberOfChannels;
    const numSamples = Math.ceil(decoded.duration * targetSampleRate);
    const offCtx = new OfflineAudioContext(numCh, numSamples, targetSampleRate);
    const src = offCtx.createBufferSource();
    src.buffer = decoded;
    src.connect(offCtx.destination);
    src.start(0);
    const resampled = await offCtx.startRendering();

    // Extract channels as Float32Arrays
    const channels: Float32Array[] = [];
    for (let ch = 0; ch < resampled.numberOfChannels; ch++) {
      // Copy the channel data so we can transfer ownership to the worker
      channels.push(new Float32Array(resampled.getChannelData(ch)));
    }

    return {
      channels,
      sampleRate: resampled.sampleRate,
      numberOfChannels: resampled.numberOfChannels,
      length: resampled.length,
      duration: resampled.duration,
    };
  } catch (err) {
    console.warn("[ExportPanel] decodeFileToPCM error:", err);
    return null;
  }
}

const fetchClipOrder = async (segments: Segment[]): Promise<number[]> => {
  if (segments.length < 2) return [];
  const response = await fetch("/api/clip-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segments }),
  });
  const raw = await response.text();
  let data: ClipOrderResponse | null = null;
  try {
    data = JSON.parse(raw) as ClipOrderResponse;
  } catch {
    data = null;
  }
  if (!response.ok || !data || !Array.isArray(data.order)) {
    return [];
  }
  return data.order;
};

const applyClipOrder = (segments: Segment[], order: number[]) => {
  if (!order.length) return segments;
  const result: Segment[] = [];
  const seen = new Set<number>();
  order.forEach((value) => {
    const index = Math.round(Number(value)) - 1;
    if (!Number.isFinite(index)) return;
    if (index < 0 || index >= segments.length) return;
    if (seen.has(index)) return;
    seen.add(index);
    result.push(segments[index]);
  });
  if (result.length < segments.length) {
    segments.forEach((segment, index) => {
      if (!seen.has(index)) result.push(segment);
    });
  }
  return result;
};

const triggerDownload = (url: string, name: string) => {
  if (typeof window === "undefined") return;
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export default function ExportPanel({
  videoFile,
  keptSegments,
  removedSegments,
  mutedSegments = [],
  audioOverlays = [],
  planId,
  exportCount,
  onExportSuccess,
  registerExporter,
  mergeModeClips,
  mergeActive = false,
}: ExportPanelProps) {
  const planConfig = PLAN_CONFIGS[planId];
  const videoFileRef = useRef<File | null>(videoFile);
  const keptSegmentsRef = useRef<Segment[]>(keptSegments);
  const removedSegmentsRef = useRef<Segment[]>(removedSegments);
  const mutedSegmentsRef = useRef<MutedSegment[]>(mutedSegments);
  const audioOverlaysRef = useRef<AudioOverlayInput[]>(audioOverlays);
  const mergeModeClipsRef = useRef<MergeClip[] | undefined>(mergeModeClips);
  const planIdRef = useRef<PlanId>(planId);
  const exportLimitRef = useRef(planConfig.exportLimit);
  const exportCountRef = useRef(exportCount);
  const onExportSuccessRef = useRef(onExportSuccess);
  const isExportingRef = useRef(false);
  const progressRef = useRef<(pct: number, msg: string) => void>(() => {});
  const [isExporting, setIsExporting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const isMergingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [trimmedUrl, setTrimmedUrl] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [mergeProgressMsg, setMergeProgressMsg] = useState("");
  const [mergeProgressPct, setMergeProgressPct] = useState(0);
  const [exportSource, setExportSource] = useState<"kept">("kept");
  const exportSourceRef = useRef<"kept">("kept");
  const [selectedQuality, setSelectedQuality] = useState<QualityOption["id"]>("standard");
  const workerRef = useRef<Worker | null>(null);
  const mergeWorkerRef = useRef<Worker | null>(null);


  const remainingExports = Math.max(
    0,
    planConfig.exportLimit - exportCount
  );
  const limitReached = false;

  const canExport = useMemo(
    () =>
      Boolean(
        videoFile &&
          (keptSegments.length || removedSegments.length || audioOverlays.length) &&
          !limitReached
      ),
    [videoFile, keptSegments.length, removedSegments.length, audioOverlays.length, limitReached]
  );

  React.useEffect(() => {
    videoFileRef.current = videoFile;
  }, [videoFile]);

  React.useEffect(() => {
    planIdRef.current = planId;
    exportLimitRef.current = planConfig.exportLimit;
  }, [planId, planConfig.exportLimit]);

  React.useEffect(() => {
    exportCountRef.current = exportCount;
  }, [exportCount]);

  React.useEffect(() => {
    onExportSuccessRef.current = onExportSuccess;
  }, [onExportSuccess]);

  React.useEffect(() => {
    keptSegmentsRef.current = keptSegments;
  }, [keptSegments]);

  React.useEffect(() => {
    removedSegmentsRef.current = removedSegments;
  }, [removedSegments]);

  React.useEffect(() => {
    mutedSegmentsRef.current = mutedSegments;
  }, [mutedSegments]);

  React.useEffect(() => {
    audioOverlaysRef.current = audioOverlays;
  }, [audioOverlays]);

  React.useEffect(() => {
    mergeModeClipsRef.current = mergeModeClips;
  }, [mergeModeClips]);

  React.useEffect(() => {
    exportSourceRef.current = exportSource;
  }, [exportSource]);

  const setExportingState = (value: boolean) => {
    isExportingRef.current = value;
    setIsExporting(value);
  };

  const exportVideos = React.useCallback(async () => {
    const currentVideo = videoFileRef.current;
    const currentKept = keptSegmentsRef.current;
    const currentPlanId = planIdRef.current;
    const limit = exportLimitRef.current;
    const count = exportCountRef.current;

    if (!currentVideo) {
      return { success: false, error: "No video loaded." };
    }
    if (isExportingRef.current) {
      return { success: false, error: "Export already running." };
    }
    // Export limit check removed
    const currentSegments = currentKept;

    if (!currentSegments.length) {
      const message = "No timeline clips to export.";
      setError(message);
      return { success: false, error: message };
    }

    setError(null);
    setExportingState(true);
    setTrimmedUrl(null);
    setProgressPct(0);
    setProgressMsg("");

    try {
      const reportProgress = (pct: number, msg: string) => {
        setProgressPct(pct);
        setProgressMsg(msg);
      };
      progressRef.current = reportProgress;

      const orderedSegments = currentSegments;
      const currentOverlays = audioOverlaysRef.current;
      const currentMuted = mutedSegmentsRef.current;
      const needsMixing = currentOverlays.length > 0 || currentMuted.length > 0;

      // ── Pre-decode audio on the main thread if mixing is needed ──
      const nativeAudioPCM: DecodedPCM | null = null;
      const audioOverlaysPCM: AudioOverlayPCM[] = [];
      const transferables: Transferable[] = [];

      if (needsMixing) {
        reportProgress(3, "Preparing modified audio…");

        // Decode overlay audio files
        for (let i = 0; i < currentOverlays.length; i++) {
          const ov = currentOverlays[i];
          reportProgress(5, `Decoding overlay audio ${i + 1}/${currentOverlays.length}…`);
          console.log(`[ExportPanel] Decoding overlay ${i + 1}: ${ov.file.name}`);
          const pcm = await decodeFileToPCM(ov.file);
          if (pcm) {
            const naturalEnd = ov.videoStart + pcm.duration;
            pcm.channels.forEach((ch) => transferables.push(ch.buffer));
            audioOverlaysPCM.push({
              pcm,
              videoStart: ov.videoStart,
              videoEnd: Math.min(ov.videoEnd, naturalEnd),
              volume: ov.volume,
            });
            console.log(`[ExportPanel] Overlay ${i + 1} decoded: ${pcm.duration.toFixed(2)}s`);
          } else {
            console.warn(`[ExportPanel] Overlay ${i + 1} decode failed, skipping`);
          }
        }
      }

      reportProgress(10, "Initializing local Web Worker...");
      
      const worker = new Worker(new URL("./export.worker.ts", import.meta.url));
      workerRef.current = worker;

      const qualityPreset = QUALITY_PRESETS.find(q => q.id === selectedQuality) || QUALITY_PRESETS[1];

      return new Promise<{ success: boolean; error?: string }>((resolve) => {
        worker.onmessage = (event: MessageEvent<ExportWorkerResponse>) => {
          const msg = event.data;
          if (msg.type === "progress") {
            reportProgress(msg.percent, msg.message);
          } else if (msg.type === "done") {
            const url = URL.createObjectURL(msg.blob);
            setTrimmedUrl(url);
            triggerDownload(url, msg.name);
            reportProgress(100, "Done!");
            onExportSuccessRef.current?.(currentPlanId);
            setExportingState(false);
            resolve({ success: true });
          } else if (msg.type === "error") {
            setError(msg.error);
            setExportingState(false);
            resolve({ success: false, error: msg.error });
          }
        };

        worker.onerror = (error) => {
          const errMsg = "Worker error: " + error.message;
          setError(errMsg);
          setExportingState(false);
          resolve({ success: false, error: errMsg });
        };

        const message: ExportWorkerMessage = {
          type: "start",
          file: currentVideo,
          segments: orderedSegments.map(s => ({ start: s.start, end: s.end })),
          quality: qualityPreset,
          label: "sequential",
          mutedSegments: currentMuted,
          audioOverlaysPCM: needsMixing ? audioOverlaysPCM : undefined,
          nativeAudioPCM: needsMixing ? nativeAudioPCM : undefined,
        };

        // Transfer Float32Array buffers to avoid copying (zero-copy)
        worker.postMessage(message, transferables);
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      setError(message);
      setExportingState(false);
      return { success: false, error: message };
    }
  }, [selectedQuality]);

  const exportMerged = React.useCallback(async () => {
    const clips = mergeModeClipsRef.current;
    if (!clips || clips.length < 2) {
      return { success: false, error: "Need at least 2 clips to merge." };
    }
    if (isMergingRef.current) {
      return { success: false, error: "Merge already running." };
    }
    isMergingRef.current = true;
    setIsMerging(true);
    setMergeError(null);
    setMergeProgressPct(0);
    setMergeProgressMsg("");

    try {
      const qualityPreset = QUALITY_PRESETS.find(q => q.id === selectedQuality) || QUALITY_PRESETS[1];
      const firstName = clips[0].file.name.replace(/\.[^.]+$/, "");
      const outputName = `${firstName}_merged.mp4`;

      const worker = new Worker(new URL("./export.worker.ts", import.meta.url));
      mergeWorkerRef.current = worker;

      return new Promise<{ success: boolean; error?: string }>((resolve) => {
        worker.onmessage = (event: MessageEvent<ExportWorkerResponse>) => {
          const msg = event.data;
          if (msg.type === "progress") {
            setMergeProgressPct(msg.percent);
            setMergeProgressMsg(msg.message);
          } else if (msg.type === "done") {
            const url = URL.createObjectURL(msg.blob);
            triggerDownload(url, msg.name);
            URL.revokeObjectURL(url);
            setMergeProgressPct(100);
            setMergeProgressMsg("Merged!");
            isMergingRef.current = false;
            setIsMerging(false);
            worker.terminate();
            resolve({ success: true });
          } else if (msg.type === "error") {
            setMergeError(msg.error);
            isMergingRef.current = false;
            setIsMerging(false);
            worker.terminate();
            resolve({ success: false, error: msg.error });
          }
        };
        worker.onerror = (e) => {
          const errMsg = "Merge worker error: " + e.message;
          setMergeError(errMsg);
          isMergingRef.current = false;
          setIsMerging(false);
          worker.terminate();
          resolve({ success: false, error: errMsg });
        };

        worker.postMessage({
          type: "merge",
          clips,
          quality: qualityPreset,
          label: "merge",
          outputName,
        } satisfies ExportWorkerMessage);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Merge failed";
      setMergeError(msg);
      isMergingRef.current = false;
      setIsMerging(false);
      return { success: false, error: msg };
    }
  }, [selectedQuality]);

  const handleExportClick = React.useCallback(() => {
    setExportSource("kept");
    exportSourceRef.current = "kept";
    setError(null);
    void exportVideos();
  }, [exportVideos]);

  React.useEffect(() => {
    if (registerExporter) {
      registerExporter(exportVideos);
    }
  }, [registerExporter, exportVideos]);

  React.useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      if (mergeWorkerRef.current) {
        mergeWorkerRef.current.terminate();
      }
      if (trimmedUrl) {
        URL.revokeObjectURL(trimmedUrl);
      }
    };
  }, [trimmedUrl]);

  const canMerge = (mergeModeClips?.length ?? 0) >= 2 && !isMerging && !isExporting;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Export / Merge button — switches mode based on mergeActive */}
      {isExporting ? (
        <span className="text-xs font-semibold text-blue-400">
          Exporting {Math.round(progressPct)}%...
        </span>
      ) : isMerging ? (
        <span className="text-xs font-semibold text-purple-400 flex items-center gap-1">
          <span className="animate-pulse">⚡</span>
          Merging {Math.round(mergeProgressPct)}%{mergeProgressMsg ? `… ${mergeProgressMsg}` : ""}
        </span>
      ) : (
        <button
          type="button"
          onClick={mergeActive ? () => void exportMerged() : handleExportClick}
          disabled={mergeActive ? !canMerge : (!canExport || isExporting || isMerging)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
            mergeActive
              ? "bg-purple-600/80 hover:bg-purple-500"
              : "bg-blue-600/80 hover:bg-blue-500"
          }`}
        >
          {mergeActive ? "Export Merged" : "Export Timeline"}
        </button>
      )}

      {error && <span className="text-[10px] text-red-400 truncate max-w-[150px]" title={error}>{error}</span>}
      {mergeError && <span className="text-[10px] text-red-400 truncate max-w-[150px]" title={mergeError}>{mergeError}</span>}
      {limitReached && <span className="text-[10px] text-amber-400">Limit reached</span>}
    </div>
  );
}
