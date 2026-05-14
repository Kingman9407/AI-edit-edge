import React from "react";
import { formatTime } from "@/app/backend/functions/formatTime";

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
}: TimelineControlsProps) {
  const physicalPercent = (currentTime / duration) * 100 || 0;

  return (
    <div className="w-full space-y-4 py-2">
      <div className="relative group">
        <div 
          ref={progressRef}
          onClick={onProgressClick}
          className="relative h-1 w-full cursor-pointer rounded-full bg-emerald-500/20 ring-1 ring-white/5 transition-all hover:h-2"
        >
          {/* Removed segments overlay (Red) */}
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

          {/* Progress playhead highlight */}
          <div 
            className="absolute left-0 top-0 h-full w-px bg-white shadow-[0_0_10px_white] z-10"
            style={{ left: `${physicalPercent}%` }}
          />
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex gap-6">
          <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active: {formatTime(timelineCurrentTime)} / {formatTime(timelineDuration)}
          </div>
          <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            Video: {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${!isSkippingEdits ? "text-red-400" : "text-zinc-600"}`}>
            Full Video
          </span>
          <button
            onClick={toggleIsSkippingEdits}
            className={`relative h-6 w-11 rounded-full transition-colors duration-300 ${
              isSkippingEdits ? "bg-emerald-500/20 ring-1 ring-emerald-500/50" : "bg-red-500/20 ring-1 ring-red-500/50"
            }`}
          >
            <div
              className={`absolute top-1 h-4 w-4 rounded-full transition-all duration-300 ease-spring ${
                isSkippingEdits ? "left-6 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" : "left-1 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"
              }`}
            />
          </button>
          <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isSkippingEdits ? "text-emerald-400" : "text-zinc-600"}`}>
            Active Only
          </span>
        </div>
      </div>
    </div>
  );
}
