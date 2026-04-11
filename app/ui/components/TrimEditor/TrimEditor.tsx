import React, { ChangeEvent } from "react";
import { RotateCcw, CheckCircle2 } from "lucide-react";
import { formatTime } from "@/app/backend/functions/formatTime";

interface TrimEditorProps {
  duration: number;
  trimStart: number;
  trimEnd: number;
  onTrimStartChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onTrimEndChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
}

export default function TrimEditor({
  duration,
  trimStart,
  trimEnd,
  onTrimStartChange,
  onTrimEndChange,
  onReset,
}: TrimEditorProps) {
  return (
    <div className="animate-in fade-in slide-in-from-top-4 space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Trim Video</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-500 transition-colors">
            <CheckCircle2 size={16} />
            Apply Trim
          </button>
        </div>
      </div>

      <div className="space-y-8 pt-4">
        {/* Time labels */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <span>Start: {formatTime((trimStart / 100) * duration)}</span>
            <span>End: {formatTime((trimEnd / 100) * duration)}</span>
          </div>

          {/* Visual Timeline Bar */}
          <div className="relative h-12 w-full overflow-hidden rounded-lg bg-zinc-800 ring-1 ring-inset ring-white/10">
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <div className="h-full w-full bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#333_10px,#333_20px)]" />
            </div>
            {/* Trim highlight */}
            <div
              className="absolute top-0 bottom-0 bg-blue-500/20 border-x-2 border-blue-500"
              style={{ left: `${trimStart}%`, right: `${100 - trimEnd}%` }}
            />
          </div>

          {/* Slider Controls */}
          <div className="grid grid-cols-2 gap-8 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Start Time ({trimStart.toFixed(1)}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={trimStart}
                onChange={onTrimStartChange}
                className="w-full accent-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                End Time ({trimEnd.toFixed(1)}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={trimEnd}
                onChange={onTrimEndChange}
                className="w-full accent-blue-500"
              />
            </div>
          </div>
        </div>

        <p className="text-sm text-zinc-500 bg-zinc-900/80 p-4 rounded-lg border border-zinc-800">
          <strong>Note:</strong> Playing the video in Editor Mode will automatically pause it when the current time reaches your set End Time boundary.
        </p>
      </div>
    </div>
  );
}
