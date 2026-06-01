"""
Category 13 — Chat History

Goal: Train the model to consider previous conversational context.
"""
import json

examples = [
    {
        "metadata": "Name: demo.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  'Existing Cuts: [{"start": 0.0, "end": 10.0}]\nSilent Sections: []\nBackground Music: []',
        "history": [
            {
                "role": "user",
                "content": "[VIDEO METADATA]\nName: demo.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nExisting Cuts: []\nSilent Sections: []\nBackground Music: []\n\n[USER REQUEST]\nremove first 10 seconds"
            },
            {
                "role": "assistant",
                "content": '{\n  "message": "I have cut the first 10 seconds.",\n  "operations": [\n    {\n      "operation": "cut",\n      "start": 0.0,\n      "end": 10.0,\n      "reason": "Remove first 10 seconds"\n    }\n  ]\n}'
            }
        ],
        "request":   "also do the same for the last 10 seconds",
        "response":  "I have applied the cut to the last 10 seconds as well.",
        "actions": [
            {"operation": "cut", "start": 290.0, "end": 300.0, "reason": "Cut last 10 seconds"}
        ]
    },
    {
        "metadata": "Name: podcast.mp4\nType: video/mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  'Existing Cuts: []\nSilent Sections: [{"start": 60.0, "end": 120.0}]\nBackground Music: []',
        "history": [
            {
                "role": "user",
                "content": "[VIDEO METADATA]\nName: podcast.mp4\nType: video/mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nExisting Cuts: []\nSilent Sections: []\nBackground Music: []\n\n[USER REQUEST]\nmute from 1 min to 2 min"
            },
            {
                "role": "assistant",
                "content": '{\n  "message": "I have muted the audio from 1 minute to 2 minutes.",\n  "operations": [\n    {\n      "operation": "mute",\n      "start": 60.0,\n      "end": 120.0,\n      "reason": "Mute from 1 to 2 minutes"\n    }\n  ]\n}'
            }
        ],
        "request":   "can you cut that section out completely instead?",
        "response":  "I have removed the section from 1 minute to 2 minutes.",
        "actions": [
            {"operation": "cut", "start": 60.0, "end": 120.0, "reason": "Replace mute with cut from 1 to 2 minutes"}
        ]
    },
]
