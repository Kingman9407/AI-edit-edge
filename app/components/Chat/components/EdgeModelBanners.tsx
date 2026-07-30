import React from "react";
import type { EdgeLLMState } from "@/app/hooks/useEdgeLLM";
import type { InferenceMode } from "../types";

interface EdgeModelBannersProps {
  inferenceMode: InferenceMode;
  edgeLLM: EdgeLLMState;
  onSwitchCloud: () => void;
}

export default function EdgeModelBanners({
  inferenceMode,
  edgeLLM,
  onSwitchCloud,
}: EdgeModelBannersProps) {
  if (!inferenceMode.startsWith("edge")) return null;

  return (
    <>
      {/* Download / loading progress */}
      {(edgeLLM.status === "downloading" || edgeLLM.status === "loading") && (
        <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-amber-300">
              {edgeLLM.status === "downloading" ? "Downloading model..." : "Loading model into memory..."}
            </span>
            <span className="text-[11px] font-mono text-amber-400">
              {edgeLLM.status === "downloading" ? `${Math.round(edgeLLM.progress * 100)}%` : ""}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300"
              style={{ width: `${Math.round(edgeLLM.progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error banner */}
      {edgeLLM.status === "error" && (
        <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 flex items-center gap-2">
          <span className="text-[11px] text-red-400 flex-1">
            {edgeLLM.error ?? "Edge model failed to load."}
          </span>
          <button
            type="button"
            onClick={onSwitchCloud}
            className="text-[10px] text-red-300 underline hover:no-underline"
          >
            Use Cloud
          </button>
        </div>
      )}
    </>
  );
}
