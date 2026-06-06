"""
Category 13 — Chat History

Goal: Train the model to consider previous conversational context.
"""

examples = [
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 10.0\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nalso do the same for the last 10 seconds",
        "output": "{\"message\":\"I have applied the cut to the last 10 seconds as well.\",\"operations\":[{\"operation\":\"cut\",\"start\":290.0,\"end\":300.0,\"reason\":\"Cut last 10 seconds\"}]}",
        "history": [
            {
                "role": "user",
                "content": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove first 10 seconds"
            },
            {
                "role": "assistant",
                "content": "{\"message\":\"I have cut the first 10 seconds.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":10.0,\"reason\":\"Remove first 10 seconds\"}]}"
            }
        ]
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- 60.0 -> 120.0\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncan you cut that section out completely instead?",
        "output": "{\"message\":\"I have removed the section from 1 minute to 2 minutes.\",\"operations\":[{\"operation\":\"cut\",\"start\":60.0,\"end\":120.0,\"reason\":\"Replace mute with cut from 1 to 2 minutes\"}]}",
        "history": [
            {
                "role": "user",
                "content": "[VIDEO METADATA]\nName: podcast.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute from 1 min to 2 min"
            },
            {
                "role": "assistant",
                "content": "{\"message\":\"I have muted the audio from 1 minute to 2 minutes.\",\"operations\":[{\"operation\":\"mute\",\"start\":60.0,\"end\":120.0,\"reason\":\"Mute from 1 to 2 minutes\"}]}"
            }
        ]
    }
]
