import React from "react";
import { formatTime } from "@/app/backend/functions/formatTime";
import { PlanId } from "@/app/backend/functions/plans";
import { Segment } from "@/app/backend/functions/segments";

type EditSegment = {
  id: string;
  start: number;
  end: number;
  reason?: string;
};

interface EditListProps {
  edits: EditSegment[];
  activeTimeline: Segment[];
  videoSrc?: string;
  planId: PlanId;
  onSelect?: (time: number) => void;
  onUndoLast: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  exportNode?: React.ReactNode;
  audioOverlays?: {
    id: string;
    label?: string;
    videoStart: number;
    videoEnd: number;
    volume: number;
  }[];
  mutedSegments?: EditSegment[];
  onRemoveAudioOverlay?: (id: string) => void;
  onUpdateAudioOverlayVolume?: (id: string, volume: number) => void;
  onRemoveMute?: (id: string) => void;
}

const getChangeTag = (reason?: string) => {
  const text = (reason ?? "").toLowerCase();

  if (text.includes("silence")) {
    return { label: "SILENCE", className: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
  }
  if (text.includes("keep")) {
    return { label: "KEEP", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
  }
  if (text.includes("mute")) {
    return { label: "MUTE", className: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30" };
  }
  if (
    text.includes("trim") ||
    text.includes("cut") ||
    text.includes("remove") ||
    text.includes("delete")
  ) {
    return { label: "REMOVED", className: "bg-red-500/20 text-red-300 border-red-500/30" };
  }
  if (text.includes("ai")) {
    return { label: "AI EDIT", className: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" };
  }
  return { label: "MANUAL", className: "bg-zinc-700/60 text-zinc-200 border-zinc-600/70" };
};

const ClipPreview = ({
  videoSrc,
  start,
  index,
  isActive = false,
}: {
  videoSrc: string;
  start: number;
  index: number;
  isActive?: boolean;
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
    <div className={`relative h-14 w-24 overflow-hidden rounded-lg border bg-black ${isActive ? "border-emerald-500/30" : "border-zinc-800"}`}>
      <video
        ref={videoRef}
        src={videoSrc}
        muted
        preload="metadata"
        className="h-full w-full object-cover opacity-60"
      />
      <div className={`absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white ${isActive ? "bg-emerald-600" : "bg-black/70"}`}>
        {index + 1}
      </div>
    </div>
  );
};

export default function EditList({
  edits,
  activeTimeline = [],
  videoSrc,
  onSelect,
  onUndoLast,
  onRemove,
  onClear,
  exportNode,
  audioOverlays = [],
  mutedSegments = [],
  onRemoveAudioOverlay,
  onUpdateAudioOverlayVolume,
  onRemoveMute,
}: EditListProps) {
  const totalChanges = edits.length + mutedSegments.length + audioOverlays.length;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-2xl backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-zinc-800/50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-zinc-200">Active Timeline</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
              {activeTimeline.length} Segments
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-xs font-bold text-zinc-200">Changes Made</span>
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-500/20">
              {totalChanges}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {exportNode}
          <div className="h-4 w-px bg-zinc-700 mx-2" />
          <button
            type="button"
            onClick={onUndoLast}
            disabled={!totalChanges}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-[10px] font-bold text-zinc-300 transition hover:border-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Undo Last
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!totalChanges}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-[10px] font-bold text-zinc-300 transition hover:border-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-zinc-800">
        {/* Active Timeline List */}
        <div className="p-4 bg-emerald-500/5 min-h-[100px]">
          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {activeTimeline.length ? (
              activeTimeline.map((seg, i) => (
                <div
                  key={`active-${i}`}
                  onClick={() => onSelect?.(seg.start)}
                  className="flex flex-none items-center gap-2 rounded-xl border border-emerald-500/20 bg-zinc-950/60 p-2 text-xs text-zinc-300 transition hover:border-emerald-500 hover:bg-emerald-500/10 cursor-pointer w-[180px]"
                >
                  {videoSrc && <ClipPreview videoSrc={videoSrc} start={seg.start} index={i} isActive />}
                  <div className="min-w-0">
                    <div className="font-bold text-emerald-400 text-[10px]">Segment #{i + 1}</div>
                    <div className="text-[10px] font-medium text-zinc-400">
                      {formatTime(seg.start)} - {formatTime(seg.end)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex h-14 items-center justify-center rounded-xl border border-dashed border-emerald-500/20 w-full text-[10px] text-emerald-500/60 font-bold uppercase tracking-wider">
                No active segments
              </div>
            )}
          </div>
        </div>

        {/* Changes Made List */}
        <div className="p-4 bg-blue-500/5 min-h-[100px]">
          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {totalChanges ? (
              <>
                {edits.map((edit, index) => {
                const tag = getChangeTag(edit.reason);
                return (
                  <div
                    key={edit.id}
                    onClick={() => onSelect?.(edit.start)}
                    className="group relative flex flex-none items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-2 text-xs text-zinc-300 transition hover:border-blue-500 hover:bg-zinc-900/60 cursor-pointer w-[240px]"
                  >
                    {videoSrc && <ClipPreview videoSrc={videoSrc} start={edit.start} index={index} />}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-zinc-200 text-[10px]">Change #{index + 1}</div>
                      <div className="text-[10px] text-zinc-400">
                        {formatTime(edit.start)} - {formatTime(edit.end)}
                      </div>
                      <div className={`mt-1 inline-block rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-tighter ${tag.className}`}>
                        {tag.label}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(edit.id);
                      }}
                      className="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                  </div>
                );
                })}
                {mutedSegments.map((mute, index) => {
                  const tag = getChangeTag(mute.reason ?? "mute");
                  return (
                    <div
                      key={mute.id}
                      onClick={() => onSelect?.(mute.start)}
                      className="group relative flex flex-none items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-2 text-xs text-zinc-300 transition hover:border-fuchsia-500 hover:bg-zinc-900/60 cursor-pointer w-[240px]"
                    >
                      {videoSrc && <ClipPreview videoSrc={videoSrc} start={mute.start} index={edits.length + index} />}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-zinc-200 text-[10px]">Muted Audio #{index + 1}</div>
                        <div className="text-[10px] text-zinc-400">
                          {formatTime(mute.start)} - {formatTime(mute.end)}
                        </div>
                        <div className={`mt-1 inline-block rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-tighter ${tag.className}`}>
                          {tag.label}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveMute?.(mute.id);
                        }}
                        className="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                      </button>
                    </div>
                  );
                })}
                {audioOverlays.map((overlay, index) => (
                  <div
                    key={overlay.id}
                    onClick={() => onSelect?.(overlay.videoStart)}
                    className="group relative flex flex-none items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-2 text-xs text-zinc-300 transition hover:border-purple-500 hover:bg-zinc-900/60 cursor-pointer w-[240px]"
                  >
                    {videoSrc && <ClipPreview videoSrc={videoSrc} start={overlay.videoStart} index={edits.length + mutedSegments.length + index} />}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-zinc-200 text-[10px]">Audio Overlay #{index + 1}</div>
                      <div className="text-[10px] text-zinc-400">
                        {formatTime(overlay.videoStart)} - {formatTime(overlay.videoEnd)}
                      </div>
                      <div className={`mt-1 inline-block rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-tighter bg-purple-500/20 text-purple-300 border-purple-500/30`}>
                        {overlay.label || "ADDED AUDIO"}
                      </div>
                      <div
                        className="mt-2 flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <span className="text-[9px] font-bold text-zinc-500">
                          {Math.round(overlay.volume * 100)}%
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={overlay.volume}
                          aria-label={`${overlay.label || `Audio overlay ${index + 1}`} volume`}
                          onChange={(e) =>
                            onUpdateAudioOverlayVolume?.(
                              overlay.id,
                              Number(e.currentTarget.value)
                            )
                          }
                          className="h-1 w-full min-w-0 accent-purple-400"
                        />
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveAudioOverlay?.(overlay.id);
                      }}
                      className="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <div className="flex h-14 items-center justify-center rounded-xl border border-dashed border-zinc-700 w-full text-[10px] text-zinc-500/60 font-bold uppercase tracking-wider">
                No changes yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
