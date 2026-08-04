import type { ModelAction } from "@/app/backend/api/chat/types";
import { asNumber, type ToolSchema } from "./shared";

export const undoTool: ToolSchema = {
  type: "function",
  function: {
    name: "undo",
    description: "Undo or revert the previous edit(s) when the user asks to go back or made a mistake.",
    parameters: {
      type: "object",
      properties: {
        count: {
          type: "number",
          description: "The number of previous edits to undo. Defaults to 1 if not specified.",
        },
      },
    },
  },
};

export const parseUndoCall = (
  args: Record<string, unknown>
): ModelAction => {
  return {
    type: "undo",
    count: asNumber(args.count) || 1,
  };
};
