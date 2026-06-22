"""
Category 09 — Rejections & Unsupported Operations

Goal: Teach the model to reject ALL forms of unsupported requests by returning
      an EMPTY operations array with a helpful explanation.

  Part A — Unsupported visual effects: zoom, color, text, blur, speed, reverse.
  Part B — Merge with no available clip in media bin.

Note: Out-of-bounds timestamp requests (e.g. cut at 120s on a 60s video) are
      NOT rejected here — they are valid semantic ops that the backend clamps.
      This file covers operations the system fundamentally cannot perform.
"""

examples = [

    # ── Part A: Unsupported visual/effects operations ──────────────────────

    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nzoom in on the face",
        "output": "{\"message\":\"I don't support zooming or panning. I can cut, mute, or add music to the timeline.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmake the video brighter",
        "output": "{\"message\":\"I don't support color correction or brightness adjustments. I can only perform timeline edits like cuts and mutes.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nadd some text on screen that says 'Hello'",
        "output": "{\"message\":\"I can't add on-screen text or titles right now. I can only modify the video timeline.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nchange the resolution to 4k",
        "output": "{\"message\":\"I can't change the video resolution. My capabilities are limited to cutting, muting, and adding audio tracks.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nadd a transition effect between the clips",
        "output": "{\"message\":\"I don't support visual transitions or effects. I can only perform hard cuts on the timeline.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nspeed up the video by 2x",
        "output": "{\"message\":\"I can't change the playback speed. Let me know if you want me to cut or mute anything instead.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nreverse the video",
        "output": "{\"message\":\"Reversing the video is not supported right now.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nadd a blur to the background",
        "output": "{\"message\":\"I don't support visual filters like blur. I can only edit the video timeline.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmake it look like a hollywood movie",
        "output": "{\"message\":\"I can't apply cinematic filters or visual effects. I can help you cut, mute, or add music instead.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nadd a 3D explosion effect at 10s",
        "output": "{\"message\":\"Visual effects like explosions aren't supported. I can only perform timeline edits.\",\"operations\":[]}"
    },

    # ── Part B: Merge with no available clip ───────────────────────────────

    {
        "input": "[VIDEO METADATA]\nName: solo.mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- None\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmerge another video here",
        "output": "{\"message\":\"There are no additional clips in your media bin to merge. Please upload a second video first.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: clip.mp4\nDuration: 45.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- None\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\njoin this with another clip",
        "output": "{\"message\":\"I don't see any other clip available to merge with. Add a second video to the media bin and I'll join them.\",\"operations\":[]}"
    },
]
