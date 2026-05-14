import type { ModelAction } from "@/app/backend/api/chat/types";
import { addAudioOverlayTool, parseAddAudioOverlayCall } from "./addAudioOverlay";
import { cutSegmentTool, parseCutSegmentCall } from "./cutSegment";
import { exportVideoTool, parseExportVideoCall } from "./exportVideo";
import { keepSegmentTool, parseKeepSegmentCall } from "./keepSegment";
import { muteSegmentTool, parseMuteSegmentCall } from "./muteSegment";
import { removeSilenceTool, parseRemoveSilenceCall } from "./removeSilence";

export const TOOLS = [
  cutSegmentTool,
  keepSegmentTool,
  removeSilenceTool,
  exportVideoTool,
  addAudioOverlayTool,
  muteSegmentTool,
] as const;

export const parseToolCallToAction = (
  name: string,
  args: Record<string, unknown>
): ModelAction | null => {
  if (name === "cut_segment") return parseCutSegmentCall(args);
  if (name === "keep_segment") return parseKeepSegmentCall(args);
  if (name === "remove_silence") return parseRemoveSilenceCall(args);
  if (name === "export_video") return parseExportVideoCall();
  if (name === "add_audio_overlay") return parseAddAudioOverlayCall(args);
  if (name === "mute_segment") return parseMuteSegmentCall(args);
  return null;
};

