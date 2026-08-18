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

    operation  = op.get("operation", "cut")
    variation  = op.get("variation", "range")
    value_raw  = op.get("value")                          # None = no-arg (full span)
    value      = float(value_raw) if value_raw is not None else None
    unit       = op.get("unit", "seconds")
    reason     = op.get("reason", "")

    span = to_seconds(value, unit) if value is not None else None

    if variation == "first":
        start = 0.0
        end   = min(span, duration)

    elif variation == "last":
        end   = duration
        start = max(0.0, duration - span)

    elif variation == "before_playhead":
        end   = playhead
        # No-arg → cut everything from 0 to playhead
        # With arg → cut only the N-second window immediately before playhead
        start = 0.0 if span is None else max(0.0, playhead - span)

    elif variation == "after_playhead":
        start = playhead
        # No-arg → cut everything from playhead to end
        # With arg → cut only the N-second window immediately after playhead
        end   = duration if span is None else min(playhead + span, duration)

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


def parse_dsl_response(dsl_text: str) -> dict:
    """
    Parses the DSL format produced by the fine-tuned model:

        SAY: <human-readable confirmation>
        <COMMAND> <VARIATION> <PARAMETERS>

    COMMAND    = CUT | MUTE | ADD_AUDIO_OVERLAY
    VARIATION  = first | last | before_playhead | after_playhead | range | full_video
    DURATION   = <N>s | <N>m            (e.g. 5s  2m)
    RANGE      = <start> <end>           (space-separated, MM:SS or raw seconds)
                 OR <start>-<end>        (dash-joined legacy, e.g. 100s-150s)
    TRACK      = filename.mp3            (ADD_AUDIO_OVERLAY only, always last token)

    Returns {"message": str, "operations": [semantic_op, ...]}

    Each semantic_op:
        {
            "operation":  "cut" | "mute" | "add_audio_overlay",
            "variation":  "first" | "last" | "before_playhead" |
                          "after_playhead" | "range",
            "value":      float,          # duration-based variations
            "unit":       "seconds" | "minutes",
            "start":      str,            # range only
            "end":        str,            # range only
            "track":      str,            # add_audio_overlay only
        }
    """
    KNOWN_COMMANDS   = {"cut", "mute", "add_audio_overlay"}
    KNOWN_VARIATIONS = {"first", "last", "before_playhead",
                        "after_playhead", "range", "full_video"}
    DURATION_RE      = re.compile(r'^([\d.]+)([sm]?)$', re.IGNORECASE)

    def _parse_duration(tok: str):
        """Return (value, unit) from a token like '5s', '2m', '150', '1:30'."""
        m = DURATION_RE.match(tok)
        if m:
            val  = float(m.group(1))
            unit = "minutes" if m.group(2).lower() == "m" else "seconds"
            return val, unit
        # MM:SS fallback — treat as raw seconds string (resolver handles it)
        return None, "seconds"

    def _split_range(arg: str):
        """
        Split a range arg that is either:
          '100s-150s'  → ('100s', '150s')   dash-joined (no MM:SS confusion)
          '1:20-2:10'  → ('1:20', '2:10')   dash-joined MM:SS  (dash NOT inside colon segment)
        We only split on the LAST '-' that is NOT preceded by a digit-colon pattern.
        """
        # MM:SS-MM:SS pattern
        mm_ss = re.match(r'^(\d+:\d+(?:\.\d+)?)-(\d+:\d+(?:\.\d+)?)$', arg)
        if mm_ss:
            return mm_ss.group(1), mm_ss.group(2)
        # Generic: last '-' that separates two time tokens
        idx = arg.rfind('-')
        if idx > 0:
            return arg[:idx], arg[idx + 1:]
        return arg, arg   # malformed — both same, resolver will skip

    message    = ""
    operations = []

    for raw_line in dsl_text.strip().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("<thought>") or line.startswith("</thought>"):
            continue

        if line.startswith("SAY: "):
            message = line[5:].strip()
            continue

        parts = line.split()
        if len(parts) < 2:
            continue

        cmd = parts[0].upper()
        var = parts[1].lower()

        if cmd not in {c.upper() for c in KNOWN_COMMANDS}:
            continue   # skip stray lines (e.g. model rambling)
        if var not in KNOWN_VARIATIONS:
            continue

        op_name    = cmd.lower()
        semantic   = {"operation": op_name, "variation": var}
        extra_args = parts[2:]   # tokens after COMMAND VARIATION

        if var == "full_video":
            # full_video → treat as range 0 → end-of-video
            semantic["variation"] = "range"
            semantic["start"]     = "0"
            semantic["end"]       = "duration"
            # ADD_AUDIO_OVERLAY full_video <track>
            if op_name == "add_audio_overlay" and extra_args:
                semantic["track"] = extra_args[-1]

        elif var == "range":
            # Two possible arg shapes:
            #   a) Single token with dash:  100s-150s  or  1:00-1:30
            #   b) Two tokens:              1:00 1:30  or  100 150
            if len(extra_args) == 0:
                continue  # malformed
            elif len(extra_args) == 1:
                start_s, end_s = _split_range(extra_args[0])
            else:
                # Could be: <start> <end>  or  <start> <end> <track>
                start_s = extra_args[0]
                end_s   = extra_args[1]
            semantic["start"] = start_s
            semantic["end"]   = end_s
            # ADD_AUDIO_OVERLAY range <start> <end> <track>
            if op_name == "add_audio_overlay" and len(extra_args) >= 3:
                semantic["track"] = extra_args[2]

        else:
            # Variations: first | last | before_playhead | after_playhead
            # Shape: [<duration>]  [<track>]
            if not extra_args:
                if var in ("before_playhead", "after_playhead"):
                    # No-arg form — cut/mute everything before or after playhead
                    semantic["value"] = None
                    semantic["unit"]  = "seconds"
                else:
                    continue   # first/last always need a duration — skip
            else:
                dur_tok      = extra_args[0]
                val, unit    = _parse_duration(dur_tok)
                if val is None:
                    # Not a plain duration — treat as raw seconds string for resolver
                    semantic["value"] = 0.0
                    semantic["unit"]  = "seconds"
                    semantic["_raw"]  = dur_tok
                else:
                    semantic["value"] = val
                    semantic["unit"]  = unit
                # ADD_AUDIO_OVERLAY first <dur> <track>
                if op_name == "add_audio_overlay" and len(extra_args) >= 2:
                    semantic["track"] = extra_args[-1]

        operations.append(semantic)

    return {"message": message, "operations": operations}

