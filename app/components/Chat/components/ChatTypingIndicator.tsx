import React from "react";
import { Bot } from "lucide-react";

interface ChatTypingIndicatorProps {
  status: string | null;
  statusLog: string[];
  statusScrollRef: React.RefObject<HTMLDivElement | null>;
}

export default function ChatTypingIndicator({
  status,
  statusLog,
  statusScrollRef,
}: ChatTypingIndicatorProps) {
  if (!status && !statusLog.length) return null;

  return (
    <div className="flex items-end gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 border border-zinc-700/50 shadow-sm">
        <Bot size={14} className="text-zinc-300" />
      </div>
      <div className="max-w-[78%] rounded-2xl rounded-bl-md border border-zinc-700/40 bg-zinc-800/80 px-4 py-3 shadow-md">
        {/* Animated typing dots */}
        <div className="flex items-center gap-1 mb-2">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        {/* Status log */}
        <div
          ref={statusScrollRef}
          className="max-h-28 space-y-0.5 overflow-y-auto pr-2 text-[11px] text-zinc-400"
        >
          {statusLog.map((line, index) => {
            const isLatest = index === statusLog.length - 1 && status;
            return (
              <div
                key={`${line}-${index}`}
                className={`transition-colors ${isLatest ? "text-zinc-200" : "text-zinc-500"}`}
              >
                {isLatest ? "⚡ " : "✓ "}{line}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
