import React from "react";
import { PLAN_CONFIGS, PLAN_ORDER, PlanId } from "@/app/backend/functions/plans";
import type { EdgeLLMState } from "@/app/hooks/useEdgeLLM";
import type { User } from "firebase/auth";
import type { ChatSession, InferenceMode } from "../types";

interface ChatMenuProps {
  authUser: User | null;
  sessions: ChatSession[];
  currentSessionId: string | null;
  planId: PlanId;
  inferenceMode: InferenceMode;
  memorySummary: string;
  tokenUsage?: { total: number; chat: number; audio: number; vision: number } | null;
  edgeLLM: EdgeLLMState;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onLogout: () => void;
  onPlanSelect?: (planId: PlanId) => void;
  setInferenceMode: (mode: InferenceMode) => void;
  setShowEdgeConfirm: (show: boolean) => void;
  onClose: () => void;
}

export default function ChatMenu({
  authUser,
  sessions,
  currentSessionId,
  planId,
  inferenceMode,
  memorySummary,
  tokenUsage,
  edgeLLM,
  onNewChat,
  onSelectSession,
  onLogout,
  onPlanSelect,
  setInferenceMode,
  setShowEdgeConfirm,
  onClose,
}: ChatMenuProps) {
  return (
    <div className="absolute bottom-[calc(100%+8px)] left-4 w-[calc(100%-32px)] max-h-[50vh] overflow-y-auto rounded-3xl border border-zinc-700/60 bg-zinc-900/95 p-5 shadow-2xl z-50 backdrop-blur-xl flex flex-col gap-6 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Menu</span>
        <button
          type="button"
          onClick={onNewChat}
          className="rounded-full border border-zinc-700/60 bg-zinc-800/40 px-3 py-1 text-[10px] font-medium text-zinc-300 transition-all hover:border-emerald-400/60 hover:bg-emerald-500/10 hover:text-white flex items-center gap-1"
        >
          + New Chat
        </button>
      </div>

      {/* Account */}
      {authUser && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Account</div>
          <div className="flex items-center justify-between bg-zinc-900/40 border border-zinc-800/50 p-2 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[13px] overflow-hidden shadow-sm">
                {authUser.photoURL ? (
                  <img src={authUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  authUser.displayName?.charAt(0) || "U"
                )}
              </div>
              <div className="flex flex-col gap-[2px]">
                <span className="text-[12px] font-semibold text-zinc-200 leading-tight">{authUser.displayName || "User"}</span>
                <span className="text-[10px] text-zinc-400 font-medium">Beta User</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="text-[11px] font-medium text-red-400 hover:text-red-300 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Usage */}
      {tokenUsage && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Usage</div>
          <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-wider">
            <div className="flex items-center gap-1.5 rounded-full border border-zinc-800/50 bg-zinc-900/40 px-2 py-1 shadow-sm">
              <span className="text-zinc-500 font-medium">Total</span>
              <span className="font-mono font-bold text-blue-400">{tokenUsage.total.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 px-1 border-l border-zinc-800/50">
              <span className="text-zinc-500">Chat</span>
              <span className="font-mono text-zinc-300">{tokenUsage.chat.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 px-1 border-l border-zinc-800/50">
              <span className="text-zinc-500">Audio</span>
              <span className="font-mono text-zinc-300">{tokenUsage.audio.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Plans */}
      {onPlanSelect && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Plans</div>
          <div className="flex flex-wrap gap-2">
            {PLAN_ORDER.map((planOption) => {
              const isActive = planOption === planId;
              return (
                <button
                  key={planOption}
                  type="button"
                  onClick={() => onPlanSelect(planOption)}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition border ${
                    isActive
                      ? "bg-blue-600/20 text-blue-400 border-blue-500/50"
                      : "bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:text-white hover:bg-zinc-800"
                  }`}
                >
                  {PLAN_CONFIGS[planOption].label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Model Provider */}
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Model Provider</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { setInferenceMode("cloud"); onClose(); }}
            className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition border ${
              inferenceMode === "cloud"
                ? "bg-blue-600/20 text-blue-400 border-blue-500/50"
                : "bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:text-white hover:bg-zinc-800"
            }`}
          >
            Cloud (OpenRouter)
          </button>
          <button
            type="button"
            onClick={() => {
              if (edgeLLM.status === "idle" || edgeLLM.status === "error") {
                setShowEdgeConfirm(true);
                onClose();
              } else if (!inferenceMode.startsWith("edge")) {
                setInferenceMode("edge-int8");
                onClose();
              } else {
                onClose();
              }
            }}
            className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition border ${
              inferenceMode.startsWith("edge")
                ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
                : "bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:text-white hover:bg-zinc-800"
            }`}
          >
            Edge (Local Device)
          </button>
        </div>
      </div>

      {/* Memory */}
      {memorySummary && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Memory</div>
          <div className="text-xs text-zinc-400 leading-relaxed bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">{memorySummary}</div>
        </div>
      )}

      {/* History */}
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">History</div>
        <div className="space-y-2">
          {sessions.length ? (
            sessions.map((session) => {
              const isActive = session.id === currentSessionId;
              const updated = new Date(session.updatedAt).toLocaleString();
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => { onSelectSession(session.id); onClose(); }}
                  className={`flex w-full flex-col rounded-xl border px-3 py-2 text-left transition-all ${
                    isActive
                      ? "border-blue-500/60 bg-blue-500/10 text-zinc-100 shadow-sm shadow-blue-500/10"
                      : "border-zinc-800/60 bg-zinc-950/60 hover:border-blue-500/40 hover:bg-zinc-900/60"
                  }`}
                >
                  <span className="text-sm font-semibold text-zinc-200">{session.title}</span>
                  <span className="text-[11px] text-zinc-500">{updated}</span>
                </button>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-700/50 bg-zinc-950/60 p-4 text-center text-xs text-zinc-500">
              No chat history yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
