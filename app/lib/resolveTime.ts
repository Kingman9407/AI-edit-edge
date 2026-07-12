/**
 * resolveTime.ts
 *
 * Pure deterministic tool for resolving natural-language time references
 * into exact {start, end} float-second values.
 *
 * This is the implementation of the `resolve_time` tool that the Hornet AI
 * calls via a <tool_call> block. The model never does arithmetic — it only
 * extracts the structured parameters and reads back the result.
 */

export type TimeAnchor = "start" | "end" | "playhead";
export type TimeDirection = "forward" | "backward";
export type TimeUnit = "seconds" | "minutes" | "hours";

/** A single time-resolution request. */
export interface ResolveTimeCall {
  anchor: TimeAnchor;
  direction: TimeDirection;
  amount: number;
  unit: TimeUnit;
  /** Override: explicit end offset for "point-in-time" references (e.g. "cut at 20s"). */
  default_duration?: number;
}

/** The full tool_call payload the model emits. */
export interface ResolveTimeRequest {
  tool: "resolve_time";
  duration: number;   // video total duration in seconds
  playhead: number;   // current playhead position in seconds
  // Single call
  anchor?: TimeAnchor;
  direction?: TimeDirection;
  amount?: number;
  unit?: TimeUnit;
  default_duration?: number;
  // OR batch of calls
  calls?: ResolveTimeCall[];
}

export interface TimeRange {
  start: number;
  end: number;
}

// ─── Unit conversion ──────────────────────────────────────────────────────────

function toSeconds(amount: number, unit: TimeUnit): number {
  switch (unit) {
    case "minutes": return amount * 60;
    case "hours":   return amount * 3600;
    default:        return amount;
  }
}

// ─── Single call resolver ─────────────────────────────────────────────────────

function resolveSingle(
  call: ResolveTimeCall,
  duration: number,
  playhead: number
): TimeRange {
  const spanSeconds = toSeconds(call.amount, call.unit);
  const defaultDuration = toSeconds(call.default_duration ?? 5, "seconds");

  let start: number;
  let end: number;

  if (call.anchor === "start") {
    if (call.direction === "forward") {
      // "first N seconds/minutes" — from beginning
      start = 0;
      end = Math.min(spanSeconds, duration);
    } else {
      // "backward from start" — unusual, treat as point reference
      start = 0;
      end = Math.min(spanSeconds, duration);
    }
  } else if (call.anchor === "end") {
    if (call.direction === "backward") {
      // "last N seconds/minutes" — from the end
      end = duration;
      start = Math.max(0, duration - spanSeconds);
    } else {
      // "forward from end" — treat as point at end
      start = duration;
      end = duration;
    }
  } else {
    // anchor === "playhead"
    if (call.direction === "forward") {
      // "next N seconds from playhead"
      start = playhead;
      end = Math.min(playhead + spanSeconds, duration);
    } else {
      // "previous N seconds before playhead"
      start = Math.max(0, playhead - spanSeconds);
      end = playhead;
    }
  }

  // "cut at Xs" / point-in-time reference — single timestamp with default span
  if (start === end) {
    end = Math.min(start + defaultDuration, duration);
  }

  // Round to 1 decimal place to match training data precision
  return {
    start: Math.round(start * 10) / 10,
    end:   Math.round(end   * 10) / 10,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Execute a `resolve_time` tool call.
 * Accepts either a single call or a batch `calls` array.
 * Returns an array of TimeRange objects (always an array for uniformity).
 */
export function resolveTime(req: ResolveTimeRequest): TimeRange[] {
  const { duration, playhead } = req;

  // Explicit range mode — for MM:SS conversions where the model pre-computes seconds
  if ((req as any).start_seconds != null && (req as any).end_seconds != null) {
    const start = Math.max(0, Math.round((req as any).start_seconds * 10) / 10);
    const end   = Math.min(duration, Math.round((req as any).end_seconds * 10) / 10);
    return [{ start, end }];
  }

  // Batch mode
  if (req.calls && req.calls.length > 0) {
    return req.calls.map(call => resolveSingle(call, duration, playhead));
  }

  // Single mode — all top-level fields
  if (req.anchor && req.direction && req.amount != null && req.unit) {
    return [resolveSingle(
      {
        anchor:           req.anchor,
        direction:        req.direction,
        amount:           req.amount,
        unit:             req.unit,
        default_duration: req.default_duration,
      },
      duration,
      playhead
    )];
  }

  return [];
}

/**
 * Parse a raw `<tool_call>` JSON string and execute it.
 * Returns a JSON string suitable for injection as a `tool_result` turn.
 * Returns null if parsing fails.
 */
export function executeToolCall(rawJson: string, duration: number, playhead: number): string | null {
  try {
    const req: ResolveTimeRequest = JSON.parse(rawJson);
    // Override duration/playhead with live values from the actual video context
    req.duration = duration;
    req.playhead = playhead;

    if (req.tool !== "resolve_time") return null;

    const result = resolveTime(req);

    // Return array if batch, unwrapped object if single
    if (result.length === 1 && !req.calls) {
      return JSON.stringify(result[0]);
    }
    return JSON.stringify(result);
  } catch {
    return null;
  }
}
