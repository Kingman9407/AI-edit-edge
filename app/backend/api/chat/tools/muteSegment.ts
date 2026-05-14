import type { ModelAction } from "@/app/backend/api/chat/types";
import { asClip, asNumber, asReason, type ToolSchema } from "./shared";

export const muteSegmentTool: ToolSchema = {
  type: "function",
  function: {
    name: "mute_segment",
    description: "Mute a specific time range of the video's original audio track.",
    parameters: {
      type: "object",
      properties: {
        start: {
          type: "number",
          description: "Start time in seconds.",
        },
        end: {
          type: "number",
          description: "End time in seconds.",
        },
        clip: {
          type: "number",
          description:
            "1-based clip index when multiple clips are loaded. Omit if only one clip.",
        },
        reason: {
          type: "string",
          description: "Short human-readable reason for the mute.",
        },
      },
      required: ["start", "end"],
    },
  },
};

export const parseMuteSegmentCall = (
  args: Record<string, unknown>
): ModelAction | null => {
  const start = asNumber(args.start);
  const end = asNumber(args.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return null;
  }
  return {
    type: "mute",
    start,
    end,
    clip: asClip(args.clip),
    reason: asReason(args.reason),
  };
};

