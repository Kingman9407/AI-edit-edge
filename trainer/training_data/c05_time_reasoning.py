"""
Category 05 — Time Reasoning (Absolute + Relative)

Goal: Teach the model to resolve ALL forms of time reference into precise float seconds.

  Part A — Absolute Time: convert MM:SS format strings into exact floats.
  Part B — Relative Time: understand natural language like "first minute",
            "last half", "before playhead", "next 20 sec", "trim intro", etc.
            This is the MOST IMPORTANT temporal skill for the agent.
"""

examples = [
    # ── Part A: Absolute Time (MM:SS → float) ────────────────────────────────
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
    },

    # ── Part B: Relative Time (natural language → inferred range) ─────────────
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
    },
    {
        "metadata": "Name: video17.mp4\nType: video/mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "remove from 2 min to 3 min",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 120.0, "end": 180.0, "reason": "Cut from 2 min to 3 min"}
        ]
    },
    {
        "metadata": "Name: video18.mp4\nType: video/mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "cut from 1 minute to 4 minutes",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 60.0, "end": 240.0, "reason": "Cut from 1 minute to 4 minutes"}
        ]
    },
    {
        "metadata": "Name: video19.mp4\nType: video/mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "mute audio from 5 mins to 8 mins",
        "response":  "",
        "actions": [
            {"operation": "mute", "start": 300.0, "end": 480.0, "reason": "Mute from 5 mins to 8 mins"}
        ]
    },
]
