"""
Category 06 — Relative Time Reasoning (MOST IMPORTANT)

Goal: Teach the model natural time language (beginning, end, intro, etc.)
      This dataset provides many linguistic variations to ensure robust temporal reasoning.
"""

examples = [
    {
        "metadata": "Name: video1.mp4\nType: video/mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "remove first minute",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 0.0, "end": 60.0, "reason": "Remove first minute"}
        ]
    },
    {
        "metadata": "Name: video2.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "cut first 60 seconds",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 0.0, "end": 60.0, "reason": "Cut first 60 seconds"}
        ]
    },
    {
        "metadata": "Name: video3.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "trim intro",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 0.0, "end": 10.0, "reason": "Trim intro"}
        ]
    },
    {
        "metadata": "Name: video4.mp4\nType: video/mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "remove beginning",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 0.0, "end": 15.0, "reason": "Remove beginning"}
        ]
    },
    {
        "metadata": "Name: video5.mp4\nType: video/mp4\nDuration: 400.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "remove opening section",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 0.0, "end": 15.0, "reason": "Remove opening section"}
        ]
    },
    {
        "metadata": "Name: video6.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "cut ending",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 90.0, "end": 100.0, "reason": "Cut ending"}
        ]
    },
    {
        "metadata": "Name: video7.mp4\nType: video/mp4\nDuration: 200.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "remove last half",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 100.0, "end": 200.0, "reason": "Remove last half"}
        ]
    },
    {
        "metadata": "Name: video8.mp4\nType: video/mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "trim middle",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 20.0, "end": 40.0, "reason": "Trim middle"}
        ]
    },
    {
        "metadata": "Name: video9.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 120.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "remove section before current playhead",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 0.0, "end": 120.0, "reason": "Remove section before playhead"}
        ]
    },
    {
        "metadata": "Name: video10.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 150.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "cut next 20 seconds",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 150.0, "end": 170.0, "reason": "Cut next 20 seconds"}
        ]
    },
    {
        "metadata": "Name: video11.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 200.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "remove previous 10 sec",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 190.0, "end": 200.0, "reason": "Remove previous 10 sec"}
        ]
    },
    {
        "metadata": "Name: video12.mp4\nType: video/mp4\nDuration: 50.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "mute the first half of the video",
        "response":  "",
        "actions": [
            {"operation": "mute", "start": 0.0, "end": 25.0, "reason": "Mute first half"}
        ]
    },
    {
        "metadata": "Name: video13.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "remove first 1 min",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 0.0, "end": 60.0, "reason": "Remove first 1 minute"}
        ]
    },
    {
        "metadata": "Name: video14.mp4\nType: video/mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "cut the first 2 minutes",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 0.0, "end": 120.0, "reason": "Cut first 2 minutes"}
        ]
    },
    {
        "metadata": "Name: video15.mp4\nType: video/mp4\nDuration: 480.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "mute last 3 mins",
        "response":  "",
        "actions": [
            {"operation": "mute", "start": 300.0, "end": 480.0, "reason": "Mute last 3 minutes"}
        ]
    },
    {
        "metadata": "Name: video16.mp4\nType: video/mp4\nDuration: 480.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "remove next 1 min",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 0.0, "end": 60.0, "reason": "Cut next 1 min"}
        ]
    }
]
