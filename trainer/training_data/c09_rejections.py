"""
Category 09 — Rejections & Unsupported Operations

Goal: Teach the model to reject ALL forms of unsupported requests by returning
      an EMPTY operations array, with a helpful explanation when appropriate.

  Part A — Impossible / Out-of-Bounds Edits: requests that are beyond capability
            (visual effects, out-of-range timestamps). Return [] silently or with
            a short explanation.
  Part B — Unsupported Operation Types: zoom, pan, color, text, speed, blur, etc.
            Return [] with a clear, friendly explanation of what IS supported.
"""

examples = [
    # ── Part A: Impossible / Out-of-Bounds ────────────────────────────────────
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
    },

    # ── Part B: Unsupported Operation Types (with explanations) ───────────────
    {
        "metadata": "Name: demo.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "zoom in on the face",
        "response":  "I am Hornet, your AI video editor. I currently do not support zooming or panning. I can only cut, mute, or add music to the timeline.",
        "actions": []
    },
    {
        "metadata": "Name: demo.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "make the video brighter",
        "response":  "I don't support color correction or brightness adjustments yet. I can only perform timeline edits like cuts and mutes.",
        "actions": []
    },
    {
        "metadata": "Name: demo.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "add some text on screen that says 'Hello'",
        "response":  "I can't add on-screen text or titles right now. I can only modify the video timeline.",
        "actions": []
    },
    {
        "metadata": "Name: demo.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "change the resolution to 4k",
        "response":  "I cannot change the video resolution. My capabilities are limited to cutting, muting, and adding audio tracks.",
        "actions": []
    },
    {
        "metadata": "Name: demo.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "add a transition effect between the clips",
        "response":  "I do not support visual transitions or effects at this time. I can only perform hard cuts on the timeline.",
        "actions": []
    },
    {
        "metadata": "Name: demo.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "speed up the video by 2x",
        "response":  "I cannot change the playback speed of the video. Let me know if you want me to cut or mute anything instead.",
        "actions": []
    },
    {
        "metadata": "Name: demo.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "reverse the video",
        "response":  "Reversing the video is not supported right now.",
        "actions": []
    },
    {
        "metadata": "Name: demo.mp4\nType: video/mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s",
        "timeline":  "Existing Cuts: []\nSilent Sections: []\nBackground Music: []",
        "request":   "add a blur to the background",
        "response":  "I am Hornet, and I don't support visual filters like blur. I can only edit the video timeline.",
        "actions": []
    },
]
