import React from "react";
import { formatTime } from "@/app/backend/functions/formatTime";
import { PLAN_CONFIGS, PlanId } from "@/app/backend/functions/plans";

type AudioSegment = {
  start: number;
  end: number;
  transcript: string;
  category: "speech" | "music" | "sfx";
};

type VideoContext = {
  name: string;
  type: string;
  sizeBytes: number;
  duration: number;
  width: number;
  height: number;
};

type VideoInsight = {
  time: number;
  description: string;
};

interface MediaSidebarProps {
  planId: PlanId;
  videoContext?: VideoContext;
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
}

const formatSize = (bytes: number) => {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
};

const buildSegmentLines = (segments: AudioSegment[], limit?: number) =>
  (typeof limit === "number" ? segments.slice(0, limit) : segments).map(
    (segment) => {
      const range = `${formatTime(segment.start)}-${formatTime(segment.end)}`;
      if (segment.category === "music") {
        return `${range} music`;
      }
      if (segment.category === "sfx") {
        return `${range} background sound`;
      }
      const text = segment.transcript.trim() || "speech";
      return `${range} ${text}`;
    }
  );

export default function MediaSidebar({
  planId,
  videoContext,
  audioSegments = [],
  audioStatus = "idle",
  audioError = null,
  audioProgress = 0,
  videoInsights = [],
  videoInsightStatus = "idle",
  videoInsightError = null,
  sceneChanges = [],
  sceneStatus = "idle",
  sceneError = null,
}: MediaSidebarProps) {
  return null;
}
