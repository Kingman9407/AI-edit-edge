import React from "react";
import Link from "next/link";

interface ProjectHeaderProps {
  projectCount: number;
  onNewProject: () => void;
}

export default function ProjectHeader({ projectCount, onNewProject }: ProjectHeaderProps) {
  return (
    <div className="flex items-end justify-between mb-7 relative z-10">
      <div>
        <h1 className="text-[28px] font-bold text-blue-100 m-0 mb-1 tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>My Projects</h1>
        <p className="text-[14px] text-zinc-300 m-0">{projectCount} projects</p>
      </div>
      <button
        onClick={onNewProject}
        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl text-white text-[14px] font-medium transition-all duration-300 shadow-[0_4px_15px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.3)] relative overflow-hidden group cursor-pointer"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span className="relative z-10">New Project</span>
      </button>
    </div>
  );
}
