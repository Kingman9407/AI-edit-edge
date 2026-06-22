"""
Category 04 — Single Music Operations

Goal: Teach the model to add background music using the new semantic format.
      No tool_call / tool_result — resolution is server-side.

Patterns covered:
  range (full video)  — "add X to the entire video"
  range (seconds)     — "from N to M seconds"
  range (minutes)     — "from minute N until minute M"
"""

examples = [
    # ── full video ────────────────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: travel_vlog.mp4\nDuration: 420.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nadd upbeat.mp3 to the entire video",
        "output": "{\"message\":\"Added upbeat.mp3 across the full video.\",\"operations\":[{\"operation\":\"add_audio_overlay\",\"variation\":\"range\",\"start\":\"0\",\"end\":\"420\",\"unit\":\"seconds\",\"track\":\"upbeat.mp3\",\"reason\":\"Add background music to full video\"}]}"
    },

    # ── explicit seconds range ─────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: intro.mp4\nDuration: 30.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\noverlay lofi.mp3 from 5 to 25 seconds",
        "output": "{\"message\":\"Added lofi.mp3 overlay from 5 to 25 seconds.\",\"operations\":[{\"operation\":\"add_audio_overlay\",\"variation\":\"range\",\"start\":\"5\",\"end\":\"25\",\"unit\":\"seconds\",\"track\":\"lofi.mp3\",\"reason\":\"Add music overlay from 5s to 25s\"}]}"
    },

    # ── minute range ───────────────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: presentation.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ninsert background.mp3 starting from minute 2 until minute 5",
        "output": "{\"message\":\"Added background.mp3 from minute 2 to minute 5.\",\"operations\":[{\"operation\":\"add_audio_overlay\",\"variation\":\"range\",\"start\":\"2\",\"end\":\"5\",\"unit\":\"minutes\",\"track\":\"background.mp3\",\"reason\":\"Add background music from minute 2 to 5\"}]}"
    },
]