import type { ModelAction } from "@/app/backend/api/chat/types";
import type { ToolSchema } from "./shared";

export const mergeVideosTool: ToolSchema = {
  type: "function",
  function: {
    name: "merge_videos",
    description:
      "Prepare to merge all loaded video clips into a single output file, in the order they appear in the media library. Use this when the user asks to merge, combine, join, or concatenate multiple video files together. Each clip will contribute its currently kept segments (after any cuts). After calling this tool, prompt the user to click the Merge button in the Clip Stack bar.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Short human-readable reason or confirmation message for the merge.",
        },
      },
    },
  },
};

export const parseMergeVideosCall = (
  args: Record<string, unknown>
): ModelAction => ({
  type: "merge_videos",
  start: null,
  end: null,
  clip: null,
  reason: typeof args.reason === "string" ? args.reason : null,
});
