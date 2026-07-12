import React from "react";
import { Project } from "../types";

interface ProjectStatsProps {
  projects: Project[];
}

export default function ProjectStats({ projects }: ProjectStatsProps) {
  const stats = [
    { label: "Total", value: projects.length, color: "text-slate-200" },
    { label: "Drafts", value: projects.filter(p => p.status === "draft").length, color: "text-amber-400" },
    { label: "Exported", value: projects.filter(p => p.status === "exported").length, color: "text-emerald-400" },
    { label: "Processing", value: projects.filter(p => p.status === "processing").length, color: "text-indigo-400" },
  ];

  return (
    <div className="flex gap-8 mb-8 px-6 py-4 bg-zinc-950/50 border border-white/10 rounded-2xl w-fit backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.2)] relative z-10">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col items-center gap-[2px]">
          <span className={`text-[22px] font-bold leading-none ${stat.color}`}>{stat.value}</span>
          <span className="text-[11px] text-white/35 uppercase tracking-wide font-medium">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
