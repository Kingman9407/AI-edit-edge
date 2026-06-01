"""
Category 07 — Multi-Step Operations

Goal: Teach the model to output multiple actions in a single response.
"""

examples = [
    {
        "metadata": "Name: clip.mp4\nType: video/mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "cut intro and add bg.mp3 to the rest",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 0.0, "end": 10.0, "reason": "Cut intro"},
            {"operation": "add_audio_overlay", "start": 10.0, "end": 120.0, "reason": "Add bg music", "track": "bg.mp3"}
        ]
    },
    {
        "metadata": "Name: vlog.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "mute first 10s and last 10s",
        "response":  "",
        "actions": [
            {"operation": "mute", "start": 0.0, "end": 10.0, "reason": "Mute first 10s"},
            {"operation": "mute", "start": 290.0, "end": 300.0, "reason": "Mute last 10s"}
        ]
    }
]
