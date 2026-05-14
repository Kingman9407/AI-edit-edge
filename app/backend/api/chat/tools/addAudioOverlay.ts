import type { ModelAction } from "@/app/backend/api/chat/types";
import { asNumber, type ToolSchema } from "./shared";

export const addAudioOverlayTool: ToolSchema = {
  type: "function",
  function: {
    name: "add_audio_overlay",
    description:
      "Add an external audio file (like background music) as an overlay track on the video.",
    parameters: {
      type: "object",
      properties: {
        audioFileIndex: {
          type: "number",
          description:
            "The 0-based index of the audio file to use from the provided context list.",
        },
        start: {
          type: "number",
          description:
            "Start time in seconds on the video timeline where the audio should begin.",
        },
        end: {
          type: "number",
          description:
            "Maximum end time in seconds on the video timeline. The overlay still stops at the audio file's natural length.",
        },
        volume: {
          type: "number",
          description: "Volume level from 0.0 to 1.0 (e.g. 0.8).",
        },
      },
      required: ["audioFileIndex", "start", "end", "volume"],
    },
  },
};

export const parseAddAudioOverlayCall = (
  args: Record<string, unknown>
): ModelAction => {
  const start = asNumber(args.start);
  const end = asNumber(args.end);
  const volume = asNumber(args.volume);
  const audioFileIndex = asNumber(args.audioFileIndex);

  return {
    type: "add_audio_overlay",
    audioFileIndex: Number.isFinite(audioFileIndex) ? audioFileIndex : 0,
    start: Number.isFinite(start) ? start : 0,
    end: Number.isFinite(end) ? end : 10,
    volume: Number.isFinite(volume) ? volume : 0.8,
  };
};
