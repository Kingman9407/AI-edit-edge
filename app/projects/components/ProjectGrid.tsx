"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Project } from "../types";
import ProjectCard from "./ProjectCard";

const STATUS_COLORS = {
  draft: { bg: "bg-amber-400/10", text: "text-amber-400", label: "Draft" },
  exported: { bg: "bg-emerald-400/10", text: "text-emerald-400", label: "Exported" },
  processing: { bg: "bg-indigo-500/15", text: "text-indigo-400", label: "Processing" },
};

interface ProjectGridProps {
  projects: Project[];
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onNewProject: () => void;
}

export default function ProjectGrid({ projects, onOpenProject, onDeleteProject, onNewProject }: ProjectGridProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function confirmDelete(id: string) {
    onDeleteProject(id);
    setPendingDeleteId(null);
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-white/30">
        <span className="text-[48px]">🎬</span>
        <p className="text-[16px] m-0">No projects found</p>
      </div>
    );
  }

  return (
    <>
      {/* Delete confirmation modal */}
      {pendingDeleteId && (() => {
        const project = projects.find((p) => p.id === pendingDeleteId);
        if (!project) return null;
        return (
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setPendingDeleteId(null)}
          >
            <div
              className="bg-zinc-900 border border-white/10 rounded-3xl p-7 w-[340px] shadow-[0_32px_64px_rgba(0,0,0,0.6)] flex flex-col gap-5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </div>

              {/* Text */}
              <div className="text-center flex flex-col gap-1.5">
                <p className="text-white font-semibold text-[15px] m-0">Delete project?</p>
                <p className="text-white/40 text-[13px] m-0 leading-relaxed">
                  &ldquo;{project.name}&rdquo; and its chat history will be permanently removed.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-[13px] font-medium cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => setPendingDeleteId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/90 text-white text-[13px] font-semibold cursor-pointer hover:bg-red-500 transition-colors shadow-lg shadow-red-500/20"
                  onClick={() => confirmDelete(project.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onOpenProject={onOpenProject}
            onDeleteRequest={setPendingDeleteId}
          />
        ))}

        {/* New project card */}
        <button
          onClick={onNewProject}
          type="button"
          className="border border-dashed border-zinc-700 bg-zinc-900/30 flex items-center justify-center min-h-[240px] rounded-3xl transition-all duration-300 hover:border-blue-500/50 hover:bg-zinc-900/50 hover:-translate-y-[3px] backdrop-blur-xl relative z-10 w-full cursor-pointer"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-[52px] h-[52px] rounded-2xl bg-blue-100 flex items-center justify-center mb-1 shadow-md">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <p className="text-[15px] font-semibold text-zinc-200 m-0">New Project</p>
            <p className="text-[12px] text-zinc-400 m-0">Start editing a video</p>
          </div>
        </button>
      </div>
    </>
  );
}
