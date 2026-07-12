import React from "react";

interface ProjectSearchProps {
  search: string;
  setSearch: (val: string) => void;
}

export default function ProjectSearch({ search, setSearch }: ProjectSearchProps) {
  return (
    <div className="relative mb-6">
      <svg
        className="absolute left-[14px] top-1/2 -translate-y-1/2 pointer-events-none"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        placeholder="Search projects…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full py-[11px] pr-[14px] pl-[42px] bg-zinc-950/50 border border-white/10 rounded-2xl text-white text-[14px] outline-none box-border max-w-[380px] focus:border-white/20 transition-colors backdrop-blur-md"
      />
    </div>
  );
}
