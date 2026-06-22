"""
Category 05 — Time Reasoning (Absolute + Relative)

Goal: Teach the model to extract ALL forms of time reference as semantic
      operations. No arithmetic, no tool calls — the model echoes intent,
      the backend resolves.

  Part A — Absolute Time: MM:SS timestamps → range variation with string start/end.
  Part B — Relative Time: natural language → first/last/before_playhead/after_playhead.
  Part C — Heuristic defaults: vague words like 'intro', 'beginning', 'ending'
            → first/last with a sensible canonical default amount.

Note: 'middle', 'last half', 'first half' as fractions of duration are
      NOT supported — the model cannot compute duration / 2. These are
      replaced with equivalent clear requests or removed.
"""

examples = [

    # ── Part A: Absolute Time (MM:SS → range) ─────────────────────────────

    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut from 01:20 to 01:50",
        "output": "{\"message\":\"Cut the segment from 1:20 to 1:50.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"01:20\",\"end\":\"01:50\",\"unit\":\"seconds\",\"reason\":\"Cut from 1:20 to 1:50\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: presentation.mp4\nDuration: 1800.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute audio from 12:30 to 15:45",
        "output": "{\"message\":\"Muted the audio from 12:30 to 15:45.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"range\",\"start\":\"12:30\",\"end\":\"15:45\",\"unit\":\"seconds\",\"reason\":\"Mute from 12:30 to 15:45\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: short.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove 00:15 to 00:30",
        "output": "{\"message\":\"Removed the segment from 0:15 to 0:30.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"00:15\",\"end\":\"00:30\",\"unit\":\"seconds\",\"reason\":\"Cut from 0:15 to 0:30\"}]}"
    },

    # ── Part B: Relative — first ───────────────────────────────────────────

    {
        "input": "[VIDEO METADATA]\nName: video1.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove first minute",
        "output": "{\"message\":\"Removed the first minute.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":1,\"unit\":\"minutes\",\"reason\":\"Remove first minute\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vid1.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute the first 2.5 mins",
        "output": "{\"message\":\"Muted the first 2.5 minutes.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"first\",\"value\":2.5,\"unit\":\"minutes\",\"reason\":\"Mute first 2.5 mins\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vid5.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ntrim first half a minute",
        "output": "{\"message\":\"Trimmed the first 30 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":0.5,\"unit\":\"minutes\",\"reason\":\"Trim first half a minute\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video2.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut first 60 seconds",
        "output": "{\"message\":\"Cut the first 60 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":60,\"unit\":\"seconds\",\"reason\":\"Cut first 60 seconds\"}]}"
    },

    # ── Part B: Relative — last ────────────────────────────────────────────

    {
        "input": "[VIDEO METADATA]\nName: vid4.mp4\nDuration: 900.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut last 5 mins",
        "output": "{\"message\":\"Cut the last 5 minutes.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"last\",\"value\":5,\"unit\":\"minutes\",\"reason\":\"Cut last 5 mins\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: 2026_Renault_Duster.mp4\nDuration: 762.7s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 10.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove last 1 min",
        "output": "{\"message\":\"Removed the last 1 minute.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"last\",\"value\":1,\"unit\":\"minutes\",\"reason\":\"Remove last 1 min\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mov\nDuration: 314.8s\nResolution: 1920x1080\nPlayhead: 157.3s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut the last 30 seconds",
        "output": "{\"message\":\"Cut the last 30 seconds.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"last\",\"value\":30,\"unit\":\"seconds\",\"reason\":\"Cut last 30 seconds\"}]}"
    },

    # ── Part B: Relative — range (minute expressions) ──────────────────────

    {
        "input": "[VIDEO METADATA]\nName: video17.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove from 2 min to 2.5 min",
        "output": "{\"message\":\"Removed the segment from 2 to 2.5 minutes.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"2\",\"end\":\"2.5\",\"unit\":\"minutes\",\"reason\":\"Cut from 2 min to 2.5 min\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video19.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute audio from 5 mins to 8 mins",
        "output": "{\"message\":\"Muted the audio from 5 to 8 minutes.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"range\",\"start\":\"5\",\"end\":\"8\",\"unit\":\"minutes\",\"reason\":\"Mute from 5 mins to 8 mins\"}]}"
    },

    # ── Part B: Relative — before/after playhead ───────────────────────────

    {
        "input": "[VIDEO METADATA]\nName: video9.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 120.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove section before current playhead",
        "output": "{\"message\":\"Removed everything before the playhead.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"before_playhead\",\"value\":120,\"unit\":\"seconds\",\"reason\":\"Remove section before playhead\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video10.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 150.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut next 20 seconds",
        "output": "{\"message\":\"Cut the next 20 seconds from the playhead.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"after_playhead\",\"value\":20,\"unit\":\"seconds\",\"reason\":\"Cut next 20 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video11.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 200.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove previous 10 sec",
        "output": "{\"message\":\"Removed the previous 10 seconds before the playhead.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"before_playhead\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Remove previous 10 sec\"}]}"
    },

    # ── Part C: Heuristics — vague words with canonical defaults ───────────

    {
        "input": "[VIDEO METADATA]\nName: video3.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ntrim intro",
        "output": "{\"message\":\"Trimmed the intro (first 10 seconds).\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Trim intro\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video4.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove beginning",
        "output": "{\"message\":\"Removed the beginning (first 15 seconds).\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":15,\"unit\":\"seconds\",\"reason\":\"Remove beginning\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video6.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut ending",
        "output": "{\"message\":\"Cut the ending (last 10 seconds).\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"last\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Cut ending\"}]}"
    },
]