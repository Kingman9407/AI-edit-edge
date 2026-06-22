import type { ModelAction } from "@/app/backend/api/chat/types";
import { asClip, asNumber, asReason, asString, resolveSemanticTime, type ToolSchema } from "./shared";

export const cutSegmentTool: ToolSchema = {
  type: "function",
  function: {
    name: "cut_segment",
    description:
      "Remove (cut out) a segment of the video. Use this when the user asks to cut, trim, remove, or delete a time range.",
    parameters: {
      type: "object",
      properties: {
        variation: {
          type: "string",
          description:
            "Which part of the video to cut. Use 'first' for the beginning, 'last' for the end, 'before_playhead' for N seconds before the playhead, 'after_playhead' for N seconds after the playhead, or 'range' for an explicit start/end range.",
          enum: ["first", "last", "before_playhead", "after_playhead", "range"],
        },
        value: {
          type: "number",
          description:
            "The amount of time to cut. Required unless variation is 'range'.",
        },
        unit: {
          type: "string",
          description: "The time unit for the value. One of: seconds, minutes, hours.",
          enum: ["seconds", "minutes", "hours"],
        },
        start: {
          type: "string",
          description:
            "Explicit start time as the user stated it (e.g. '1:20', '100', '45s'). Required only when variation is 'range'.",
        },
        end: {
          type: "string",
          description:
            "Explicit end time as the user stated it (e.g. '2:10', '150', '90s'). Required only when variation is 'range'.",
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
      required: ["variation"],
    },
  },
};

export const parseCutSegmentCall = (
  args: Record<string, unknown>,
  duration: number,
  playhead: number
): ModelAction | null => {
  const variation = asString(args.variation);
  const value = asNumber(args.value);
  const unit = asString(args.unit) || "seconds";
  const start = args.start != null ? asString(args.start) : undefined;
  const end   = args.end   != null ? asString(args.end)   : undefined;

  const range = resolveSemanticTime(variation, value, unit, duration, playhead, start, end);
  if (!range || range.start >= range.end) return null;

  return {
    type: "cut",
    start: range.start,
    end: range.end,
    clip: asClip(args.clip),
    reason: asReason(args.reason),
  };
};
