"""
Category 07 — Multi-Step Operations

Goal: Teach the model to output multiple actions in a single response.
"""

examples = [
    {
        "input": "[VIDEO METADATA]\nName: clip.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut intro and add bg.mp3 to the rest",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":10.0,\"reason\":\"Cut intro\"},{\"operation\":\"add_audio_overlay\",\"start\":10.0,\"end\":120.0,\"reason\":\"Add bg music\",\"track\":\"bg.mp3\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute first 10s and last 10s",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"mute\",\"start\":0.0,\"end\":10.0,\"reason\":\"Mute first 10s\"},{\"operation\":\"mute\",\"start\":290.0,\"end\":300.0,\"reason\":\"Mute last 10s\"}]}"
    }
]
