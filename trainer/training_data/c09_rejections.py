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
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmake it look like a hollywood movie",
        "output": "{\"message\":\"I'm sorry, I couldn't find any video edits in your request, but I am a video editor AI and I'm happy to help!\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nadd a 3D explosion effect at 10s",
        "output": "{\"message\":\"I'm sorry, I couldn't find any video edits in your request, but I am a video editor AI and I'm happy to help!\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut from 120s to 150s",
        "output": "{\"message\":\"I'm sorry, I couldn't find any video edits in your request, but I am a video editor AI and I'm happy to help!\",\"operations\":[]}"
    },

    # ── Part B: Unsupported Operation Types (with explanations) ───────────────
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nzoom in on the face",
        "output": "{\"message\":\"I currently do not support zooming or panning. I can only cut, mute, or add music to the timeline.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmake the video brighter",
        "output": "{\"message\":\"I don't support color correction or brightness adjustments yet. I can only perform timeline edits like cuts and mutes.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nadd some text on screen that says 'Hello'",
        "output": "{\"message\":\"I can't add on-screen text or titles right now. I can only modify the video timeline.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nchange the resolution to 4k",
        "output": "{\"message\":\"I cannot change the video resolution. My capabilities are limited to cutting, muting, and adding audio tracks.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nadd a transition effect between the clips",
        "output": "{\"message\":\"I do not support visual transitions or effects at this time. I can only perform hard cuts on the timeline.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nspeed up the video by 2x",
        "output": "{\"message\":\"I cannot change the playback speed of the video. Let me know if you want me to cut or mute anything instead.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nreverse the video",
        "output": "{\"message\":\"Reversing the video is not supported right now.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nadd a blur to the background",
        "output": "{\"message\":\"I don't support visual filters like blur. I can only edit the video timeline.\",\"operations\":[]}"
    }
]
