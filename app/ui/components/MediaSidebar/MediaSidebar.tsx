import React from "react";
import { PlanId } from "@/app/backend/functions/plans";

interface MediaSidebarProps {
  planId: PlanId;
  audioStatus?: "idle" | "processing" | "done" | "error" | "no-audio";
}

export default function MediaSidebar({
  audioStatus = "idle",
}: MediaSidebarProps) {
  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-2xl backdrop-blur-xl">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-200">AI Engine Status</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${audioStatus === "done" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
            {audioStatus === "done" ? "READY" : audioStatus.toUpperCase()}
          </span>
        </div>
        <p className="text-[10px] text-zinc-500 italic leading-relaxed">
          The AI is currently processing your video's audio for transcription and silence detection.
        </p>
      </section>
    </div>
  );
}
