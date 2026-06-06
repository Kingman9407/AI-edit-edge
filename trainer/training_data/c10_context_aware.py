"""
Category 10 — Context-Aware Edits & Anti-Copy Training

Goal: Teach the model to read the TIMELINE STATE to resolve ambiguous requests,
      while ALSO teaching it NOT to blindly copy timeline metadata when 
      the request actually specifies a distinct timeframe.
"""

examples = [
    # ── Context-Aware (Requires reading timeline) ─────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- 45.0 -> 50.0\n- 120.0 -> 135.0\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut out the silent parts",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":45.0,\"end\":50.0,\"reason\":\"Cut silent section 1\"},{\"operation\":\"cut\",\"start\":120.0,\"end\":135.0,\"reason\":\"Cut silent section 2\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 180.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- 10.0 -> 20.0\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute the silent part just in case",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"mute\",\"start\":10.0,\"end\":20.0,\"reason\":\"Mute silent section\"}]}"
    },
    
    # ── Anti-Copy Contrastive Examples (Do NOT copy timeline blindly) ──────
    {
        "input": "[VIDEO METADATA]\nName: lecture.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- 74.0 -> 97.0\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove first 10 sec",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":10.0,\"reason\":\"Remove first 10 sec\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: speech.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 15.0s\n\n[TIMELINE STATE]\nCuts:\n- 100.0 -> 120.0\n\nMuted Sections:\n- 200.0 -> 215.0\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ntrim intro",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":15.0,\"reason\":\"Trim intro\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 50.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- 500.0 -> 505.0\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute audio from 1:00 to 2:00",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"mute\",\"start\":60.0,\"end\":120.0,\"reason\":\"Mute 1:00 to 2:00\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: review.mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 45.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- 20.0 -> 30.0\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut last 10 seconds",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":50.0,\"end\":60.0,\"reason\":\"Cut last 10 seconds\"}]}"
    }
]
