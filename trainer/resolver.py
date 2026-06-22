import re
import json


# ─── Time string parser ───────────────────────────────────────────────────────

def parse_time_string(value, duration=None, unit="seconds") -> float:
    """
    Parse a raw time string the model echoes from user input into float seconds.

    Handles:
      "1:20"    → 80.0   (MM:SS — always seconds, unit ignored)
      "1:20:30" → 5430.0 (HH:MM:SS — always seconds, unit ignored)
      "100"     → 100.0  (plain number — interpreted with unit)
      "45s"     → 45.0   (seconds suffix overrides unit)
      "duration"→ duration arg (full video end)
    """
    if value is None:
        return 0.0

    s = str(value).strip().lower()

    if s in ("duration", "end"):
        return float(duration) if duration is not None else 0.0

    # Explicit unit suffix overrides the unit param
    if s.endswith("m") or s.endswith("min"):
        try:
            return float(s.rstrip("min")) * 60
        except ValueError:
            pass

    # Strip trailing 's' unit suffix — treats value as seconds
    if s.endswith("s") and not re.search(r':\d+s?$', s):
        s = s[:-1]
        unit = "seconds"  # suffix wins

    # HH:MM:SS or MM:SS — always in seconds regardless of unit
    match = re.match(r'^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$', s)
    if match:
        h   = int(match.group(1)) if match.group(1) else 0
        m   = int(match.group(2))
        sec = float(match.group(3))
        return float(h * 3600 + m * 60 + sec)

    # Plain number — use unit to interpret
    try:
        n = float(s)
        if unit == "minutes":
            return n * 60
        elif unit == "hours":
            return n * 3600
        return n  # default: seconds
    except ValueError:
        return 0.0


# ─── Unit conversion ──────────────────────────────────────────────────────────

def to_seconds(amount: float, unit: str) -> float:
    """Converts a time value with unit to raw seconds."""
    if unit == "minutes":
        return float(amount) * 60
    elif unit == "hours":
        return float(amount) * 3600
    return float(amount)


# ─── Semantic operation resolver ──────────────────────────────────────────────

def resolve_semantic_operation(op: dict, workspace_state: dict) -> dict:
    """
    Converts a single semantic operation into an absolute operation
    with resolved {start, end} in seconds.

    Semantic operation schema:
      {
        "operation":  "cut" | "mute" | "add_audio_overlay",
        "variation":  "first" | "last" | "before_playhead" | "after_playhead" | "range",
        "value":      <float>,      # ignored when variation == "range"
        "unit":       "seconds" | "minutes" | "hours",
        "start":      <str>,        # range only — raw user string e.g. "1:20", "100"
        "end":        <str>,        # range only — raw user string
        "reason":     <str>,
        "track":      <str>,        # add_audio_overlay only
      }
    """
    duration = float(workspace_state.get("duration", 300.0))
    playhead = float(workspace_state.get("playhead", 0.0))

    operation = op.get("operation", "cut")
    variation = op.get("variation", "range")
    value     = float(op.get("value") or 0)
    unit      = op.get("unit", "seconds")
    reason    = op.get("reason", "")

    span = to_seconds(value, unit)

    if variation == "first":
        start = 0.0
        end   = min(span, duration)

    elif variation == "last":
        end   = duration
        start = max(0.0, duration - span)

    elif variation == "before_playhead":
        start = max(0.0, playhead - span)
        end   = playhead

    elif variation == "after_playhead":
        start = playhead
        end   = min(playhead + span, duration)

    else:  # "range" — parse raw strings the model echoed from the user
        start = parse_time_string(op.get("start", "0"), duration, unit)
        end   = parse_time_string(op.get("end",   "0"), duration, unit)
        if start > end:
            start, end = end, start

    # Clamp and round to 1 decimal
    start = round(max(0.0, start), 1)
    end   = round(min(duration, end), 1)

    resolved = {
        "operation": operation,
        "start":     start,
        "end":       end,
        "reason":    reason,
    }

    # Carry through track name for audio overlays
    if "track" in op:
        resolved["track"] = op["track"]

    return resolved


def resolve_semantic_operations(ops: list, workspace_state: dict) -> list:
    """
    Resolves a list of semantic operations into absolute {start, end} operations.
    Silently skips any resolved operation where start >= end.
    """
    results = []
    for op in ops:
        resolved = resolve_semantic_operation(op, workspace_state)
        if resolved["start"] < resolved["end"]:
            results.append(resolved)
    return results
