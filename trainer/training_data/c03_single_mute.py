"""
Category 03 — Single Mute Operations

Goal: Teach the model mute variations using the new semantic format.
      Outputs exactly one mute action per example.
      No tool_call / tool_result — resolution is server-side.

Patterns covered:
  range           — explicit seconds or mixed-unit (Xs to Y minute)
  first           — "first N seconds"
  last            — "last N seconds"
"""

examples = [
    # ── range: mixed units (45s to 1 minute) ──────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: zoom_meeting.mp4\nDuration: 255.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute the audio from 45 seconds to 1 minute",
        "output": "{\"message\":\"Muted the audio from 45 seconds to 1 minute.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"range\",\"start\":\"45\",\"end\":\"1:00\",\"unit\":\"seconds\",\"reason\":\"Mute requested range from 0:45 to 1:00\"}]}"
    },

    # ── range: explicit seconds ────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: outdoor_vlog.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute audio from 120s to 150s",
        "output": "{\"message\":\"Muted the audio from 120 to 150 seconds.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"range\",\"start\":\"120\",\"end\":\"150\",\"unit\":\"seconds\",\"reason\":\"Mute requested range from 120s to 150s\"}]}"
    },

    # ── first: N seconds ──────────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove sound from the first 10 seconds",
        "output": "{\"message\":\"Muted the audio for the first 10 seconds.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"first\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Mute first 10 seconds\"}]}"
    },

    # ── last: N seconds ───────────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: lecture.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nsilence the last 30 seconds",
        "output": "{\"message\":\"Silenced the audio for the last 30 seconds.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"last\",\"value\":30,\"unit\":\"seconds\",\"reason\":\"Mute last 30 seconds\"}]}"
    },
]
