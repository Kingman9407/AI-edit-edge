import React from "react";
import { Project } from "../types";

const STATUS_COLORS = {
  draft: { bg: "bg-amber-400/10", text: "text-amber-400", label: "Draft" },
  exported: { bg: "bg-emerald-400/10", text: "text-emerald-400", label: "Exported" },
  processing: { bg: "bg-indigo-500/15", text: "text-indigo-400", label: "Processing" },
};

interface ProjectCardProps {
  project: Project;
  onOpenProject: (id: string) => void;
  onDeleteRequest: (id: string) => void;
}

export default function ProjectCard({ project, onOpenProject, onDeleteRequest }: ProjectCardProps) {
  const status = STATUS_COLORS[project.status];

  return (
    <div
      className="group bg-zinc-950/50 border border-white/10 rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-[3px] hover:border-white/20 hover:shadow-[0_12px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl shadow-[0_8px_20px_rgba(0,0,0,0.2)] relative z-10"
      onClick={() => onOpenProject(project.id)}
    >
      {/* Thumbnail */}
      <div className="h-[150px] bg-gray-900 flex items-center justify-center relative border-b border-white/10">
        <span className="text-[48px] drop-shadow-md">{project.thumbnail}</span>
        
        {/* Delete Button (Top Left over Image) */}
        <button
          type="button"
          className="absolute top-2.5 left-2.5 bg-black/40 border border-white/10 cursor-pointer p-1.5 rounded-lg flex items-center text-white/50 hover:bg-red-500/90 hover:text-white hover:border-red-500/50 transition-all duration-200 z-20 backdrop-blur-md opacity-0 group-hover:opacity-100 shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteRequest(project.id);
          }}
          title="Delete Project"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
          </svg>
        </button>

        <div className="absolute bottom-2.5 right-2.5 bg-black/60 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-sm z-10">{project.duration}</div>
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center shadow-md">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4l16 8-16 8V4z" fill="#2563eb" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5 pt-4 pb-4">
        <div className="flex items-start justify-between mb-1.5 gap-2">
          <h3 className="text-[14px] font-semibold text-white m-0 leading-snug line-clamp-2 pr-2">{project.name}</h3>
        </div>

        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-[11px] text-white/35 flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            {project.resolution}
          </span>
          <span className="text-[11px] text-white/20">·</span>
          <span className="text-[11px] text-white/35 flex items-center gap-1">{project.updatedAt}</span>
        </div>

        <div className="flex items-center justify-between">
          <span
            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full tracking-wide ${status.bg} ${status.text}`}
          >
            {status.label}
          </span>
          <span className="text-[12px] text-indigo-400/60 font-medium">Open →</span>
        </div>
      </div>
    </div>
  );
}
