import React from "react";
import { PlanId } from "@/app/backend/functions/plans";
import type { Segment } from "@/app/backend/functions/segments";

type AudioSegment = {
  start: number;
  end: number;
  transcript: string;
  category: "speech" | "music" | "sfx";
};

type VideoInsight = {
  time: number;
  description: string;
};

interface MediaSidebarProps {
  planId: PlanId;
  videoContext?: {
    name: string;
    type: string;
    sizeBytes: number;
    duration: number;
    width: number;
    height: number;
  };
  audioSegments?: AudioSegment[];
  audioStatus?: "idle" | "processing" | "done" | "error" | "no-audio";
  audioError?: string | null;
  audioProgress?: number;
  videoInsights?: VideoInsight[];
  videoInsightStatus?: "idle" | "processing" | "done" | "error";
  videoInsightError?: string | null;
  sceneChanges?: number[];
  sceneStatus?: "idle" | "processing" | "done" | "error";
  sceneError?: string | null;
  activeTimeline?: Segment[];
  removedSegments?: Segment[];
}

export default function MediaSidebar({
  audioStatus = "idle",
}: MediaSidebarProps) {
  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-2xl backdrop-blur-xl">
    </div>
  );
}
