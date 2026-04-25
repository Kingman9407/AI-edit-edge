"use client";

import React, { useMemo, useRef, useState } from "react";
import { Segment } from "@/app/backend/functions/segments";
import { PLAN_CONFIGS, PlanId } from "@/app/backend/functions/plans";

interface ExportPanelProps {
  videoFile: File | null;
  keptSegments: Segment[];
  removedSegments: Segment[];
  planId: PlanId;
  exportCount: number;
  onExportSuccess?: (planId: PlanId) => void;
  registerExporter?: (
    exporter: () => Promise<{ success: boolean; error?: string }>
  ) => void;
}

type ExportMode = "sequential" | "ai";

type ClipOrderResponse = {
  order: number[];
};

import { QualityOption, ExportWorkerMessage, ExportWorkerResponse } from "./export.worker";

const QUALITY_PRESETS: QualityOption[] = [
  { id: "fast", label: "Fast (720p)", desc: "Quick export, lower quality", bitrate: 2_500_000, maxHeight: 720, codec: "avc" },
  { id: "standard", label: "Standard (1080p)", desc: "Good balance of speed and quality", bitrate: 5_000_000, maxHeight: 1080, codec: "avc" },
  { id: "high", label: "High (Original)", desc: "Best quality, slower export", bitrate: 10_000_000, codec: "avc" }
];

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
  planId,
  exportCount,
  onExportSuccess,
  registerExporter,
}: ExportPanelProps) {
  const planConfig = PLAN_CONFIGS[planId];
  const videoFileRef = useRef<File | null>(videoFile);
  const keptSegmentsRef = useRef<Segment[]>(keptSegments);
  const removedSegmentsRef = useRef<Segment[]>(removedSegments);
  const planIdRef = useRef<PlanId>(planId);
  const exportLimitRef = useRef(planConfig.exportLimit);
  const exportCountRef = useRef(exportCount);
  const onExportSuccessRef = useRef(onExportSuccess);
  const isExportingRef = useRef(false);
  const progressRef = useRef<(pct: number, msg: string) => void>(() => {});
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trimmedUrl, setTrimmedUrl] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [exportSource, setExportSource] = useState<"clips" | "kept" | null>(
    null
  );
  const exportSourceRef = useRef<"clips" | "kept" | null>(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<QualityOption["id"]>("standard");
  const workerRef = useRef<Worker | null>(null);

  const remainingExports = Math.max(
    0,
    planConfig.exportLimit - exportCount
  );
  const limitReached =
    planConfig.exportLimit > 0 && exportCount >= planConfig.exportLimit;

  const canExport = useMemo(
    () =>
      Boolean(
        videoFile &&
          (keptSegments.length || removedSegments.length) &&
          !limitReached
      ),
    [videoFile, keptSegments.length, removedSegments.length, limitReached]
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
    exportSourceRef.current = exportSource;
  }, [exportSource]);

  const setExportingState = (value: boolean) => {
    isExportingRef.current = value;
    setIsExporting(value);
  };

  const exportVideos = React.useCallback(async () => {
    const currentVideo = videoFileRef.current;
    const currentKept = keptSegmentsRef.current;
    const currentRemoved = removedSegmentsRef.current;
    const currentPlanId = planIdRef.current;
    const limit = exportLimitRef.current;
    const count = exportCountRef.current;

    if (!currentVideo) {
      return { success: false, error: "No video loaded." };
    }
    if (isExportingRef.current) {
      return { success: false, error: "Export already running." };
    }
    if (limit > 0 && count >= limit) {
      const planLabel = PLAN_CONFIGS[currentPlanId].label;
      const errorMessage = `Export limit reached for the ${planLabel} plan.`;
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
    const selectedSource = exportSourceRef.current;
    if (!selectedSource) {
      const message = "Choose an export approach to continue.";
      setError(message);
      setShowSourcePicker(true);
      return { success: false, error: message };
    }

    const currentSegments =
      selectedSource === "clips" ? currentRemoved : currentKept;

    if (!currentSegments.length) {
      const message =
        selectedSource === "clips"
          ? "No clips to export."
          : "No kept segments to export.";
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

      let orderedSegments = currentSegments;

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

        worker.postMessage({
          type: "start",
          file: currentVideo,
          segments: orderedSegments.map(s => ({ start: s.start, end: s.end })),
          quality: qualityPreset,
          label: "sequential"
        } satisfies ExportWorkerMessage);
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      setError(message);
      setExportingState(false);
      return { success: false, error: message };
    }
  }, [selectedQuality]);

  const handleSourceSelect = React.useCallback(
    (source: "clips" | "kept") => {
      setExportSource(source);
      exportSourceRef.current = source;
      setShowSourcePicker(false);
      setError(null);
      void exportVideos();
    },
    [exportVideos]
  );

  const handleExportClick = React.useCallback(() => {
    if (!exportSourceRef.current) {
      const message = "Choose an export approach to continue.";
      setError(message);
      setShowSourcePicker(true);
      return;
    }
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
      if (trimmedUrl) {
        URL.revokeObjectURL(trimmedUrl);
      }
    };
  }, [trimmedUrl]);

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-zinc-200">Export</div>
          <div className="text-[11px] text-zinc-500">
            {planConfig.label} plan - {remainingExports} of{" "}
            {planConfig.exportLimit} exports remaining
          </div>
        </div>
        <button
          type="button"
          onClick={handleExportClick}
          disabled={!canExport || isExporting}
          className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExporting ? "Exporting..." : "Export Final Video"}
        </button>
      </div>

      {exportSource ? (
        <div className="text-[11px] text-zinc-500">
          Export approach:{" "}
          {exportSource === "clips"
            ? "Clip stack only (removed segments)"
            : "Kept timeline (remaining video)"}
        </div>
      ) : null}

      {!isExporting ? (
        <div className="space-y-4">
          <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="text-xs font-semibold text-zinc-200">
              Export Quality
            </div>
            <div className="flex flex-wrap gap-2">
              {QUALITY_PRESETS.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSelectedQuality(q.id)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                    selectedQuality === q.id
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500 text-zinc-200"
                  }`}
                  title={q.desc}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showSourcePicker && !isExporting ? (
        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="text-xs font-semibold text-zinc-200">
            Choose export approach
          </div>
          <div className="text-[11px] text-zinc-500">
            Export either the clip stack only or the remaining timeline.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSourceSelect("clips")}
              className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            >
              Clip Stack Only
            </button>
            <button
              type="button"
              onClick={() => handleSourceSelect("kept")}
              className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-500"
            >
              Kept Timeline
            </button>
          </div>
        </div>
      ) : null}

      {isExporting && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>{progressMsg || "Exporting..."}</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${Math.max(2, Math.min(progressPct, 100))}%` }}
            />
          </div>
        </div>
      )}

      {error ? <div className="text-xs text-red-400">{error}</div> : null}
      {limitReached ? (
        <div className="text-xs text-amber-400">
          Export limit reached for the {planConfig.label} plan.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <div className="text-xs font-medium text-zinc-400">Final Export</div>
          {trimmedUrl ? (
            <video
              src={trimmedUrl}
              className="w-full rounded-xl bg-black"
              controls
            />
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 p-6 text-center text-xs text-zinc-500">
              Export to generate the final video.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



