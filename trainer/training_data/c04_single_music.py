"""
Category 04 — Single Music Operations

Goal: Teach the model to add background music.
"""

examples = [
    {
        "metadata": "Name: travel_vlog.mp4\nType: video/mp4\nDuration: 420.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "add upbeat.mp3 to the entire video",
        "response":  "",
        "actions": [
            {"operation": "add_audio_overlay", "start": 0.0, "end": 420.0, "reason": "Add background music to full video", "track": "upbeat.mp3"}
        ]
    },
    {
        "metadata": "Name: intro.mp4\nType: video/mp4\nDuration: 30.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "overlay lofi.mp3 from 5 to 25 seconds",
        "response":  "",
        "actions": [
            {"operation": "add_audio_overlay", "start": 5.0, "end": 25.0, "reason": "Add music overlay", "track": "lofi.mp3"}
        ]
    },
    {
        "metadata": "Name: presentation.mp4\nType: video/mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "insert background.mp3 starting from minute 2 until minute 5",
        "response":  "",
        "actions": [
            {"operation": "add_audio_overlay", "start": 120.0, "end": 300.0, "reason": "Add background music", "track": "background.mp3"}
        ]
    }
]
