"""
Category 14 — Merge / Concatenate Videos

Goal: Teach the model to join two or more video clips together in sequence.
      The model outputs a 'merge_videos' operation with an ordered list of
      clips to concatenate (front → back).

Operation schema:
  {
    "operation": "merge_videos",
    "clips": [
      {"file": "<filename>", "order": 1},
      {"file": "<filename>", "order": 2}
    ],
    "reason": "<short explanation>"
  }

The [VIDEO METADATA] block lists the PRIMARY (currently open) video.
A [MEDIA BIN] block lists additional available clips.

Note: The primary video is always a valid source clip. The model must place
clips in the order implied by the user's request.
"""

examples = [

    # ── Basic front-back merge ────────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: part1.mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- part2.mp4 (45.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmerge part2.mp4 after this video",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"part1.mp4\",\"order\":1},{\"file\":\"part2.mp4\",\"order\":2}],\"reason\":\"Concatenate part2.mp4 after part1.mp4\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: intro.mp4\nDuration: 15.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- main_content.mp4 (300.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nadd main_content.mp4 at the end",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"intro.mp4\",\"order\":1},{\"file\":\"main_content.mp4\",\"order\":2}],\"reason\":\"Append main_content.mp4 after intro.mp4\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: segment_a.mp4\nDuration: 90.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- segment_b.mp4 (90.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\njoin segment_b.mp4 to the back of this clip",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"segment_a.mp4\",\"order\":1},{\"file\":\"segment_b.mp4\",\"order\":2}],\"reason\":\"Join segment_b.mp4 after segment_a.mp4\"}]}"
    },

    # ── Prepend (put existing video AFTER a new clip) ─────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: main_video.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- opening_card.mp4 (5.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nput opening_card.mp4 before this video",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"opening_card.mp4\",\"order\":1},{\"file\":\"main_video.mp4\",\"order\":2}],\"reason\":\"Prepend opening_card.mp4 before main_video.mp4\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: episode2.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- recap.mp4 (30.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nadd the recap clip to the beginning",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"recap.mp4\",\"order\":1},{\"file\":\"episode2.mp4\",\"order\":2}],\"reason\":\"Prepend recap.mp4 before episode2.mp4\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: body.mp4\nDuration: 200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- intro_clip.mp4 (10.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nplace intro_clip.mp4 at the front",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"intro_clip.mp4\",\"order\":1},{\"file\":\"body.mp4\",\"order\":2}],\"reason\":\"Prepend intro_clip.mp4 before body.mp4\"}]}"
    },

    # ── Outro / Tail-end append ───────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 480.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- outro.mp4 (12.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nattach the outro clip at the end",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"tutorial.mp4\",\"order\":1},{\"file\":\"outro.mp4\",\"order\":2}],\"reason\":\"Attach outro.mp4 after tutorial.mp4\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog_day1.mp4\nDuration: 360.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- subscribe_cta.mp4 (8.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nappend the subscribe call-to-action clip at the tail end",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"vlog_day1.mp4\",\"order\":1},{\"file\":\"subscribe_cta.mp4\",\"order\":2}],\"reason\":\"Append subscribe_cta.mp4 after vlog_day1.mp4\"}]}"
    },

    # ── Three-clip merge ──────────────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: act1.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- act2.mp4 (150.0s)\n- act3.mp4 (90.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncombine act1, act2, and act3 in order",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"act1.mp4\",\"order\":1},{\"file\":\"act2.mp4\",\"order\":2},{\"file\":\"act3.mp4\",\"order\":3}],\"reason\":\"Concatenate all three acts in order\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: clip_a.mp4\nDuration: 30.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- clip_b.mp4 (30.0s)\n- clip_c.mp4 (30.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\njoin all three clips one after another",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"clip_a.mp4\",\"order\":1},{\"file\":\"clip_b.mp4\",\"order\":2},{\"file\":\"clip_c.mp4\",\"order\":3}],\"reason\":\"Concatenate clip_a, clip_b, and clip_c in sequence\"}]}"
    },

    # ── Natural-language phrasing variants ────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: raw_footage.mp4\nDuration: 240.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- b_roll.mp4 (60.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nstitch b_roll.mp4 to the end of this",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"raw_footage.mp4\",\"order\":1},{\"file\":\"b_roll.mp4\",\"order\":2}],\"reason\":\"Stitch b_roll.mp4 after raw_footage.mp4\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: presentation.mp4\nDuration: 900.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- thank_you_slide.mp4 (5.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nglue thank_you_slide.mp4 at the back",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"presentation.mp4\",\"order\":1},{\"file\":\"thank_you_slide.mp4\",\"order\":2}],\"reason\":\"Append thank_you_slide.mp4 after presentation.mp4\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: highlight_reel.mp4\nDuration: 215.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- brand_logo.mp4 (3.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nconnect the brand logo clip right after this video",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"highlight_reel.mp4\",\"order\":1},{\"file\":\"brand_logo.mp4\",\"order\":2}],\"reason\":\"Connect brand_logo.mp4 after highlight_reel.mp4\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: documentary.mp4\nDuration: 1800.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- credits.mp4 (90.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nlink credits.mp4 to the end of the documentary",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"documentary.mp4\",\"order\":1},{\"file\":\"credits.mp4\",\"order\":2}],\"reason\":\"Append credits.mp4 after documentary.mp4\"}]}"
    },

    # ── Merge then cut/mute (multi-step) ──────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: interview_raw.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- closing_shot.mp4 (20.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmerge closing_shot.mp4 at the end and then cut the first 10 seconds",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"interview_raw.mp4\",\"order\":1},{\"file\":\"closing_shot.mp4\",\"order\":2}],\"reason\":\"Append closing_shot.mp4 after interview_raw.mp4\"},{\"operation\":\"cut\",\"start\":0.0,\"end\":10.0,\"reason\":\"Remove first 10 seconds of interview\"}]}"
    },

    # ── Merge without explicit file name in bin (referring to 'another clip') ─
    {
        "input": "[VIDEO METADATA]\nName: part_one.mp4\nDuration: 150.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- part_two.mp4 (150.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncombine the two clips",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"part_one.mp4\",\"order\":1},{\"file\":\"part_two.mp4\",\"order\":2}],\"reason\":\"Concatenate part_one.mp4 and part_two.mp4\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video_a.mp4\nDuration: 80.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- video_b.mp4 (80.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nput these two videos together",
        "output": "{\"message\":\"the merge operation have been performed\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"video_a.mp4\",\"order\":1},{\"file\":\"video_b.mp4\",\"order\":2}],\"reason\":\"Concatenate video_a.mp4 and video_b.mp4\"}]}"
    },

    # ── No clip in bin (reject gracefully) ────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: solo_video.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- None\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmerge another clip to this video",
        "output": "{\"message\":\"I don't see any other clips in your media bin to merge with. Please add a second video first.\",\"operations\":[]}"
    },
]
