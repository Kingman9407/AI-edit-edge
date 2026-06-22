import type { ModelAction } from "@/app/backend/api/chat/types";
import { addAudioOverlayTool, parseAddAudioOverlayCall } from "./addAudioOverlay";
import { cutSegmentTool, parseCutSegmentCall } from "./cutSegment";
import { exportVideoTool, parseExportVideoCall } from "./exportVideo";
import { keepSegmentTool, parseKeepSegmentCall } from "./keepSegment";
import { mergeVideosTool, parseMergeVideosCall } from "./mergeVideos";
import { muteSegmentTool, parseMuteSegmentCall } from "./muteSegment";
import { removeSilenceTool, parseRemoveSilenceCall } from "./removeSilence";

export const TOOLS = [
  cutSegmentTool,
  keepSegmentTool,
  removeSilenceTool,
  exportVideoTool,
  addAudioOverlayTool,
  muteSegmentTool,
  mergeVideosTool,
] as const;

/**
 * Converts a raw tool call name + args into a ModelAction.
 * duration and playhead are required to resolve semantic time references
 * (variation + value + unit) into absolute {start, end} seconds.
 */
export const parseToolCallToAction = (
  name: string,
  args: Record<string, unknown>,
  duration: number,
  playhead: number
): ModelAction | null => {
  if (name === "cut_segment")      return parseCutSegmentCall(args, duration, playhead);
  if (name === "keep_segment")     return parseKeepSegmentCall(args, duration, playhead);
  if (name === "mute_segment")     return parseMuteSegmentCall(args, duration, playhead);
  if (name === "remove_silence")   return parseRemoveSilenceCall(args);
  if (name === "export_video")     return parseExportVideoCall();
  if (name === "add_audio_overlay") return parseAddAudioOverlayCall(args);
  if (name === "merge_videos")     return parseMergeVideosCall(args);
  return null;
};
