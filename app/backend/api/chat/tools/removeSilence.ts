import type { ModelAction } from "@/app/backend/api/chat/types";
import { asClip, asReason, type ToolSchema } from "./shared";

export const removeSilenceTool: ToolSchema = {
  type: "function",
  function: {
    name: "remove_silence",
    description:
      "Automatically remove silent or low-signal ranges using the editor's analyzed audio segments. Use this for requests like cut pauses, remove dead air, or trim silence.",
    parameters: {
      type: "object",
      properties: {
        clip: {
          type: "number",
          description:
            "1-based clip index when multiple clips are loaded. Omit if only one clip.",
        },
        reason: {
          type: "string",
          description: "Short human-readable reason for the silence removal.",
        },
      },
    },
  },
};

export const parseRemoveSilenceCall = (
  args: Record<string, unknown>
): ModelAction => ({
  type: "remove_silence",
  start: null,
  end: null,
  clip: asClip(args.clip),
  reason: asReason(args.reason),
});

