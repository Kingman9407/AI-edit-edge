import React from "react";
import { formatTime } from "@/app/backend/functions/formatTime";
import type { AudioSegment } from "../types";

interface SegmentHighlightsProps {
  segments: AudioSegment[];
  onAskAbout: (prompt: string) => void;
}

function getNote(segment: AudioSegment): string {
  if (segment.category === "music") return "music";
  if (segment.category === "sfx") return "background sound";
  const text = segment.transcript.trim();
  return text ? (text.length > 80 ? `${text.slice(0, 77)}...` : text) : "speech";
}

function buildQuickPrompt(segment: AudioSegment): string {
  const range = `${formatTime(segment.start)}-${formatTime(segment.end)}`;
  return `Explain what happens in ${range} (${getNote(segment)}).`;
}

export default function SegmentHighlights({ segments, onAskAbout }: SegmentHighlightsProps) {
  if (!segments.length) return null;

  return (
    <div className="border-t border-zinc-800/50 bg-zinc-950/50 px-4 py-3">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500">
        <span>Segment Highlights</span>
        <span className="text-[10px] font-medium text-zinc-500">{segments.length} segments</span>
      </div>
      <div className="mt-3 max-h-32 space-y-2 overflow-y-auto text-xs text-zinc-300">
        {segments.map((segment, index) => {
          const range = `${formatTime(segment.start)}-${formatTime(segment.end)}`;
          const note = getNote(segment);
          return (
            <div
              key={`${segment.start}-${segment.end}-${index}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 transition-colors hover:border-blue-500/40 hover:bg-zinc-900/80"
            >
              <div className="min-w-0">
                <div className="text-zinc-200 text-[12px] font-medium">{range}</div>
                <div className="text-[11px] text-zinc-500">{note}</div>
              </div>
              <button
                type="button"
                onClick={() => onAskAbout(buildQuickPrompt(segment))}
                className="shrink-0 rounded-full border border-zinc-700/60 bg-zinc-800/80 px-3 py-1 text-[11px] text-zinc-300 transition-all hover:bg-blue-500/20 hover:border-blue-500/40 hover:text-white"
              >
                Ask AI
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
