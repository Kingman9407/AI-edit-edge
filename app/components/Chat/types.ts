export interface Message {
  id: string;
  text: string;
  sender: "user" | "system";
  rawJson?: string;
  tps?: number;
}

export type AudioSegment = {
  start: number;
  end: number;
  transcript: string;
  category: "speech" | "music" | "sfx";
};

export type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

export type InferenceMode = "cloud" | "edge-int8" | "edge-fp16" | "edge-fp32";

export interface MultiClipFile {
  id: string;
  name: string;
  type: string;
  sizeBytes: number;
}

export type TimelineEdit = {
  id: string;
  start: number;
  end: number;
  reason?: string;
};

export type ClipSnapshot = {
  id: string;
  name: string;
  type: string;
  sizeBytes: number;
  duration: number;
  width: number;
  height: number;
  audioSegments: {
    start: number;
    end: number;
    transcript: string;
    category: "speech" | "music" | "sfx";
  }[];
  audioStatus: "idle" | "processing" | "done" | "error" | "no-audio";
  audioError: string | null;
  audioProgress: number;
  videoInsights: {
    time: number;
    description: string;
  }[];
  videoInsightStatus: "idle" | "processing" | "done" | "error";
  videoInsightError: string | null;
  sceneChanges: number[];
  sceneStatus: "idle" | "processing" | "done" | "error";
  sceneError: string | null;
  edits: TimelineEdit[];
  muteEdits: TimelineEdit[];
};

export type VideoContext = {
  name?: string;
  type?: string;
  sizeBytes?: number;
  duration?: number;
  width?: number;
  height?: number;
  currentTime?: number;
  trimStart?: number;
  trimEnd?: number;
  isEditorMode?: boolean;
};

export type VideoInsight = {
  time: number;
  description: string;
};

export type ClipSegment = {
  start: number;
  end: number;
  reason?: string;
};

export type SuggestionSegment = {
  start: number;
  end: number;
  note: string;
};

export type ChatMemory = {
  lastIntent?: string;
  lastTrim?: { start: number; end: number };
  clipCount?: number;
  lastExportAt?: number;
};
