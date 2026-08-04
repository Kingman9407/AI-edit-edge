import React from "react";
import { Cpu } from "lucide-react";
import type { EdgeLLMState } from "@/app/hooks/useEdgeLLM";
import type { InferenceMode } from "../types";

interface EdgeConfirmPanelProps {
  inferenceMode: InferenceMode;
  edgeLLM: EdgeLLMState;
  onConfirm: (format: "int8" | "fp16" | "fp32") => void;
  onClose: () => void;
  onDeleteModels: () => Promise<void>;
}

export default function EdgeConfirmPanel({
  inferenceMode,
  edgeLLM,
  onConfirm,
  onClose,
  onDeleteModels,
}: EdgeConfirmPanelProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteModels();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="absolute bottom-[calc(100%+8px)] left-4 right-4 z-50 rounded-2xl border border-amber-500/30 bg-zinc-900/98 p-4 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
          <Cpu size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100">Run on your device?</p>
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed mb-3">
            Select a model variant to download and run offline in your browser.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onConfirm("int8")}
              className="rounded-full bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors text-left flex justify-between"
            >
              <span>Edge INT8 (~137 MB)</span><span className="opacity-70 font-normal">Smallest</span>
            </button>
            <button
              type="button"
              onClick={() => onConfirm("fp16")}
              className="rounded-full bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors text-left flex justify-between"
            >
              <span>Edge FP16 (~270 MB)</span><span className="opacity-70 font-normal">Medium</span>
            </button>
            <button
              type="button"
              onClick={() => onConfirm("fp32")}
              className="rounded-full bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors text-left flex justify-between"
            >
              <span>Edge FP32 (~500 MB)</span><span className="opacity-70 font-normal">Most Accurate</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-zinc-800/80 px-4 py-2 mt-1 text-xs font-semibold text-zinc-400 border border-zinc-700/50 hover:text-zinc-200 transition-colors text-center"
            >
              Cancel
            </button>
            <div className="mt-3 pt-3 border-t border-amber-500/20">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || edgeLLM.status === "downloading" || edgeLLM.status === "loading"}
                className={`w-full rounded-full px-4 py-2 text-xs font-semibold text-center transition-colors border ${
                  isDeleting || edgeLLM.status === "downloading" || edgeLLM.status === "loading"
                    ? "bg-zinc-800/50 text-zinc-500 border-zinc-700/50 cursor-not-allowed"
                    : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                }`}
              >
                {isDeleting ? "Deleting..." : "Delete Downloaded Models"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
