"""
Category 02 — Single Cut Operations

Goal: Teach the model all cut/trim/remove/delete variations.
      Every example outputs exactly one cut action.
"""

examples = [
    {
        "metadata": "Name: vlog_entry_01.mp4\nType: video/mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: [{\"start\": 10.5, \"end\": 15.2}]\nBackground Music: []",
        "request":   "remove the silent gap in the beginning of the video",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 10.5, "end": 15.2, "reason": "Remove silent gap"}
        ]
    },
    {
        "metadata": "Name: cooking_tutorial.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 100.0s",
        "timeline":  "Existing Cuts: [{\"start\": 0.0, \"end\": 10.0}]\nSilent Sections: [{\"start\": 150.0, \"end\": 165.5}]\nBackground Music: []",
        "request":   "cut the quiet gap in the middle of the video",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 150.0, "end": 165.5, "reason": "Remove quiet gap in middle"}
        ]
    },
    {
        "metadata": "Name: intro_clip.mp4\nType: video/mp4\nDuration: 50.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "trim off the first 5 seconds",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 0.0, "end": 5.0, "reason": "Remove first 5 seconds"}
        ]
    },
    {
        "metadata": "Name: unboxing.mov\nType: video/quicktime\nDuration: 240.0s\nResolution: 1920x1080\nPlayhead: 120.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "cut out the segment from minute 2 to minute 2.5",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 120.0, "end": 150.0, "reason": "Cut requested range from 2:00 to 2:30"}
        ]
    },
    {
        "metadata": "Name: podcast_master.mp4\nType: video/mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "cut out the portion from 1:15 to 1:45",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 75.0, "end": 105.0, "reason": "Cut requested range from 1:15 to 1:45"}
        ]
    },
    {
        "metadata": "Name: long_interview.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 120.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "delete everything from the current playhead position to the very end of the video",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 120.0, "end": 300.0, "reason": "Remove from playhead to end"}
        ]
    },
    {
        "metadata": "Name: short_vlog.mp4\nType: video/mp4\nDuration: 90.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "cut intro",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 0.0, "end": 10.0, "reason": "Remove intro"}
        ]
    },
    {
        "metadata": "Name: promo.mp4\nType: video/mp4\nDuration: 60.0s\nResolution: 1280x720\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "remove beginning",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 0.0, "end": 15.0, "reason": "Remove beginning segment"}
        ]
    },
    {
        "metadata": "Name: demo.mov\nType: video/quicktime\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "delete last 45 seconds",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 75.0, "end": 120.0, "reason": "Remove last 45 seconds"}
        ]
    },
    {
        "metadata": "Name: gameplay_full.mp4\nType: video/mp4\nDuration: 180.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "remove middle section",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 60.0, "end": 120.0, "reason": "Remove middle third of video"}
        ]
    },
    {
        "metadata": "Name: review.mp4\nType: video/mp4\nDuration: 180.0s\nResolution: 1920x1080\nPlayhead: 10.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: [{\"start\": 130.0, \"end\": 142.5}]\nBackground Music: []",
        "request":   "remove that long silent period near the end of the video",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 130.0, "end": 142.5, "reason": "Remove long silent period near end"}
        ]
    },
    {
        "metadata": "Name: interview.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "trim from 1:20 to 2:10",
        "response":  "",
        "actions": [
            {"operation": "cut", "start": 80.0, "end": 130.0, "reason": "Cut range from 1:20 to 2:10"}
        ]
    },
]
