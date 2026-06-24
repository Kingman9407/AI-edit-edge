"""
Category 02 — Single Cut Operations

Goal: Teach the model all cut/trim/remove/delete variations using
      the new semantic format (variation + value + unit, or range).
      Every example outputs exactly one cut operation.
      No tool_call / tool_result — resolution is server-side.

Patterns covered:
  first           — "first N seconds/minutes"
  last            — "last N seconds/minutes"
  range           — explicit "Xs to Ys" or "MM:SS to MM:SS"
  before_playhead — "N seconds before the playhead"
  after_playhead  — "next N seconds from the playhead"
  whole-relative  — "everything before/after current position"
"""

examples = [

    # ── first: seconds ────────────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: intro_clip.mp4\nDuration: 50.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ntrim off the first 5 seconds",
        "output": "{\"message\":\"Trimmed the first 5 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":5,\"unit\":\"seconds\",\"reason\":\"Remove first 5 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: gaming.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ntrim the first 45 seconds",
        "output": "{\"message\":\"Trimmed the first 45 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":45,\"unit\":\"seconds\",\"reason\":\"Trim first 45 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nsnip the first 10 seconds",
        "output": "{\"message\":\"Snipped the first 10 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Snip first 10 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 1800.0s\nResolution: 1920x1080\nPlayhead: 50.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut the first 30s",
        "output": "{\"message\":\"Cut the first 30 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":30,\"unit\":\"seconds\",\"reason\":\"Cut first 30 seconds\"}]}"
    },

    # ── first: minutes ────────────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: presentation.mp4\nDuration: 144.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncrop out the first 2 minutes of the video",
        "output": "{\"message\":\"Cropped out the first 2 minutes.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":2,\"unit\":\"minutes\",\"reason\":\"Crop out first 2 minutes\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast.mp4\nDuration: 3600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove first 1 minute",
        "output": "{\"message\":\"Removed the first 1 minute.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":1,\"unit\":\"minutes\",\"reason\":\"Remove first 1 minute\"}]}"
    },

    # ── last: seconds ─────────────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: demo.mov\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ndelete last 45 seconds",
        "output": "{\"message\":\"Deleted the last 45 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"last\",\"value\":45,\"unit\":\"seconds\",\"reason\":\"Remove last 45 seconds\"}]}"
    },

    # ── last: minutes ─────────────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: car_review.mp4\nDuration: 762.7s\nResolution: 1280x720\nPlayhead: 60.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove last 1min",
        "output": "{\"message\":\"Removed the last 1 minute.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"last\",\"value\":1,\"unit\":\"minutes\",\"reason\":\"Remove last 1 min\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: seminar.mp4\nDuration: 5400.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ndelete the last 2 mins",
        "output": "{\"message\":\"Deleted the last 2 minutes.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"last\",\"value\":2,\"unit\":\"minutes\",\"reason\":\"Delete last 2 minutes\"}]}"
    },

    # ── range: explicit seconds ───────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 350.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut the segment between 100 seconds and 150 seconds",
        "output": "{\"message\":\"Cut the segment from 100 to 150 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"100\",\"end\":\"150\",\"unit\":\"seconds\",\"reason\":\"Cut segment between 100s and 150s\"}]}"
    },

    # ── range: MM:SS timestamps ───────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ntrim from 1:20 to 2:10",
        "output": "{\"message\":\"Cut the segment from 1:20 to 2:10.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"1:20\",\"end\":\"2:10\",\"unit\":\"seconds\",\"reason\":\"Cut range from 1:20 to 2:10\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nslice out 0:30 to 0:45",
        "output": "{\"message\":\"Sliced out the segment from 0:30 to 0:45.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"0:30\",\"end\":\"0:45\",\"unit\":\"seconds\",\"reason\":\"Slice out 0:30 to 0:45\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nget rid of the segment from 1 minute to 2 minutes",
        "output": "{\"message\":\"Removed the segment from 1 to 2 minutes.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"1\",\"end\":\"2\",\"unit\":\"minutes\",\"reason\":\"Cut segment from 1 to 2 minutes\"}]}"
    },

    # ── range: MM:SS with prior cuts in timeline ───────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 762.7s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 702.7 -> 762.7\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove from 3:00 to 4:00",
        "output": "{\"message\":\"Removed the segment from 3:00 to 4:00.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"3:00\",\"end\":\"4:00\",\"unit\":\"seconds\",\"reason\":\"Cut range from 3:00 to 4:00\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 900.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut from 2:00 to 3:30",
        "output": "{\"message\":\"Cut the segment from 2:00 to 3:30.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"2:00\",\"end\":\"3:30\",\"unit\":\"seconds\",\"reason\":\"Cut range from 2:00 to 3:30\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: gaming.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 1140.0 -> 1200.0\n- 0.0 -> 45.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ntrim from 5:00 to 6:00",
        "output": "{\"message\":\"Trimmed the segment from 5:00 to 6:00.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"5:00\",\"end\":\"6:00\",\"unit\":\"seconds\",\"reason\":\"Cut range from 5:00 to 6:00\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast.mp4\nDuration: 3600.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 3540.0 -> 3600.0\n- 0.0 -> 120.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ndelete from 10:00 to 12:00",
        "output": "{\"message\":\"Deleted the segment from 10:00 to 12:00.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"10:00\",\"end\":\"12:00\",\"unit\":\"seconds\",\"reason\":\"Cut range from 10:00 to 12:00\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 500.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 440.0 -> 500.0\n- 0.0 -> 30.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nsnip from 1:30 to 2:45",
        "output": "{\"message\":\"Snipped the segment from 1:30 to 2:45.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"1:30\",\"end\":\"2:45\",\"unit\":\"seconds\",\"reason\":\"Cut range from 1:30 to 2:45\"}]}"
    },

    # ── before_playhead: whole video ──────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: gameplay.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 150.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut everything before the playhead",
        "output": "{\"message\":\"Cut everything before the playhead.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"before_playhead\",\"value\":150,\"unit\":\"seconds\",\"reason\":\"Remove everything before playhead\"}]}"
    },

    # ── after_playhead: whole video ───────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: stream_highlight.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 500.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove everything after the current position",
        "output": "{\"message\":\"Removed everything after the playhead.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"after_playhead\",\"value\":700,\"unit\":\"seconds\",\"reason\":\"Remove everything after playhead\"}]}"
    },

    # ── before_playhead: N seconds ────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 45.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut the 10 seconds before the playhead",
        "output": "{\"message\":\"Cut the 10 seconds before the playhead.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"before_playhead\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Cut 10 seconds before playhead\"}]}"
    },

    # ── after_playhead: N seconds ─────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: vlog_raw.mp4\nDuration: 215.0s\nResolution: 1920x1080\nPlayhead: 60.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ndelete the next 5 seconds starting from the playhead",
        "output": "{\"message\":\"Deleted the next 5 seconds from the playhead.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"after_playhead\",\"value\":5,\"unit\":\"seconds\",\"reason\":\"Delete next 5 seconds from playhead\"}]}"
    },
]