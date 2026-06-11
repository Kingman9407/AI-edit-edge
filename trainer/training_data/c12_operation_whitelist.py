"""
Category 12 — Operation Whitelist

Goal: Explicitly teach the model what operations are valid and invalid.
      VALID: cut, mute, add_audio_overlay, merge_videos
      INVALID: play, pause, stop, restore, end_all (should return [])
"""

examples = [
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nplay the video from 10s to 20s",
        "output": "{\"message\":\"I'm sorry, I couldn't find any video edits in your request, but I am a video editor AI and I'm happy to help!\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\npause the playback at 30 seconds",
        "output": "{\"message\":\"I'm sorry, I couldn't find any video edits in your request, but I am a video editor AI and I'm happy to help!\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nstop playing at the end",
        "output": "{\"message\":\"I'm sorry, I couldn't find any video edits in your request, but I am a video editor AI and I'm happy to help!\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 10.0 -> 20.0\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nrestore the cut from 10 to 20 seconds",
        "output": "{\"message\":\"I'm sorry, I couldn't find any video edits in your request, but I am a video editor AI and I'm happy to help!\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nend_all edits",
        "output": "{\"message\":\"I'm sorry, I couldn't find any video edits in your request, but I am a video editor AI and I'm happy to help!\",\"operations\":[]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- outro.mp4 (10.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nplay from 5s to 10s then pause, then cut from 15 to 20s",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":15.0,\"end\":20.0,\"reason\":\"Cut from 15 to 20s\"}]}"
    },

    # ── merge_videos IS a valid operation ────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: main.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- outro.mp4 (10.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\njoin outro.mp4 to the end",
        "output": "{\"message\":\"Done! outro.mp4 has been joined to the end of main.mp4.\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"main.mp4\",\"order\":1},{\"file\":\"outro.mp4\",\"order\":2}],\"reason\":\"Append outro.mp4 after main.mp4\"}]}"
    }
]
