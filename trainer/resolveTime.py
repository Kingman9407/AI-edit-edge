"""
resolveTime.py

Python mirror of app/ui/lib/resolveTime.ts

Used exclusively during training data preparation to pre-compute
ground-truth tool_result values for each training example.
The logic here must stay in sync with the TypeScript version.
"""

from typing import Literal, TypedDict, Optional


TimeAnchor    = Literal["start", "end", "playhead"]
TimeDirection = Literal["forward", "backward"]
TimeUnit      = Literal["seconds", "minutes", "hours"]


class ResolveTimeCall(TypedDict, total=False):
    anchor:           TimeAnchor
    direction:        TimeDirection
    amount:           float
    unit:             TimeUnit
    default_duration: float   # optional, defaults to 5s


class TimeRange(TypedDict):
    start: float
    end:   float


# ─── Unit conversion ──────────────────────────────────────────────────────────

def to_seconds(amount: float, unit: TimeUnit) -> float:
    if unit == "minutes":
        return amount * 60
    elif unit == "hours":
        return amount * 3600
    return float(amount)


# ─── Single call resolver ─────────────────────────────────────────────────────

def resolve_single(call: ResolveTimeCall, duration: float, playhead: float) -> TimeRange:
    span_seconds    = to_seconds(call["amount"], call["unit"])
    default_dur_raw = call.get("default_duration", 5)
    default_duration = to_seconds(default_dur_raw, "seconds")

    anchor    = call["anchor"]
    direction = call["direction"]

    start: float
    end:   float

    if anchor == "start":
        if direction == "forward":
            start = 0.0
            end   = min(span_seconds, duration)
        else:
            start = 0.0
            end   = min(span_seconds, duration)

    elif anchor == "end":
        if direction == "backward":
            end   = duration
            start = max(0.0, duration - span_seconds)
        else:
            start = duration
            end   = duration

    else:  # playhead
        if direction == "forward":
            start = playhead
            end   = min(playhead + span_seconds, duration)
        else:
            start = max(0.0, playhead - span_seconds)
            end   = playhead

    # Point-in-time reference — add default span
    if start == end:
        end = min(start + default_duration, duration)

    # Round to 1 decimal to match training data precision
    return TimeRange(
        start=round(start, 1),
        end=round(end, 1),
    )


# ─── Public API ───────────────────────────────────────────────────────────────

def resolve_time(req: dict, duration: float, playhead: float) -> list[TimeRange]:
    """
    Execute a resolve_time tool call dict and return a list of TimeRange dicts.

    req format (single):
        {"tool": "resolve_time", "anchor": "start", "direction": "forward",
         "amount": 10, "unit": "seconds"}

    req format (explicit range — for MM:SS conversions):
        {"tool": "resolve_time", "start_seconds": 60.0, "end_seconds": 90.0}

    req format (batch):
        {"tool": "resolve_time", "calls": [
            {"anchor": "start", "direction": "forward", "amount": 10, "unit": "seconds"},
            {"anchor": "end",   "direction": "backward", "amount": 30, "unit": "seconds"}
        ]}
    """
    # Explicit range mode (e.g. MM:SS conversion already done by model)
    if "start_seconds" in req and "end_seconds" in req:
        start = max(0.0, round(float(req["start_seconds"]), 1))
        end   = min(duration, round(float(req["end_seconds"]),   1))
        return [TimeRange(start=start, end=end)]

    calls = req.get("calls")
    if calls:
        return [resolve_single(c, duration, playhead) for c in calls]

    # Single call — top-level fields
    if "anchor" in req and "direction" in req and "amount" in req and "unit" in req:
        single_call: ResolveTimeCall = {
            "anchor":    req["anchor"],
            "direction": req["direction"],
            "amount":    req["amount"],
            "unit":      req["unit"],
        }
        if "default_duration" in req:
            single_call["default_duration"] = req["default_duration"]
        return [resolve_single(single_call, duration, playhead)]

    return []


# ─── Convenience for training data generation ─────────────────────────────────

def compute_tool_result(tool_call_dict: dict, duration: float, playhead: float) -> str:
    """
    Given a tool_call dict (as it would appear in a training example),
    returns the JSON string to use as the tool_result value.

    Single call  → returns '{"start": X, "end": Y}'
    Batch call   → returns '[{"start": X, "end": Y}, ...]'
    """
    import json
    result = resolve_time(tool_call_dict, duration, playhead)
    if not result:
        return "null"
    if len(result) == 1 and not tool_call_dict.get("calls"):
        return json.dumps(result[0])
    return json.dumps(result)


# ─── CLI quick-test ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json

    tests = [
        # first 10 seconds
        ({"tool": "resolve_time", "anchor": "start", "direction": "forward", "amount": 10, "unit": "seconds"},
         300.0, 0.0),
        # last 30 seconds
        ({"tool": "resolve_time", "anchor": "end", "direction": "backward", "amount": 30, "unit": "seconds"},
         300.0, 0.0),
        # next 20 seconds from playhead at 150s
        ({"tool": "resolve_time", "anchor": "playhead", "direction": "forward", "amount": 20, "unit": "seconds"},
         300.0, 150.0),
        # first 2 minutes
        ({"tool": "resolve_time", "anchor": "start", "direction": "forward", "amount": 2, "unit": "minutes"},
         600.0, 0.0),
        # batch: first 10s AND at 20s
        ({"tool": "resolve_time", "calls": [
            {"anchor": "start", "direction": "forward", "amount": 10, "unit": "seconds"},
            {"anchor": "start", "direction": "forward", "amount": 20, "unit": "seconds", "default_duration": 5},
        ]}, 300.0, 0.0),
    ]

    print("resolve_time quick-test\n" + "=" * 40)
    for req, dur, ph in tests:
        result = compute_tool_result(req, dur, ph)
        print(f"  {req.get('anchor', 'batch')} {req.get('amount', '')} {req.get('unit', '')}  →  {result}")
