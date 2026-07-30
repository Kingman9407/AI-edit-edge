import React from "react";
import { Send, Cpu, MoreHorizontal } from "lucide-react";
import type { EdgeLLMState } from "@/app/hooks/useEdgeLLM";
import type { InferenceMode } from "../types";

interface ChatInputBarProps {
  input: string;
  isProcessing: boolean;
  isMenuOpen: boolean;
  inferenceMode: InferenceMode;
  edgeLLM: EdgeLLMState;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onToggleMenu: () => void;
  onOpenEdgeConfirm: () => void;
}

export default function ChatInputBar({
  input,
  isProcessing,
  isMenuOpen,
  inferenceMode,
  edgeLLM,
  onInputChange,
  onSubmit,
  onCancel,
  onToggleMenu,
  onOpenEdgeConfirm,
}: ChatInputBarProps) {
  const placeholder = isProcessing
    ? "Thinking..."
    : inferenceMode.startsWith("edge")
      ? edgeLLM.status === "ready"
        ? "Ask me (running on-device)..."
        : edgeLLM.status === "downloading" || edgeLLM.status === "loading"
          ? "Loading edge model..."
          : "Ask me to trim, cut, or analyze your video..."
      : "Ask me to trim, cut, or analyze your video...";

  const sendDisabled =
    !input.trim() ||
    isProcessing ||
    (inferenceMode.startsWith("edge") && edgeLLM.status !== "ready");

  return (
    <div className="flex items-center gap-2">
      {/* Menu toggle */}
      <button
        type="button"
        onClick={onToggleMenu}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all ${
          isMenuOpen
            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
            : "bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200"
        }`}
      >
        <MoreHorizontal size={18} />
      </button>

      {/* Edge Models toggle */}
      <button
        type="button"
        id="inference-mode-toggle"
        onClick={onOpenEdgeConfirm}
        title="Select Edge Model Variant"
        className={`flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-all ${
          inferenceMode.startsWith("edge")
            ? edgeLLM.status === "ready"
              ? "border-amber-500/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
              : "border-amber-500/30 bg-amber-500/10 text-amber-400"
            : "border-zinc-700/50 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        }`}
      >
        <Cpu size={13} />
        <span>Edge Models</span>
      </button>

      {/* Text input + send/cancel */}
      <form onSubmit={onSubmit} className="relative flex-1 flex items-center">
        <input
          type="text"
          value={input}
          disabled={isProcessing}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-full border border-zinc-700/60 bg-zinc-900/80 py-3 pl-5 pr-14 text-sm text-zinc-100 placeholder:text-zinc-500 shadow-inner shadow-black/20 focus:border-blue-500/80 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-60"
        />
        {isProcessing ? (
          <button
            type="button"
            onClick={onCancel}
            title="Cancel"
            className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30 text-red-400 transition-all hover:bg-red-500/30 hover:text-red-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={sendDisabled}
            className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-400 hover:to-blue-500 hover:shadow-blue-500/30 disabled:opacity-40 disabled:shadow-none disabled:hover:from-blue-500 disabled:hover:to-blue-600"
          >
            <Send size={15} />
          </button>
        )}
      </form>
    </div>
  );
}
