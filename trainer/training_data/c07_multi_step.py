"""
Category 07 — Multi-Step Operations

Goal: Teach the model to output multiple operations in a single response.
      Includes cut+music, mute combos, and merge+cut/mute workflows.
      No tool_call / tool_result — all resolution is server-side.
"""

examples = [
    # ── cut intro + add music to the rest ─────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: clip.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut intro and add bg.mp3 to the rest",
        "output": "{\"message\":\"Cut the intro and added bg.mp3 to the rest.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Cut intro\"},{\"operation\":\"add_audio_overlay\",\"variation\":\"range\",\"start\":\"10\",\"end\":\"120\",\"unit\":\"seconds\",\"track\":\"bg.mp3\",\"reason\":\"Add bg music to the rest\"}]}"
    },

    # ── mute first + last N seconds ────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute first 10s and last 10s",
        "output": "{\"message\":\"Muted the first 10 seconds and last 10 seconds.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"first\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Mute first 10s\"},{\"operation\":\"mute\",\"variation\":\"last\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Mute last 10s\"}]}"
    },

    # ── merge + cut first N seconds ────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- outro.mp4 (15.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nadd outro.mp4 to the end and cut the first 5 seconds",
        "output": "{\"message\":\"Appended the outro and trimmed the first 5 seconds.\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"interview.mp4\",\"order\":1},{\"file\":\"outro.mp4\",\"order\":2}],\"reason\":\"Append outro.mp4 after interview.mp4\"},{\"operation\":\"cut\",\"variation\":\"first\",\"value\":5,\"unit\":\"seconds\",\"reason\":\"Trim first 5 seconds\"}]}"
    },

    # ── merge + mute range ─────────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: podcast_ep3.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- sponsor_ad.mp4 (30.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nappend the sponsor ad at the end and mute from 10s to 20s",
        "output": "{\"message\":\"Sponsor ad appended and the 10 to 20 second section is muted.\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"podcast_ep3.mp4\",\"order\":1},{\"file\":\"sponsor_ad.mp4\",\"order\":2}],\"reason\":\"Append sponsor_ad.mp4 after podcast_ep3.mp4\"},{\"operation\":\"mute\",\"variation\":\"range\",\"start\":\"10\",\"end\":\"20\",\"unit\":\"seconds\",\"reason\":\"Mute 10s to 20s section\"}]}"
    },

    # ── merge + cut last + add music ───────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: vlog_raw.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- end_card.mp4 (10.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nput end_card.mp4 at the back, cut last 30 seconds of the vlog, and add bg.mp3 throughout",
        "output": "{\"message\":\"End card appended, last 30 seconds cut, and background music added.\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"vlog_raw.mp4\",\"order\":1},{\"file\":\"end_card.mp4\",\"order\":2}],\"reason\":\"Append end_card.mp4 after vlog_raw.mp4\"},{\"operation\":\"cut\",\"variation\":\"last\",\"value\":30,\"unit\":\"seconds\",\"reason\":\"Cut last 30 seconds of vlog\"},{\"operation\":\"add_audio_overlay\",\"variation\":\"range\",\"start\":\"0\",\"end\":\"300\",\"unit\":\"seconds\",\"track\":\"bg.mp3\",\"reason\":\"Add background music throughout\"}]}"
    },
]
