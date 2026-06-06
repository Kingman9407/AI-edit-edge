"""
Category 04 — Single Music Operations

Goal: Teach the model to add background music.
"""

examples = [
    {
        "input": "[VIDEO METADATA]\nName: travel_vlog.mp4\nDuration: 420.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nadd upbeat.mp3 to the entire video",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"add_audio_overlay\",\"start\":0.0,\"end\":420.0,\"reason\":\"Add background music to full video\",\"track\":\"upbeat.mp3\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: intro.mp4\nDuration: 30.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\noverlay lofi.mp3 from 5 to 25 seconds",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"add_audio_overlay\",\"start\":5.0,\"end\":25.0,\"reason\":\"Add music overlay\",\"track\":\"lofi.mp3\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: presentation.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ninsert background.mp3 starting from minute 2 until minute 5",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"add_audio_overlay\",\"start\":120.0,\"end\":300.0,\"reason\":\"Add background music\",\"track\":\"background.mp3\"}]}"
    }
]
