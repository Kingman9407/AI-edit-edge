"""
Category 09 — Error Handling (Negative Training)

Goal: Teach the model to reject impossible/unsupported edits by returning an empty JSON array.
"""

examples = [
    {
        "metadata": "Name: video.mp4\nType: video/mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "make it look like a hollywood movie",
        "response":  "",
        "actions": []
    },
    {
        "metadata": "Name: video.mp4\nType: video/mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "add a 3D explosion effect at 10s",
        "response":  "",
        "actions": []
    },
    {
        "metadata": "Name: video.mp4\nType: video/mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "cut from 120s to 150s",  # Invalid, beyond duration
        "response":  "",
        "actions": []
    }
]
