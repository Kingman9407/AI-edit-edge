"""
Category 12 — Operation Whitelist

Goal: Explicitly teach the model what operations are valid and invalid.
      VALID: cut, mute, add_audio_overlay
      INVALID: play, pause, stop, restore, end_all (should return [])
"""

examples = [
    {
        "metadata": "Name: video.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "play the video from 10s to 20s",
        "response":  "",
        "actions": []
    },
    {
        "metadata": "Name: video.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "pause the playback at 30 seconds",
        "response":  "",
        "actions": []
    },
    {
        "metadata": "Name: video.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "stop playing at the end",
        "response":  "",
        "actions": []
    },
    {
        "metadata": "Name: video.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: [{\"start\": 10.0, \"end\": 20.0}]\nSilent Sections: []\nBackground Music: []",
        "request":   "restore the cut from 10 to 20 seconds",
        "response":  "",
        "actions": []
    },
    {
        "metadata": "Name: video.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "end_all edits",
        "response":  "",
        "actions": []
    },
    {
        "metadata": "Name: video.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "play from 5s to 10s then pause, then cut from 15 to 20s",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 15.0, "end": 20.0, "reason": "Cut from 15 to 20s"}
        ]
    }
]
