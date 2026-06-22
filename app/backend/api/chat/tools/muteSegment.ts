import type { ModelAction } from "@/app/backend/api/chat/types";
import { asClip, asNumber, asReason, asString, resolveSemanticTime, type ToolSchema } from "./shared";

export const muteSegmentTool: ToolSchema = {
  type: "function",
  function: {
    name: "mute_segment",
    description:
      "Mute (silence the audio of) a segment of the video without removing the footage. Use when the user asks to silence, mute, or remove audio from a time range.",
    parameters: {
      type: "object",
      properties: {
        variation: {
          type: "string",
          description:
            "Which part of the video to mute. Use 'first', 'last', 'before_playhead', 'after_playhead', or 'range' for an explicit start/end.",
          enum: ["first", "last", "before_playhead", "after_playhead", "range"],
        },
        value: {
          type: "number",
          description:
            "The amount of time to mute. Required unless variation is 'range'.",
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
          description: "Short human-readable reason for the mute.",
        },
      },
      required: ["variation"],
    },
  },
};

export const parseMuteSegmentCall = (
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
    type: "mute",
    start: range.start,
    end: range.end,
    clip: asClip(args.clip),
    reason: asReason(args.reason),
  };
};
