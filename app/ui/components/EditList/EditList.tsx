import React from "react";
import { formatTime } from "@/app/backend/functions/formatTime";
import SegmentedPreview from "../SegmentedPreview/SegmentedPreview";
import { PLAN_CONFIGS, PlanId } from "@/app/backend/functions/plans";

type EditSegment = {
  id: string;
  start: number;
  end: number;
  reason?: string;
};

interface EditListProps {
  edits: EditSegment[];
  videoSrc?: string;
  previewSegments?: { start: number; end: number }[];
  planId: PlanId;
  onSelect?: (time: number) => void;
  onUndoLast: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

const ClipPreview = ({
  videoSrc,
  start,
  index,
}: {
  videoSrc: string;
  start: number;
  index: number;
}) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleLoaded = () => {
      video.currentTime = Math.max(0, start);
      video.pause();
    };
    const handleSeeked = () => {
      video.pause();
    };
    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("seeked", handleSeeked);
    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("seeked", handleSeeked);
    };
  }, [start, videoSrc]);

  return (
    <div className="relative h-20 w-32 overflow-hidden rounded-lg border border-zinc-800 bg-black">
      <video
        ref={videoRef}
        src={videoSrc}
        muted
        preload="metadata"
        className="h-full w-full object-cover"
      />
      <div className="absolute left-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
        {index + 1}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[10px] text-zinc-200">
        {formatTime(start)}
      </div>
    </div>
  );
};

export default function EditList({
  edits,
  videoSrc,
  previewSegments = [],
  planId,
  onSelect,
  onUndoLast,
  onRemove,
  onClear,
}: EditListProps) {
  const freeLimit = Math.round(PLAN_CONFIGS.free.maxTrimFraction * 100);
  const plusLimit = Math.round(PLAN_CONFIGS.plus.maxTrimFraction * 100);
  const proLimit = Math.round(PLAN_CONFIGS.pro.maxTrimFraction * 100);
  return (
    <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-zinc-200">Clip Stack</div>
          <div className="text-[11px] text-zinc-500">
            Trim limit:{" "}
            <span className={planId === "free" ? "text-zinc-200" : ""}>
              {freeLimit}%
            </span>{" "}
            /{" "}
            <span className={planId === "plus" ? "text-zinc-200" : ""}>
              {plusLimit}%
            </span>{" "}
            /{" "}
            <span className={planId === "pro" ? "text-zinc-200" : ""}>
              {proLimit}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUndoLast}
            disabled={!edits.length}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Undo Last Trim
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!edits.length}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div>
          {edits.length ? (
            <div className="space-y-2">
              {edits.map((edit, index) => (
                <div
                  key={edit.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect?.(edit.start)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect?.(edit.start);
                    }
                  }}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-300 transition hover:border-blue-500 hover:bg-zinc-900/60 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    {videoSrc ? (
                      <ClipPreview
                        videoSrc={videoSrc}
                        start={edit.start}
                        index={index}
                      />
                    ) : null}
                    <div className="space-y-1">
                      <div className="font-semibold text-zinc-200">
                        Clip #{index + 1}: {formatTime(edit.start)} -{" "}
                        {formatTime(edit.end)}
                      </div>
                      {edit.reason ? (
                        <div className="text-zinc-500">{edit.reason}</div>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(edit.id);
                    }}
                    className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:border-red-500 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 p-6 text-center text-sm text-zinc-500">
              No trims yet. Ask the AI to remove a segment.
            </div>
          )}
        </div>
        <div>
          {videoSrc ? (
            <SegmentedPreview
              title="Clip Stack Preview"
              videoSrc={videoSrc}
              segments={previewSegments}
              emptyLabel="No clip stack preview yet."
            />
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 p-6 text-center text-sm text-zinc-500">
              Upload a video to preview the clip stack.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
