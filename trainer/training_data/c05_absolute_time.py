"""
Category 05 — Absolute Time Reasoning

Goal: Teach the model to convert absolute time formats (MM:SS, minutes, seconds) into precise floats.
"""

examples = [
    {
        "metadata": "Name: demo.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "cut from 01:20 to 01:50",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 80.0, "end": 110.0, "reason": "Cut from 1:20 to 1:50"}
        ]
    },
    {
        "metadata": "Name: presentation.mp4\nType: video/mp4\nDuration: 1800.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "mute audio from 12:30 to 15:45",
        "response":  "",
        "actions": [
            {"operation": "mute", "start": 750.0, "end": 945.0, "reason": "Mute from 12:30 to 15:45"}
        ]
    },
    {
        "metadata": "Name: short.mp4\nType: video/mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "remove 00:15 to 00:30",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 15.0, "end": 30.0, "reason": "Cut from 0:15 to 0:30"}
        ]
    }
]
