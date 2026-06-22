import { resolveTime } from "@/app/ui/lib/resolveTime";
import type { TimeUnit } from "@/app/ui/lib/resolveTime";

export type ToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<
        string,
        {
          type: string;
          description: string;
          enum?: string[];
        }
      >;
      required?: string[];
    };
  };
};

export type TimeVariation =
  | "first"           // "first N seconds/minutes" — from start forward
  | "last"            // "last N seconds/minutes"  — from end backward
  | "before_playhead" // "N seconds before playhead"
  | "after_playhead"  // "next N seconds from playhead"
  | "range";          // explicit range — model echoes user's raw strings

export const asNumber = (value: unknown) => Number(value);

export const asClip = (value: unknown) =>
  typeof value === "number" ? value : null;

export const asReason = (value: unknown) =>
  typeof value === "string" ? value : null;

export const asString = (value: unknown) =>
  typeof value === "string" ? value : "";

/**
 * Parse a raw time string the model echoes from user input into float seconds.
 * Handles: "1:20" → 80, "1:20:30" → 5430, "100" → 100 (uses unit), "45s" → 45.
 * For MM:SS / HH:MM:SS, unit is ignored — format is always unambiguous.
 */
export function parseTimeString(value: unknown, duration = 0, unit = "seconds"): number {
  if (value == null) return 0;
  let s = String(value).trim().toLowerCase();

  if (s === "duration" || s === "end") return duration;

  // Explicit 's' suffix → treat as seconds regardless of unit param
  if (/s$/i.test(s) && !/:/.test(s)) {
    s = s.replace(/s$/i, "");
    unit = "seconds";
  }

  // HH:MM:SS or MM:SS — always seconds, unit ignored
  const match = s.match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/);
  if (match) {
    const h   = match[1] ? parseInt(match[1]) : 0;
    const m   = parseInt(match[2]);
    const sec = parseFloat(match[3]);
    return h * 3600 + m * 60 + sec;
  }

  // Plain number — interpret using unit
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  if (unit === "minutes") return n * 60;
  if (unit === "hours")   return n * 3600;
  return n; // default: seconds
}

/**
 * Resolves a semantic time reference into absolute {start, end} seconds.
 *
 * For "range" variation: start and end are raw strings the model echoed
 * from the user (e.g. "1:20", "100"), parsed server-side — no model math.
 * For all other variations: uses the resolveTime engine.
 */
export function resolveSemanticTime(
  variation: string,
  value: number,
  unit: string,
  duration: number,
  playhead: number,
  start?: string,
  end?: string
): { start: number; end: number } | null {
  const safeUnit = (["seconds", "minutes", "hours"].includes(unit)
    ? unit
    : "seconds") as TimeUnit;

  if (variation === "range") {
    if (start == null || end == null) return null;
    const s = Math.max(0, Math.round(parseTimeString(start, duration, safeUnit) * 10) / 10);
    const e = Math.min(duration, Math.round(parseTimeString(end, duration, safeUnit) * 10) / 10);
    return s < e ? { start: s, end: e } : null;
  }

  const anchorMap: Record<
    string,
    { anchor: "start" | "end" | "playhead"; direction: "forward" | "backward" }
  > = {
    first:           { anchor: "start",    direction: "forward"  },
    last:            { anchor: "end",      direction: "backward" },
    before_playhead: { anchor: "playhead", direction: "backward" },
    after_playhead:  { anchor: "playhead", direction: "forward"  },
  };

  const mapping = anchorMap[variation];
  if (!mapping) return null;

  const results = resolveTime({
    tool: "resolve_time",
    duration,
    playhead,
    anchor: mapping.anchor,
    direction: mapping.direction,
    amount: value,
    unit: safeUnit,
  });

  return results[0] ?? null;
}
