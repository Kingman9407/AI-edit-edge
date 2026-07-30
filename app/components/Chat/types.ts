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
