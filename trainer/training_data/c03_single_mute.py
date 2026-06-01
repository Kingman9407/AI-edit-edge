"""
Category 03 — Single Mute Operations

Goal: Teach the model mute variations.
      Outputs exactly one mute action.
"""

examples = [
    {
        "metadata": "Name: zoom_meeting.mp4\nType: video/mp4\nDuration: 180.0s\nResolution: 1280x720\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "mute the audio from 45 seconds to 1 minute",
        "response":  "",
        "actions": [
            {"operation": "mute", "start": 45.0, "end": 60.0, "reason": "Mute requested range from 0:45 to 1:00"}
        ]
    },
    {
        "metadata": "Name: outdoor_vlog.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "mute audio from 120s to 150s",
        "response":  "",
        "actions": [
            {"operation": "mute", "start": 120.0, "end": 150.0, "reason": "Mute requested range from 120s to 150s"}
        ]
    },
    {
        "metadata": "Name: tutorial.mp4\nType: video/mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "remove sound from the first 10 seconds",
        "response":  "",
        "actions": [
            {"operation": "mute", "start": 0.0, "end": 10.0, "reason": "Mute first 10 seconds"}
        ]
    },
    {
        "metadata": "Name: lecture.mp4\nType: video/mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "silence the last 30 seconds",
        "response":  "",
        "actions": [
            {"operation": "mute", "start": 570.0, "end": 600.0, "reason": "Mute last 30 seconds"}
        ]
    }
]
