"use client";

import React, { useMemo, useRef, useState } from "react";
import { Segment } from "../../utils/segments";
import { PLAN_CONFIGS, PlanId } from "../../utils/plans";

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

type CloudinaryResult = {
  previewUrl: string;
  downloadUrl: string;
  name: string;
  clipCount: number;
  mode: ExportMode;
};

type DirectUploadResult = {
  secure_url?: string;
  url?: string;
  public_id?: string;
};

type ClipOrderResponse = {
  order: number[];
};

const MAX_SERVER_UPLOAD_BYTES = 4_000_000;

const getUnsignedCloudinaryConfig = () => {
  if (typeof window === "undefined") return null;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) return null;
  return { cloudName, uploadPreset };
};

const requestDirectUploadSignature = async (filename: string) => {
  const response = await fetch("/api/cloudinary/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename }),
  });
  const raw = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }
  if (!response.ok || !data) {
    const message =
      data?.error || raw?.slice(0, 200) || "Cloudinary signing failed.";
    throw new Error(message);
  }
  return data as {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    publicId: string;
  };
};

const uploadVideoDirect = async (file: File) => {
  try {
    const signed = await requestDirectUploadSignature(file.name);
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", signed.apiKey);
    form.append("timestamp", signed.timestamp.toString());
    form.append("signature", signed.signature);
    form.append("public_id", signed.publicId);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${signed.cloudName}/video/upload`,
      { method: "POST", body: form }
    );
    const raw = await response.text();
    let data: DirectUploadResult | null = null;
    try {
      data = JSON.parse(raw) as DirectUploadResult;
    } catch {
      data = null;
    }
    if (!response.ok || !data) {
      const message =
        (data as any)?.error?.message ||
        raw?.slice(0, 200) ||
        "Cloudinary direct upload failed.";
      throw new Error(message);
    }
    return {
      url: data.secure_url || data.url || "",
      publicId: data.public_id || signed.publicId,
    };
  } catch (error) {
    const fallback = getUnsignedCloudinaryConfig();
    if (!fallback) throw error;

    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", fallback.uploadPreset);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${fallback.cloudName}/video/upload`,
      { method: "POST", body: form }
    );
    const raw = await response.text();
    let data: DirectUploadResult | null = null;
    try {
      data = JSON.parse(raw) as DirectUploadResult;
    } catch {
      data = null;
    }
    if (!response.ok || !data) {
      const message =
        (data as any)?.error?.message ||
        raw?.slice(0, 200) ||
        "Cloudinary direct upload failed.";
      throw new Error(message);
    }
    return {
      url: data.secure_url || data.url || "",
      publicId: data.public_id || "",
    };
  }
};

const exportWithCloudinary = async (
  file: File,
  segments: Segment[],
  mode: ExportMode
): Promise<CloudinaryResult> => {
  const form = new FormData();
  const shouldDirectUpload = file.size > MAX_SERVER_UPLOAD_BYTES;
  if (shouldDirectUpload) {
    const directResult = await uploadVideoDirect(file);
    if (!directResult.url) {
      throw new Error(
        "Direct upload failed. Please check Cloudinary configuration."
      );
    }
    form.append("fileUrl", directResult.url);
    if (directResult.publicId) {
      form.append("basePublicId", directResult.publicId);
    }
    form.append("filename", file.name);
  } else {
    form.append("file", file);
  }
  form.append("segments", JSON.stringify(segments));
  form.append("mode", mode);

  const response = await fetch("/api/cloudinary/export", {
    method: "POST",
    body: form,
  });

  const raw = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 413) {
      throw new Error(
        "Upload too large for Vercel. Enable direct Cloudinary upload (set NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) or use the signed upload route."
      );
    }
    const message =
      data?.error || raw?.slice(0, 200) || "Cloudinary export failed.";
    throw new Error(message);
  }

  return data as CloudinaryResult;
};

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
  const [processingMode, setProcessingMode] = useState<ExportMode | null>(null);
  const processingModeRef = useRef<ExportMode | null>(null);
  const [showModePicker, setShowModePicker] = useState(false);
  const [exportSource, setExportSource] = useState<"clips" | "kept" | null>(
    null
  );
  const exportSourceRef = useRef<"clips" | "kept" | null>(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

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
    processingModeRef.current = processingMode;
  }, [processingMode]);

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

    const selectedMode = processingModeRef.current;
    if (!selectedMode) {
      const message = "Choose a processing mode to export.";
      setError(message);
      setShowModePicker(true);
      return { success: false, error: message };
    }

    setShowModePicker(false);
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
      if (selectedMode === "ai" && currentSegments.length > 1) {
        reportProgress(8, "Asking AI to arrange clip order...");
        try {
          const order = await fetchClipOrder(currentSegments);
          orderedSegments = applyClipOrder(currentSegments, order);
        } catch {
          orderedSegments = currentSegments;
        }
      }

      reportProgress(15, "Uploading to Cloudinary...");
      reportProgress(
        20,
        `Processing ${orderedSegments.length} segments (${selectedMode === "ai" ? "AI mode" : "sequential"})...`
      );

      let cloudResult: CloudinaryResult | null = null;
      let cloudError: string | null = null;

      try {
        cloudResult = await exportWithCloudinary(
          currentVideo,
          orderedSegments,
          selectedMode
        );
      } catch (error) {
        cloudError =
          error instanceof Error ? error.message : "Cloudinary export failed.";
      }

      if (cloudResult) {
        setTrimmedUrl(cloudResult.previewUrl);
        reportProgress(95, "Preparing download...");
        triggerDownload(cloudResult.downloadUrl, cloudResult.name);
        reportProgress(100, "Done!");
        onExportSuccessRef.current?.(currentPlanId);
        return { success: true };
      }
      const message = cloudError ?? "Cloudinary export failed.";
      setError(message);
      return { success: false, error: message };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      setError(message);
      return { success: false, error: message };
    } finally {
      setExportingState(false);
    }
  }, []);

  const handleModeSelect = React.useCallback((mode: ExportMode) => {
    setProcessingMode(mode);
    processingModeRef.current = mode;
    setShowModePicker(false);
    setShowSourcePicker(true);
    setError(null);
  }, []);

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
    if (!processingModeRef.current) {
      const message = "Choose a processing mode to export.";
      setError(message);
      setShowModePicker(true);
      return;
    }
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

      {processingMode ? (
        <div className="text-[11px] text-zinc-500">
          Processing mode:{" "}
          {processingMode === "ai" ? "AI (parallel)" : "Sequential"}
        </div>
      ) : null}

      {exportSource ? (
        <div className="text-[11px] text-zinc-500">
          Export approach:{" "}
          {exportSource === "clips"
            ? "Clip stack only (removed segments)"
            : "Kept timeline (remaining video)"}
        </div>
      ) : null}

      {showModePicker && !isExporting ? (
        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="text-xs font-semibold text-zinc-200">
            Choose processing mode
          </div>
          <div className="text-[11px] text-zinc-500">
            Sequential is more stable for long exports. AI mode runs clips in
            parallel.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleModeSelect("sequential")}
              className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-500"
            >
              Sequential (Recommended)
            </button>
            <button
              type="button"
              onClick={() => handleModeSelect("ai")}
              className="rounded-full border border-blue-500/50 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold text-blue-300 transition hover:bg-blue-500/20"
            >
              AI Mode (Parallel)
            </button>
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



