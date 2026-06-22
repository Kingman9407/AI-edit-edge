"""
Category 10 — Context-Aware Edits & Anti-Copy Training

Goal: Teach the model to read the TIMELINE STATE to resolve ambiguous requests,
      while NOT blindly copying timeline metadata when the request specifies
      its own distinct timeframe.

  Part A — Context-Aware: model must read Muted Sections from state to act.
  Part B — Anti-Copy: explicit user request overrides anything in the timeline.
  Part C — Playhead Query: info-only responses, empty operations.

No tool_call / tool_result — all resolution is server-side.
"""

examples = [

    # ── Part A: Context-Aware (must read timeline state) ──────────────────

    # "cut out the silent parts" → reads Muted Sections, emits one cut per entry
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- 45.0 -> 50.0\n- 120.0 -> 135.0\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut out the silent parts",
        "output": "{\"message\":\"Cut out the silent sections from the timeline.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"45\",\"end\":\"50\",\"unit\":\"seconds\",\"reason\":\"Cut silent section 1\"},{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"120\",\"end\":\"135\",\"unit\":\"seconds\",\"reason\":\"Cut silent section 2\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 210.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- 10.0 -> 20.0\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute the silent part just in case",
        "output": "{\"message\":\"Muted the silent section.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"range\",\"start\":\"10\",\"end\":\"20\",\"unit\":\"seconds\",\"reason\":\"Mute silent section\"}]}"
    },

    # ── Part B: Anti-Copy (explicit request overrides timeline state) ──────

    # "first N sec" → first variation — ignore the unrelated Muted Sections entry
    {
        "input": "[VIDEO METADATA]\nName: lecture.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- 74.0 -> 97.0\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove first 10 sec",
        "output": "{\"message\":\"Removed the first 10 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Remove first 10 sec\"}]}"
    },

    # "last N seconds" → last variation — ignore the unrelated Muted Sections entry
    {
        "input": "[VIDEO METADATA]\nName: review.mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 45.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- 20.0 -> 30.0\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut last 10 seconds",
        "output": "{\"message\":\"Cut the last 10 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"last\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Cut last 10 seconds\"}]}"
    },

    # MM:SS range → range variation — ignore the unrelated Muted Sections entry
    {
        "input": "[VIDEO METADATA]\nName: podcast.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 50.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- 500.0 -> 505.0\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute audio from 1:00 to 2:00",
        "output": "{\"message\":\"Muted the audio from 1:00 to 2:00.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"range\",\"start\":\"1:00\",\"end\":\"2:00\",\"unit\":\"seconds\",\"reason\":\"Mute 1:00 to 2:00\"}]}"
    },

    # ── Part C: Playhead Query (info-only, empty operations) ──────────────

    {
        "input": "[VIDEO METADATA]\nName: project.mp4\nDuration: 500.0s\nResolution: 1920x1080\nPlayhead: 145.5s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nwhere is the play head currently placed?",
        "output": "{\"message\":\"Your playhead is currently at 145.5 seconds.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: raw_footage.mp4\nDuration: 264.0s\nResolution: 1920x1080\nPlayhead: 32.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nwhat's my current position in the timeline?",
        "output": "{\"message\":\"You are at 32.0 seconds in the video.\",\"operations\":[]}"
    },
]
