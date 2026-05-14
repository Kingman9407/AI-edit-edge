import type { ModelAction } from "@/app/backend/api/chat/types";
import { asClip, asNumber, asReason, type ToolSchema } from "./shared";

export const cutSegmentTool: ToolSchema = {
  type: "function",
  function: {
    name: "cut_segment",
    description:
      "Remove (cut out) a segment of the video. Use this when the user asks to cut, trim, remove, or delete a specific time range.",
    parameters: {
      type: "object",
      properties: {
        start: {
          type: "number",
          description: "Start time in seconds of the segment to remove.",
        },
        end: {
          type: "number",
          description: "End time in seconds of the segment to remove.",
        },
        clip: {
          type: "number",
          description:
            "1-based clip index when multiple clips are loaded. Omit if only one clip.",
        },
        reason: {
          type: "string",
          description: "Short human-readable reason for the cut.",
        },
      },
      required: ["start", "end"],
    },
  },
};

export const parseCutSegmentCall = (
  args: Record<string, unknown>
): ModelAction | null => {
  const start = asNumber(args.start);
  const end = asNumber(args.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return null;
  }
  return {
    type: "cut",
    start,
    end,
    clip: asClip(args.clip),
    reason: asReason(args.reason),
  };
};

