"""
Category 08 — Conversation (Safety Net / Negative Training)

Goal: Even with the 2-stage pipeline, if a casual message slips into EDIT mode, 
      the model must return an empty JSON array to prevent hallucinated edits.
"""

examples = [
    {
        "metadata": "Name: video.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "hi there",
        "response":  "",
        "actions": []
    },
    {
        "metadata": "Name: video.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "what can you do",
        "response":  "",
        "actions": []
    },
    {
        "metadata": "Name: video.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "play video",
        "response":  "",
        "actions": []
    },
    {
        "metadata": "Name: video.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "pause here",
        "response":  "",
        "actions": []
    }
]
