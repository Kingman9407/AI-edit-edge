import type { ModelAction } from "@/app/backend/api/chat/types";
import type { ToolSchema } from "./shared";

export const exportVideoTool: ToolSchema = {
  type: "function",
  function: {
    name: "export_video",
    description:
      "Trigger a video export/render. Use this when the user asks to export, render, or combine clips.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};

export const parseExportVideoCall = (): ModelAction => ({
  type: "export",
  start: null,
  end: null,
  clip: null,
  reason: null,
});

