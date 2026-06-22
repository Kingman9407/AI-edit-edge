"""
Category 12 — Operation Whitelist

Goal: Explicitly teach the model what operations are valid and invalid.
      VALID:   cut, mute, add_audio_overlay, merge_videos
      INVALID: play, pause, stop, restore, end_all (return [] with explanation)

Key rule: when a request mixes valid and invalid ops, execute the valid ones
          and silently ignore the invalid ones.
"""

examples = [

    # ── Invalid operations → empty ops ────────────────────────────────────

    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nplay the video from 10s to 20s",
        "output": "{\"message\":\"I can't control playback. I can cut, mute, or add music to your timeline instead.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\npause the playback at 30 seconds",
        "output": "{\"message\":\"I can't control playback. Let me know if you'd like to cut or mute a section instead.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nstop playing at the end",
        "output": "{\"message\":\"I don't control video playback. I can help with timeline edits like cuts and mutes.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 10.0 -> 20.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nrestore the cut from 10 to 20 seconds",
        "output": "{\"message\":\"Restoring or undoing cuts isn't supported. Let me know if you'd like to make a new edit.\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nend_all edits",
        "output": "{\"message\":\"That operation isn't supported. Let me know what you'd like to cut, mute, or add.\",\"operations\":[]}"
    },

    # ── Mixed: ignore invalid, execute valid ───────────────────────────────

    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- outro.mp4 (10.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nplay from 5s to 10s then pause, then cut from 15 to 20s",
        "output": "{\"message\":\"I can't control playback, but I've applied the cut from 15 to 20 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"15\",\"end\":\"20\",\"unit\":\"seconds\",\"reason\":\"Cut from 15 to 20s\"}]}"
    },

    # ── merge_videos IS a valid operation ──────────────────────────────────

    {
        "input": "[VIDEO METADATA]\nName: main.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- outro.mp4 (10.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\njoin outro.mp4 to the end",
        "output": "{\"message\":\"Joined outro.mp4 to the end of main.mp4.\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"main.mp4\",\"order\":1},{\"file\":\"outro.mp4\",\"order\":2}],\"reason\":\"Append outro.mp4 after main.mp4\"}]}"
    },
]
