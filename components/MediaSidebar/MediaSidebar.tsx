import React from "react";
import { formatTime } from "../../utils/formatTime";
import { PLAN_CONFIGS, PlanId } from "../../utils/plans";

type AudioSegment = {
  start: number;
  end: number;
  transcript: string;
  category: "speech" | "music" | "sfx";
};

type VideoContext = {
  name: string;
  type: string;
  sizeBytes: number;
  duration: number;
  width: number;
  height: number;
};

type VideoInsight = {
  time: number;
  description: string;
};

interface MediaSidebarProps {
  planId: PlanId;
  videoContext?: VideoContext;
  audioSegments?: AudioSegment[];
  audioStatus?: "idle" | "processing" | "done" | "error" | "no-audio";
  audioError?: string | null;
  audioProgress?: number;
  videoInsights?: VideoInsight[];
  videoInsightStatus?: "idle" | "processing" | "done" | "error";
  videoInsightError?: string | null;
  sceneChanges?: number[];
  sceneStatus?: "idle" | "processing" | "done" | "error";
  sceneError?: string | null;
}

const formatSize = (bytes: number) => {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
};

const buildSegmentLines = (segments: AudioSegment[], limit?: number) =>
  (typeof limit === "number" ? segments.slice(0, limit) : segments).map(
    (segment) => {
      const range = `${formatTime(segment.start)}-${formatTime(segment.end)}`;
      if (segment.category === "music") {
        return `${range} music`;
      }
      if (segment.category === "sfx") {
        return `${range} background sound`;
      }
      const text = segment.transcript.trim() || "speech";
      return `${range} ${text}`;
    }
  );

export default function MediaSidebar({
  planId,
  videoContext,
  audioSegments = [],
  audioStatus = "idle",
  audioError = null,
  audioProgress = 0,
  videoInsights = [],
  videoInsightStatus = "idle",
  videoInsightError = null,
  sceneChanges = [],
  sceneStatus = "idle",
  sceneError = null,
}: MediaSidebarProps) {
  const planConfig = PLAN_CONFIGS[planId];
  const showAudioBreakdown = planConfig.mediaBreakdown !== "locked";
  const showVisualBreakdown = planConfig.mediaBreakdown === "full";
  const speechSegments = audioSegments.filter(
    (segment) => segment.category === "speech"
  );
  const musicSegments = audioSegments.filter(
    (segment) => segment.category === "music"
  );
  const sfxSegments = audioSegments.filter(
    (segment) => segment.category === "sfx"
  );

  const speechLines = buildSegmentLines(speechSegments);
  const musicLines = buildSegmentLines(musicSegments);
  const sfxLines = buildSegmentLines(sfxSegments);
  const insightLines = videoInsights.map(
    (insight) => `${formatTime(insight.time)} ${insight.description}`
  );
  const sceneLines = sceneChanges.map((time) => formatTime(time));

  if (!showAudioBreakdown && !showVisualBreakdown) {
    return (
      <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-2xl backdrop-blur-xl">
        <div className="text-sm font-semibold text-zinc-200">Media Breakdown</div>
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 p-6 text-center text-xs text-zinc-500">
          Media breakdown is locked on the {planConfig.label} plan.
          <div className="mt-2 text-[11px] text-zinc-600">
            Upgrade to Plus to unlock audio analysis.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-2xl backdrop-blur-xl">
      <div className="text-sm font-semibold text-zinc-200">
        Media Breakdown
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Video
          </div>
          <div className="mt-2 space-y-1 text-xs text-zinc-300">
            <div>Name: {videoContext?.name ?? "—"}</div>
            <div>Type: {videoContext?.type ?? "—"}</div>
            <div>Size: {formatSize(videoContext?.sizeBytes ?? 0)}</div>
            <div>
              Duration:{" "}
              {videoContext?.duration
                ? formatTime(videoContext.duration)
                : "—"}
            </div>
            <div>
              Resolution:{" "}
              {videoContext?.width && videoContext?.height
                ? `${videoContext.width}x${videoContext.height}`
                : "—"}
            </div>
          </div>
        </div>

        {showVisualBreakdown ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <span>Video Recognition</span>
              <span className="text-zinc-400">
                {videoInsights.length} scenes
              </span>
            </div>
            <div className="mt-2 text-xs text-zinc-400">
              {videoInsightStatus === "processing" && "Analyzing frames..."}
              {videoInsightStatus === "error" &&
                (videoInsightError || "Video analysis error")}
            </div>
            <div className="mt-2 max-h-24 space-y-1 overflow-y-auto text-xs text-zinc-300">
              {insightLines.length ? (
                insightLines.map((line, index) => (
                  <div key={`video-${index}`}>{line}</div>
                ))
              ) : (
                <div className="text-zinc-500">No visual scenes yet.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 p-4 text-xs text-zinc-500">
            <div className="font-semibold uppercase tracking-wide text-zinc-500">
              Video Recognition
            </div>
            <div className="mt-2">
              Upgrade to Pro to unlock visual recognition.
            </div>
          </div>
        )}

        {showVisualBreakdown ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <span>Scene Changes</span>
              <span className="text-zinc-400">
                {sceneChanges.length} cuts
              </span>
            </div>
            <div className="mt-2 text-xs text-zinc-400">
              {sceneStatus === "processing" && "Detecting scene changes..."}
              {sceneStatus === "error" && (sceneError || "Scene analysis error")}
            </div>
            <div className="mt-2 max-h-24 space-y-1 overflow-y-auto text-xs text-zinc-300">
              {sceneLines.length ? (
                sceneLines.map((line, index) => (
                  <div key={`scene-${index}`}>{line}</div>
                ))
              ) : (
                <div className="text-zinc-500">No scene cuts detected yet.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 p-4 text-xs text-zinc-500">
            <div className="font-semibold uppercase tracking-wide text-zinc-500">
              Scene Changes
            </div>
            <div className="mt-2">
              Upgrade to Pro to unlock scene detection.
            </div>
          </div>
        )}

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <span>Speech</span>
            <span className="text-zinc-400">
              {speechSegments.length} segments
            </span>
          </div>
          <div className="mt-2 text-xs text-zinc-400">
            {audioStatus === "processing" &&
              `Analyzing audio... ${
                audioProgress > 0
                  ? `${Math.round(audioProgress * 100)}%`
                  : ""
              }`}
            {audioStatus === "no-audio" && "No audio track detected."}
            {audioStatus === "error" && (audioError || "Audio error")}
          </div>
          <div className="mt-2 max-h-24 space-y-1 overflow-y-auto text-xs text-zinc-300">
            {speechLines.length ? (
              speechLines.map((line, index) => (
                <div key={`speech-${index}`}>{line}</div>
              ))
            ) : (
              <div className="text-zinc-500">No speech segments yet.</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <span>Music</span>
            <span className="text-zinc-400">
              {musicSegments.length} segments
            </span>
          </div>
          {audioStatus === "no-audio" ? (
            <div className="mt-2 text-xs text-zinc-500">
              No music detected.
            </div>
          ) : null}
          <div className="mt-2 max-h-24 space-y-1 overflow-y-auto text-xs text-zinc-300">
            {musicLines.length ? (
              musicLines.map((line, index) => (
                <div key={`music-${index}`}>{line}</div>
              ))
            ) : (
              <div className="text-zinc-500">No music segments yet.</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <span>Background / SFX</span>
            <span className="text-zinc-400">
              {sfxSegments.length} segments
            </span>
          </div>
          {audioStatus === "no-audio" ? (
            <div className="mt-2 text-xs text-zinc-500">
              No background sounds detected.
            </div>
          ) : null}
          <div className="mt-2 max-h-24 space-y-1 overflow-y-auto text-xs text-zinc-300">
            {sfxLines.length ? (
              sfxLines.map((line, index) => (
                <div key={`sfx-${index}`}>{line}</div>
              ))
            ) : (
              <div className="text-zinc-500">No background segments yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
