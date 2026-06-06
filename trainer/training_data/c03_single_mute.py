"""
Category 03 — Single Mute Operations

Goal: Teach the model mute variations.
      Outputs exactly one mute action.
"""

examples = [
    {
        "input": "[VIDEO METADATA]\nName: zoom_meeting.mp4\nDuration: 180.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute the audio from 45 seconds to 1 minute",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"mute\",\"start\":45.0,\"end\":60.0,\"reason\":\"Mute requested range from 0:45 to 1:00\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: outdoor_vlog.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute audio from 120s to 150s",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"mute\",\"start\":120.0,\"end\":150.0,\"reason\":\"Mute requested range from 120s to 150s\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove sound from the first 10 seconds",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"mute\",\"start\":0.0,\"end\":10.0,\"reason\":\"Mute first 10 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: lecture.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nsilence the last 30 seconds",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"mute\",\"start\":570.0,\"end\":600.0,\"reason\":\"Mute last 30 seconds\"}]}"
    }
]
