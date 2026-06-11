"""
Category 07 — Multi-Step Operations

Goal: Teach the model to output multiple actions in a single response.
      Includes merge + cut/mute combos to support multi-video workflows.
"""

examples = [
    {
        "input": "[VIDEO METADATA]\nName: clip.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut intro and add bg.mp3 to the rest",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":10.0,\"reason\":\"Cut intro\"},{\"operation\":\"add_audio_overlay\",\"start\":10.0,\"end\":120.0,\"reason\":\"Add bg music\",\"track\":\"bg.mp3\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute first 10s and last 10s",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"mute\",\"start\":0.0,\"end\":10.0,\"reason\":\"Mute first 10s\"},{\"operation\":\"mute\",\"start\":290.0,\"end\":300.0,\"reason\":\"Mute last 10s\"}]}"
    },

    # ── Merge + cut combos ────────────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- outro.mp4 (15.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nadd outro.mp4 to the end and cut the first 5 seconds",
        "output": "{\"message\":\"Done! I've appended the outro and trimmed the first 5 seconds.\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"interview.mp4\",\"order\":1},{\"file\":\"outro.mp4\",\"order\":2}],\"reason\":\"Append outro.mp4 after interview.mp4\"},{\"operation\":\"cut\",\"start\":0.0,\"end\":5.0,\"reason\":\"Trim first 5 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast_ep3.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- sponsor_ad.mp4 (30.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nappend the sponsor ad at the end and mute from 10s to 20s",
        "output": "{\"message\":\"Got it! Sponsor ad appended and the 10–20s section is muted.\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"podcast_ep3.mp4\",\"order\":1},{\"file\":\"sponsor_ad.mp4\",\"order\":2}],\"reason\":\"Append sponsor_ad.mp4 after podcast_ep3.mp4\"},{\"operation\":\"mute\",\"start\":10.0,\"end\":20.0,\"reason\":\"Mute 10s to 20s section\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog_raw.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- end_card.mp4 (10.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nput end_card.mp4 at the back, cut last 30 seconds of the vlog, and add bg.mp3 throughout",
        "output": "{\"message\":\"All done! End card appended, last 30 seconds cut, and background music added.\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"vlog_raw.mp4\",\"order\":1},{\"file\":\"end_card.mp4\",\"order\":2}],\"reason\":\"Append end_card.mp4 after vlog_raw.mp4\"},{\"operation\":\"cut\",\"start\":270.0,\"end\":300.0,\"reason\":\"Cut last 30 seconds of vlog\"},{\"operation\":\"add_audio_overlay\",\"start\":0.0,\"end\":300.0,\"reason\":\"Add background music throughout\",\"track\":\"bg.mp3\"}]}"
    }
]
