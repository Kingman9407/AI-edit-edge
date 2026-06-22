"""
Category 14 — Merge / Concatenate Videos

Goal: Teach the model to join two or more video clips together in sequence.
      The model outputs a 'merge_videos' operation with an ordered list of clips.

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
The [MEDIA BIN] block lists additional available clips.
merge_videos does NOT use variation/value/unit — it has its own schema.
"""

examples = [

    # ── Append clip at end ─────────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: part1.mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- part2.mp4 (45.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmerge part2.mp4 after this video",
        "output": "{\"message\":\"Merged part2.mp4 after part1.mp4.\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"part1.mp4\",\"order\":1},{\"file\":\"part2.mp4\",\"order\":2}],\"reason\":\"Concatenate part2.mp4 after part1.mp4\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: documentary.mp4\nDuration: 1800.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- credits.mp4 (90.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nlink credits.mp4 to the end of the documentary",
        "output": "{\"message\":\"Linked credits.mp4 to the end of the documentary.\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"documentary.mp4\",\"order\":1},{\"file\":\"credits.mp4\",\"order\":2}],\"reason\":\"Append credits.mp4 after documentary.mp4\"}]}"
    },

    # ── Prepend clip before primary ────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: main_video.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- opening_card.mp4 (5.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nput opening_card.mp4 before this video",
        "output": "{\"message\":\"Placed opening_card.mp4 before main_video.mp4.\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"opening_card.mp4\",\"order\":1},{\"file\":\"main_video.mp4\",\"order\":2}],\"reason\":\"Prepend opening_card.mp4 before main_video.mp4\"}]}"
    },

    # ── Three-clip merge ───────────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: act1.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- act2.mp4 (150.0s)\n- act3.mp4 (90.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncombine act1, act2, and act3 in order",
        "output": "{\"message\":\"Combined all three acts in order.\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"act1.mp4\",\"order\":1},{\"file\":\"act2.mp4\",\"order\":2},{\"file\":\"act3.mp4\",\"order\":3}],\"reason\":\"Concatenate all three acts in order\"}]}"
    },

    # ── Combine clips referenced implicitly ────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: part_one.mp4\nDuration: 150.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- part_two.mp4 (150.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncombine the two clips",
        "output": "{\"message\":\"Combined part_one.mp4 and part_two.mp4.\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"part_one.mp4\",\"order\":1},{\"file\":\"part_two.mp4\",\"order\":2}],\"reason\":\"Concatenate part_one.mp4 and part_two.mp4\"}]}"
    },

    # ── Merge + cut first N seconds (multi-step) ───────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: interview_raw.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- closing_shot.mp4 (20.0s)\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmerge closing_shot.mp4 at the end and then cut the first 10 seconds",
        "output": "{\"message\":\"Appended the closing shot and trimmed the first 10 seconds.\",\"operations\":[{\"operation\":\"merge_videos\",\"clips\":[{\"file\":\"interview_raw.mp4\",\"order\":1},{\"file\":\"closing_shot.mp4\",\"order\":2}],\"reason\":\"Append closing_shot.mp4 after interview_raw.mp4\"},{\"operation\":\"cut\",\"variation\":\"first\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Remove first 10 seconds of interview\"}]}"
    },

    # ── No clip in bin → reject gracefully ────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: solo_video.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[MEDIA BIN]\n- None\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmerge another clip to this video",
        "output": "{\"message\":\"I don't see any other clips in your media bin to merge with. Please add a second video first.\",\"operations\":[]}"
    },
]