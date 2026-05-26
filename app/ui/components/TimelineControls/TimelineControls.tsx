import React from "react";
import { formatTime } from "@/app/backend/functions/formatTime";

export type MergeTimelineClip = {
  name: string;
  originalDuration: number;
  keptSegments: { start: number; end: number }[];
  removedSegments: { start: number; end: number }[];
};

// Base clip colors — kept segments get full opacity, removed get a dim bg
const CLIP_COLORS = [
  { kept: "bg-purple-500/80",  removed: "bg-purple-900/40",  dot: "bg-purple-400"  },
  { kept: "bg-blue-500/80",    removed: "bg-blue-900/40",    dot: "bg-blue-400"    },
  { kept: "bg-emerald-500/80", removed: "bg-emerald-900/40", dot: "bg-emerald-400" },
  { kept: "bg-amber-500/80",   removed: "bg-amber-900/40",   dot: "bg-amber-400"   },
  { kept: "bg-rose-500/80",    removed: "bg-rose-900/40",    dot: "bg-rose-400"    },
  { kept: "bg-cyan-500/80",    removed: "bg-cyan-900/40",    dot: "bg-cyan-400"    },
];

interface TimelineControlsProps {
  progressRef: React.RefObject<HTMLDivElement | null>;
  currentTime: number;
  duration: number;
  timelineCurrentTime: number;
  timelineDuration: number;
  edits: { start: number; end: number }[];
  isSkippingEdits: boolean;
  toggleIsSkippingEdits: () => void;
  onProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  mergeActive?: boolean;
  mergeClips?: MergeTimelineClip[];
}

export default function TimelineControls({
  progressRef,
  currentTime,
  duration,
  timelineCurrentTime,
  timelineDuration,
  edits = [],
  isSkippingEdits,
  toggleIsSkippingEdits,
  onProgressClick,
  mergeActive = false,
  mergeClips = [],
}: TimelineControlsProps) {
  const physicalPercent = (currentTime / duration) * 100 || 0;

  // Use total original duration (not just kept) so each clip's proportion reflects real time
  const totalOriginalDuration = mergeClips.reduce((s, c) => s + c.originalDuration, 0);

  // Kept duration sum for the footer label
  const totalKeptDuration = mergeClips.reduce(
    (s, c) => s + c.keptSegments.reduce((a, seg) => a + seg.end - seg.start, 0),
    0
  );

  return (
    <div className="w-full space-y-4 py-2">

      {/* ── Timeline Bar ── */}
      <div className="relative group">
        {mergeActive && mergeClips.length >= 2 ? (
          /* ── Merge timeline ── */
          <div
            ref={progressRef}
            onClick={onProgressClick}
            className="relative h-1 w-full rounded-full overflow-hidden ring-1 ring-white/5 flex cursor-pointer transition-all hover:h-2"
          >
            {mergeClips.map((clip, i) => {
              const color = CLIP_COLORS[i % CLIP_COLORS.length];
              // Width = proportion of this clip's original duration vs total
              const clipWidthPct = totalOriginalDuration > 0
                ? (clip.originalDuration / totalOriginalDuration) * 100
                : 100 / mergeClips.length;

              return (
                <div
                  key={i}
                  className={`relative h-full flex-shrink-0 border-r border-black/20 last:border-r-0 ${color.removed}`}
                  style={{ width: `${clipWidthPct}%` }}
                  title={`Clip ${i + 1}: ${clip.name} · ${formatTime(clip.originalDuration)}`}
                >
                  {/* Kept (active) segments — bright overlay */}
                  {clip.keptSegments.map((seg, j) => (
                    <div
                      key={j}
                      className={`absolute top-0 h-full ${color.kept}`}
                      style={{
                        left: `${(seg.start / clip.originalDuration) * 100}%`,
                        width: `${((seg.end - seg.start) / clip.originalDuration) * 100}%`,
                      }}
                    />
                  ))}
                </div>
              );
            })}

            {/* Playhead */}
            <div
              className="absolute left-0 top-0 h-full w-px bg-white shadow-[0_0_10px_white] z-10 pointer-events-none"
              style={{ left: `${physicalPercent}%` }}
            />
          </div>
        ) : (
          /* ── Normal single-clip progress bar ── */
          <div
            ref={progressRef}
            onClick={onProgressClick}
            className="relative h-1 w-full cursor-pointer rounded-full bg-emerald-500/20 ring-1 ring-white/5 transition-all hover:h-2"
          >
            {/* Removed segments (red) */}
            {edits.map((edit, i) => (
              <div
                key={`edit-${i}`}
                className="absolute h-full bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                style={{
                  left: `${(edit.start / duration) * 100}%`,
                  width: `${((edit.end - edit.start) / duration) * 100}%`,
                }}
              />
            ))}

            {/* Playhead */}
            <div
              className="absolute left-0 top-0 h-full w-px bg-white shadow-[0_0_10px_white] z-10"
              style={{ left: `${physicalPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Footer: time info + mode toggle ── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 flex-wrap">
          {mergeActive && mergeClips.length >= 2 ? (
            <>
              <div className="text-[10px] font-bold text-purple-400/80 uppercase tracking-widest flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                Merged: {formatTime(totalKeptDuration)}
              </div>
              {mergeClips.map((clip, i) => {
                const color = CLIP_COLORS[i % CLIP_COLORS.length];
                const keptDur = clip.keptSegments.reduce((s, seg) => s + seg.end - seg.start, 0);
                const shortName = clip.name.replace(/\.[^.]+$/, "").slice(0, 14);
                return (
                  <div key={i} className="flex items-center gap-1">
                    <span className={`h-1.5 w-3 rounded-sm flex-shrink-0 ${color.kept}`} />
                    <span className="text-[9px] text-zinc-500">
                      {shortName} · {formatTime(keptDur)}
                      {clip.removedSegments.length > 0 && (
                        <span className="text-zinc-600"> / {formatTime(clip.originalDuration)}</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active: {formatTime(timelineCurrentTime)} / {formatTime(timelineDuration)}
              </div>
              <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                Video: {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </>
          )}
        </div>

        {!mergeActive && (
          <div className="flex items-center rounded-full bg-zinc-900 ring-1 ring-white/5 p-0.5">
            <button
              onClick={() => isSkippingEdits && toggleIsSkippingEdits()}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all duration-300 ${
                !isSkippingEdits
                  ? "bg-red-500/20 text-red-400 shadow-sm ring-1 ring-red-500/50"
                  : "text-zinc-500 hover:text-zinc-400"
              }`}
            >
              All
            </button>
            <button
              onClick={() => !isSkippingEdits && toggleIsSkippingEdits()}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all duration-300 ${
                isSkippingEdits
                  ? "bg-emerald-500/20 text-emerald-400 shadow-sm ring-1 ring-emerald-500/50"
                  : "text-zinc-500 hover:text-zinc-400"
              }`}
            >
              Active
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
