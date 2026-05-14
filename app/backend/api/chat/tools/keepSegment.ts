import type { ModelAction } from "@/app/backend/api/chat/types";
import { asClip, asNumber, asReason, type ToolSchema } from "./shared";

export const keepSegmentTool: ToolSchema = {
  type: "function",
  function: {
    name: "keep_segment",
    description:
      "Keep only one exact time range and remove everything before and after it. Use this for requests like keep only, retain only, or focus on just one part.",
    parameters: {
      type: "object",
      properties: {
        start: {
          type: "number",
          description: "Start time in seconds of the part to keep.",
        },
        end: {
          type: "number",
          description: "End time in seconds of the part to keep.",
        },
        clip: {
          type: "number",
          description:
            "1-based clip index when multiple clips are loaded. Omit if only one clip.",
        },
        reason: {
          type: "string",
          description: "Short human-readable reason for keeping this range.",
        },
      },
      required: ["start", "end"],
    },
  },
};

export const parseKeepSegmentCall = (
  args: Record<string, unknown>
): ModelAction | null => {
  const start = asNumber(args.start);
  const end = asNumber(args.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return null;
  }
  return {
    type: "keep",
    start,
    end,
    clip: asClip(args.clip),
    reason: asReason(args.reason),
  };
};

