"""
Category 10 — Context-Aware Edits & Anti-Copy Training

Goal: Teach the model to read the TIMELINE STATE to resolve ambiguous requests,
      while ALSO teaching it NOT to blindly copy timeline metadata when 
      the request actually specifies a distinct timeframe.
"""

examples = [
    # ── Context-Aware (Requires reading timeline) ─────────────────────────
    {
        "metadata": "Name: vlog.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: [{\"start\": 45.0, \"end\": 50.0}, {\"start\": 120.0, \"end\": 135.0}]\nBackground Music: []",
        "request":   "cut out the silent parts",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 45.0, "end": 50.0, "reason": "Cut silent section 1"},
            {"operation": "cut", "start": 120.0, "end": 135.0, "reason": "Cut silent section 2"}
        ]
    },
    {
        "metadata": "Name: tutorial.mp4\nType: video/mp4\nDuration: 180.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: [{\"start\": 10.0, \"end\": 20.0}]\nBackground Music: []",
        "request":   "mute the silent part just in case",
        "response":  "",
        "actions": [
            {"operation": "mute", "start": 10.0, "end": 20.0, "reason": "Mute silent section"} 
        ]
    },
    
    # ── Anti-Copy Contrastive Examples (Do NOT copy timeline blindly) ──────
    {
        "metadata": "Name: lecture.mp4\nType: video/mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: [{\"start\": 74.0, \"end\": 97.0}]\nBackground Music: []",
        "request":   "remove first 10 sec",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 0.0, "end": 10.0, "reason": "Remove first 10 sec"} 
        ]
    },
    {
        "metadata": "Name: speech.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 15.0s",
        "timeline":  "Existing Cuts: [{\"start\": 100.0, \"end\": 120.0}]\nSilent Sections: [{\"start\": 200.0, \"end\": 215.0}]\nBackground Music: []",
        "request":   "trim intro",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 0.0, "end": 15.0, "reason": "Trim intro"} 
        ]
    },
    {
        "metadata": "Name: podcast.mp4\nType: video/mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 50.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: [{\"start\": 500.0, \"end\": 505.0}]\nBackground Music: []",
        "request":   "mute audio from 1:00 to 2:00",
        "response":  "",
        "actions": [
            {"operation": "mute", "start": 60.0, "end": 120.0, "reason": "Mute 1:00 to 2:00"} 
        ]
    },
    {
        "metadata": "Name: review.mp4\nType: video/mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 45.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: [{\"start\": 20.0, \"end\": 30.0}]\nBackground Music: []",
        "request":   "cut last 10 seconds",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 50.0, "end": 60.0, "reason": "Cut last 10 seconds"} 
        ]
    }
]
