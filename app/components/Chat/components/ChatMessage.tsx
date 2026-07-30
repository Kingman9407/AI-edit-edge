import React from "react";
import { Bot, User } from "lucide-react";
import type { Message } from "../types";

interface ChatMessageProps {
  msg: Message;
}

export default function ChatMessage({ msg }: ChatMessageProps) {
  const isUser = msg.sender === "user";
  return (
    <div className={`flex items-end gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm ${
          isUser
            ? "bg-gradient-to-br from-blue-500 to-blue-600"
            : "bg-gradient-to-br from-zinc-700 to-zinc-800 border border-zinc-700/50"
        }`}
      >
        {isUser ? (
          <User size={14} className="text-white" />
        ) : (
          <Bot size={14} className="text-zinc-300" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[78%] whitespace-pre-line rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-md transition-all ${
          isUser
            ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md"
            : "bg-zinc-800/80 text-zinc-200 rounded-bl-md border border-zinc-700/40"
        }`}
      >
        {msg.text}
        {msg.tps !== undefined && (
          <div className="mt-2 text-[10px] opacity-70 font-mono">
            ⚡ {msg.tps.toFixed(1)} tokens/sec
          </div>
        )}
      </div>
    </div>
  );
}
