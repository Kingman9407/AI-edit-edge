/**
 * Hornet DSL Parser
 *
 * Converts raw model output (Hornet DSL format) into structured
 * { assistantMessage, actions } that the existing Chat.tsx pipeline
 * can apply directly to the video timeline.
 *
 * DSL Grammar (from trainer/training_data/DSL.py):
 *
 *   SAY: <human readable message>
 *
 *   CUT   FIRST <N> SEC|MIN
 *   CUT   LAST  <N> SEC|MIN
 *   CUT   RANGE <start> <end>
 *   CUT   BEFORE_PLAYHEAD [<N> SEC|MIN]
 *   CUT   AFTER_PLAYHEAD  [<N> SEC|MIN]
 *
 *   MUTE  FIRST <N> SEC|MIN
 *   MUTE  LAST  <N> SEC|MIN
 *   MUTE  RANGE <start> <end>
 *   MUTE  BEFORE_PLAYHEAD [<N> SEC|MIN]
 *   MUTE  AFTER_PLAYHEAD  [<N> SEC|MIN]
 *
 *   ADD_AUDIO_OVERLAY  FIRST    <N> SEC|MIN <track>
 *   ADD_AUDIO_OVERLAY  LAST     <N> SEC|MIN <track>
 *   ADD_AUDIO_OVERLAY  RANGE    <start> <end> <track>
 *   ADD_AUDIO_OVERLAY  FULL_VIDEO <track>
 *
 *   MERGE  START      <clip>
 *   MERGE  END        <clip>
 *   MERGE  AFTER_TIME <timestamp> <clip>
 *
 *   UNDO <N>
 *   UNDO ALL
 */

import type { ModelAction } from "@/app/backend/api/chat/types";
import { parseTimeString, resolveSemanticTime } from "@/app/backend/api/chat/tools/shared";

// ─────────────────────────────────────────────────────────────────
// Public return type
// ─────────────────────────────────────────────────────────────────

export interface DSLParseResult {
  assistantMessage: string;
  actions: ModelAction[];
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

type TimeUnit = "seconds" | "minutes" | "hours";

/** Normalise SEC / MIN / HR / SECONDS / MINUTES / HOURS → "seconds" | "minutes" | "hours" */
function normalizeUnit(raw: string): TimeUnit {
  const u = raw.toUpperCase();
  if (u === "MIN" || u === "MINS" || u === "MINUTE" || u === "MINUTES") return "minutes";
  if (u === "HR"  || u === "HRS"  || u === "HOUR"   || u === "HOURS")   return "hours";
  return "seconds"; // SEC / SECS / SECOND / SECONDS / anything else
}

/**
 * Parse a shared FIRST / LAST / RANGE / BEFORE_PLAYHEAD / AFTER_PLAYHEAD
 * block that both CUT and MUTE share.
 *
 * Returns { start, end } in absolute seconds, or null if parsing fails.
 */
function parseTimeBlock(
  tokens: string[], // tokens AFTER the command keyword (CUT / MUTE)
  duration: number,
  playhead: number,
): { start: number; end: number } | null {
  const mode = tokens[0]?.toUpperCase();

  // ── FIRST / LAST ─────────────────────────────────────────────
  if (mode === "FIRST" || mode === "LAST") {
    // FIRST <N> SEC|MIN  or  LAST <N> SEC|MIN
    const n    = parseFloat(tokens[1]);
    const unit = normalizeUnit(tokens[2] ?? "SEC");
    if (isNaN(n)) return null;
    const variation = mode === "FIRST" ? "first" : "last";
    return resolveSemanticTime(variation, n, unit, duration, playhead);
  }

  // ── RANGE ────────────────────────────────────────────────────
  if (mode === "RANGE") {
    // RANGE <start> <end>
    const startStr = tokens[1];
    const endStr   = tokens[2];
    if (!startStr || !endStr) return null;
    return resolveSemanticTime("range", 0, "seconds", duration, playhead, startStr, endStr);
  }

  // ── BEFORE_PLAYHEAD ──────────────────────────────────────────
  if (mode === "BEFORE_PLAYHEAD") {
    if (tokens.length >= 3 && !isNaN(parseFloat(tokens[1]))) {
      // Bounded: BEFORE_PLAYHEAD <N> SEC|MIN
      const n    = parseFloat(tokens[1]);
      const unit = normalizeUnit(tokens[2] ?? "SEC");
      return resolveSemanticTime("before_playhead", n, unit, duration, playhead);
    }
    // Unbounded: everything before playhead → start=0, end=playhead
    const end = Math.min(playhead, duration);
    return end > 0 ? { start: 0, end } : null;
  }

  // ── AFTER_PLAYHEAD ───────────────────────────────────────────
  if (mode === "AFTER_PLAYHEAD") {
    if (tokens.length >= 3 && !isNaN(parseFloat(tokens[1]))) {
      // Bounded: AFTER_PLAYHEAD <N> SEC|MIN
      const n    = parseFloat(tokens[1]);
      const unit = normalizeUnit(tokens[2] ?? "SEC");
      return resolveSemanticTime("after_playhead", n, unit, duration, playhead);
    }
    // Unbounded: everything after playhead → start=playhead, end=duration
    const start = Math.max(playhead, 0);
    return start < duration ? { start, end: duration } : null;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// Line parsers
// ─────────────────────────────────────────────────────────────────

function parseCutLine(tokens: string[], duration: number, playhead: number): ModelAction | null {
  const range = parseTimeBlock(tokens, duration, playhead);
  if (!range) return null;
  return { type: "cut", start: range.start, end: range.end };
}

function parseMuteLine(tokens: string[], duration: number, playhead: number): ModelAction | null {
  const range = parseTimeBlock(tokens, duration, playhead);
  if (!range) return null;
  return { type: "mute", start: range.start, end: range.end };
}

function parseAddAudioOverlayLine(tokens: string[], duration: number, playhead: number): ModelAction | null {
  const mode = tokens[0]?.toUpperCase();

  // ADD_AUDIO_OVERLAY FULL_VIDEO <track>
  if (mode === "FULL_VIDEO") {
    const track = tokens[1] ?? "";
    return { type: "add_audio_overlay", start: 0, end: duration, reason: track };
  }

  // ADD_AUDIO_OVERLAY FIRST|LAST <N> SEC|MIN <track>
  if (mode === "FIRST" || mode === "LAST") {
    const n     = parseFloat(tokens[1]);
    const unit  = normalizeUnit(tokens[2] ?? "SEC");
    const track = tokens[3] ?? "";
    if (isNaN(n)) return null;
    const variation = mode === "FIRST" ? "first" : "last";
    const range = resolveSemanticTime(variation, n, unit, duration, playhead);
    if (!range) return null;
    return { type: "add_audio_overlay", start: range.start, end: range.end, reason: track };
  }

  // ADD_AUDIO_OVERLAY RANGE <start> <end> <track>
  if (mode === "RANGE") {
    const startStr = tokens[1];
    const endStr   = tokens[2];
    const track    = tokens[3] ?? "";
    const range = resolveSemanticTime("range", 0, "seconds", duration, playhead, startStr, endStr);
    if (!range) return null;
    return { type: "add_audio_overlay", start: range.start, end: range.end, reason: track };
  }

  return null;
}

function parseMergeLine(tokens: string[], duration: number, playhead: number): ModelAction | null {
  const mode = tokens[0]?.toUpperCase();

  // MERGE START <clip>
  if (mode === "START") {
    const clip = tokens[1] ?? "";
    return { type: "merge", start: 0, end: 0, reason: clip };
  }

  // MERGE END <clip>
  if (mode === "END") {
    const clip = tokens[1] ?? "";
    return { type: "merge", start: duration, end: duration, reason: clip };
  }

  // MERGE AFTER_TIME <timestamp> <clip>
  if (mode === "AFTER_TIME") {
    const tsStr = tokens[1];
    const clip  = tokens[2] ?? "";
    const ts    = parseTimeString(tsStr, duration, "seconds");
    return { type: "merge", start: ts, end: ts, reason: clip };
  }

  return null;
}

function parseUndoLine(tokens: string[]): ModelAction | null {
  const arg = tokens[0]?.toUpperCase();
  if (!arg) return { type: "undo", count: 1 };
  if (arg === "ALL") return { type: "undo", count: 999 };
  const n = parseInt(arg, 10);
  return { type: "undo", count: isNaN(n) ? 1 : n };
}

// ─────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────

/**
 * Parse a raw Hornet DSL string from the edge model into a structured result.
 *
 * @param raw      — The full raw string output from the model (may contain
 *                   chat-template tokens like <|im_end|> which are stripped).
 * @param duration — Current video duration in seconds (needed for time resolution).
 * @param playhead — Current playhead position in seconds.
 */
export function parseDSLOutput(
  raw: string,
  duration: number,
  playhead: number,
): DSLParseResult {
  // 1. Strip chat-template tokens that may leak through
  const cleaned = raw
    .replace(/<\|im_end\|>[\s\S]*$/,  "") // strip everything after <|im_end|>
    .replace(/<\|im_start\|>[^\n]*/g, "") // strip any <|im_start|> headers
    .trim();

  const lines   = cleaned.split("\n").map(l => l.trim()).filter(Boolean);
  let   assistantMessage = "";
  const actions: ModelAction[] = [];

  for (const line of lines) {
    // ── SAY: ────────────────────────────────────────────────────
    if (line.toUpperCase().startsWith("SAY:")) {
      // Take the last SAY: line so multi-line fallbacks are handled cleanly
      assistantMessage = line.slice(4).trim();
      continue;
    }

    // Tokenise the rest of the line (whitespace-split)
    const tokens = line.split(/\s+/);
    const cmd    = tokens[0]?.toUpperCase();
    const rest   = tokens.slice(1); // tokens after the command keyword

    let action: ModelAction | null = null;

    if (cmd === "CUT") {
      action = parseCutLine(rest, duration, playhead);
    } else if (cmd === "MUTE") {
      action = parseMuteLine(rest, duration, playhead);
    } else if (cmd === "ADD_AUDIO_OVERLAY") {
      action = parseAddAudioOverlayLine(rest, duration, playhead);
    } else if (cmd === "MERGE" || cmd === "CONCAT") {
      action = parseMergeLine(rest, duration, playhead);
    } else if (cmd === "UNDO") {
      action = parseUndoLine(rest);
    }
    // Unknown command lines are silently ignored (safe — keeps the parser robust)

    if (action) {
      actions.push(action);
    }
  }

  // If the model produced a DSL command but forgot the SAY: line, use a fallback
  if (!assistantMessage) {
    assistantMessage = actions.length > 0
      ? "Done! Applied your edit."
      : cleaned || "I'm ready to help with your video editing!";
  }

  return { assistantMessage, actions };
}
