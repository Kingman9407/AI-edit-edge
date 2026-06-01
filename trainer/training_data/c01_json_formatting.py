"""
Category 01 — JSON Formatting Discipline (Output Discipline)

Goal: Teach the model to output exactly ONE raw JSON object.
      It must NOT hallucinate markdown fences, backticks, or extra text.

Training order: FIRST — the model must learn this strict Single-Stage structure.
"""

examples = [
    # ── Reinforce: raw json object, no markdown, stop ────────────────────
    {
        "metadata": "Name: clip.mp4\nType: video/mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "cut the first 5 seconds",
        "response":  "I have applied the cut operation to remove the first 5 seconds of the video.",
        "actions": [
            {"operation": "cut", "start": 0.0, "end": 5.0, "reason": "Remove first 5 seconds"}
        ]
    },
    {
        "metadata": "Name: clip.mp4\nType: video/mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "mute from 10 to 20 seconds",
        "response":  "I have muted the audio track between 10 and 20 seconds as requested.",
        "actions": [
            {"operation": "mute", "start": 10.0, "end": 20.0, "reason": "Mute requested range"}
        ]
    },
    {
        "metadata": "Name: video.mp4\nType: video/mp4\nDuration: 90.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "add music.mp3 to entire video",
        "response":  "I have overlaid the background music track across the entire duration.",
        "actions": [
            {"operation": "add_audio_overlay", "start": 0.0, "end": 90.0,
             "reason": "Add background music to full video", "track": "music.mp3"}
        ]
    },
    {
        "metadata": "Name: vlog.mp4\nType: video/mp4\nDuration: 180.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "remove the last 10 seconds",
        "response":  "I've removed the final 10 seconds of the video.",
        "actions": [
            {"operation": "cut", "start": 170.0, "end": 180.0, "reason": "Remove last 10 seconds"}
        ]
    },
    {
        "metadata": "Name: podcast.mp4\nType: video/mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "mute from 60 to 90 seconds",
        "response":  "The audio has been muted for the requested section.",
        "actions": [
            {"operation": "mute", "start": 60.0, "end": 90.0, "reason": "Mute requested range"}
        ]
    },
]
