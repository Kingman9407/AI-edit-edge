"""
Category 03 — Single Mute Operations (DSL format)

Goal: Teach the model mute variations using the new flat line-oriented DSL.
      Outputs exactly one SAY: line + one MUTE command per example.
      No JSON, no tool_call / tool_result — resolution is server-side.

Patterns covered:
  range           — explicit seconds or mixed-unit (Xs to Y minute)
  first           — "first N seconds"
  last            — "last N seconds"

Format notes (matches Category 01 convention):
  - variation: first | last | range
  - For range: model echoes user's time strings as given (numbers stay bare
    when both sides share the "seconds" unit; mixed units keep an explicit
    's' suffix or 'M:SS' form so the backend can disambiguate before parsing).
  - For first/last: value carries an inline unit suffix (e.g. "10s").
"""

examples = [
    # ── range: mixed units (45s to 1 minute) ──────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: zoom_meeting.mp4\nDuration: 255.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute the audio from 45 seconds to 1 minute",
        "output": "SAY: Muted the audio from 45 seconds to 1 minute.\nMUTE range 45s 1:00"
    },

    # ── range: explicit seconds ────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: outdoor_vlog.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute audio from 120s to 150s",
        "output": "SAY: Muted the audio from 120 to 150 seconds.\nMUTE range 120 150"
    },

    # ── first: N seconds ──────────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove sound from the first 10 seconds",
        "output": "SAY: Muted the audio for the first 10 seconds.\nMUTE first 10s"
    },

    # ── last: N seconds ───────────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: lecture.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nsilence the last 30 seconds",
        "output": "SAY: Silenced the audio for the last 30 seconds.\nMUTE last 30s"
    },
]