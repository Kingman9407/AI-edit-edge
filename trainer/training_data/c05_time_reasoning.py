"""
Category 05 — Time Reasoning (Absolute + Relative)

Goal: Teach the model to resolve ALL forms of time reference into precise float seconds.

  Part A — Absolute Time: convert MM:SS format strings into exact floats.
  Part B — Relative Time: understand natural language like "first minute",
            "last half", "before playhead", "next 20 sec", "trim intro", etc.
            This is the MOST IMPORTANT temporal skill for the agent.
"""

examples = [
    # ── Part A: Absolute Time (MM:SS → float) ────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: demo.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut from 01:20 to 01:50",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":80.0,\"end\":110.0,\"reason\":\"Cut from 1:20 to 1:50\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: presentation.mp4\nDuration: 1800.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute audio from 12:30 to 15:45",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"mute\",\"start\":750.0,\"end\":945.0,\"reason\":\"Mute from 12:30 to 15:45\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: short.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove 00:15 to 00:30",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":15.0,\"end\":30.0,\"reason\":\"Cut from 0:15 to 0:30\"}]}"
    },
    # ── Part B: Relative Time (natural language → inferred range) ─────────────
    {
        "input": "[VIDEO METADATA]\nName: video1.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove first minute",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":60.0,\"reason\":\"Remove first minute\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video2.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut first 60 seconds",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":60.0,\"reason\":\"Cut first 60 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video3.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ntrim intro",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":10.0,\"reason\":\"Trim intro\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video4.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove beginning",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":15.0,\"reason\":\"Remove beginning\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video5.mp4\nDuration: 400.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove opening section",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":15.0,\"reason\":\"Remove opening section\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video6.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut ending",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":90.0,\"end\":100.0,\"reason\":\"Cut ending\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video7.mp4\nDuration: 200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove last half",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":100.0,\"end\":200.0,\"reason\":\"Remove last half\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video8.mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ntrim middle",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":20.0,\"end\":40.0,\"reason\":\"Trim middle\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video9.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 120.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove section before current playhead",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":120.0,\"reason\":\"Remove section before playhead\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video10.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 150.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut next 20 seconds",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":150.0,\"end\":170.0,\"reason\":\"Cut next 20 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video11.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 200.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove previous 10 sec",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":190.0,\"end\":200.0,\"reason\":\"Remove previous 10 sec\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video12.mp4\nDuration: 50.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute the first half of the video",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"mute\",\"start\":0.0,\"end\":25.0,\"reason\":\"Mute first half\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video13.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove first 1 min",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":60.0,\"reason\":\"Remove first 1 minute\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video14.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut the first 2 minutes",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":120.0,\"reason\":\"Cut first 2 minutes\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video15.mp4\nDuration: 480.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute last 3 mins",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"mute\",\"start\":300.0,\"end\":480.0,\"reason\":\"Mute last 3 minutes\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video16.mp4\nDuration: 480.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove next 1 min",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":60.0,\"reason\":\"Cut next 1 min\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video17.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove from 2 min to 3 min",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":120.0,\"end\":180.0,\"reason\":\"Cut from 2 min to 3 min\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video18.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut from 1 minute to 4 minutes",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":60.0,\"end\":240.0,\"reason\":\"Cut from 1 minute to 4 minutes\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video19.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute audio from 5 mins to 8 mins",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"mute\",\"start\":300.0,\"end\":480.0,\"reason\":\"Mute from 5 mins to 8 mins\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vid.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut the first one minute",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":60.0,\"reason\":\"Cut first one minute\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vid.mp4\nDuration: 400.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute the first 2 min",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"mute\",\"start\":0.0,\"end\":120.0,\"reason\":\"Mute first 2 min\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vid.mp4\nDuration: 200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut first 1m",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":60.0,\"reason\":\"Cut first 1m\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: 2026_Renault_Duster.mp4\nDuration: 762.7s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 10.0\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove last 1 min",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":702.7,\"end\":762.7,\"reason\":\"Remove last 1 min\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vid.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut last 1m",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":240.0,\"end\":300.0,\"reason\":\"Cut last 1m\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vid1.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute the first 3 mins",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"mute\",\"start\":0.0,\"end\":180.0,\"reason\":\"Mute first 3 mins\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vid2.mp4\nDuration: 1000.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut first 5 minutes",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":300.0,\"reason\":\"Cut first 5 minutes\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vid3.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 10.0\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove last 2 minutes",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":480.0,\"end\":600.0,\"reason\":\"Remove last 2 minutes\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vid4.mp4\nDuration: 900.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut last 5 mins",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":600.0,\"end\":900.0,\"reason\":\"Cut last 5 mins\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vid5.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ntrim first half a minute",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":30.0,\"reason\":\"Trim first half a minute\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vid6.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove first 1.5 mins",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":90.0,\"reason\":\"Remove first 1.5 mins\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vid7.mp4\nDuration: 100.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut last 30s",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":70.0,\"end\":100.0,\"reason\":\"Cut last 30s\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: project_final.mp4\nDuration: 762.7s\nResolution: 1280x720\nPlayhead: 60.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove last 1 min",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":702.7,\"end\":762.7,\"reason\":\"Remove last 1 min\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mov\nDuration: 314.8s\nResolution: 1920x1080\nPlayhead: 157.3s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut the last 30 seconds",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":284.8,\"end\":314.8,\"reason\":\"Cut last 30 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: quick_vlog.mp4\nDuration: 143.2s\nResolution: 1920x1080\nPlayhead: 45.7s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove last 30 sec",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":113.2,\"end\":143.2,\"reason\":\"Remove last 30 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: class_lecture.mp4\nDuration: 1255.4s\nResolution: 1920x1080\nPlayhead: 112.5s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 112.5\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ndelete the last minute",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":1195.4,\"end\":1255.4,\"reason\":\"Delete last minute\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: short_clip.mp4\nDuration: 87.6s\nResolution: 1920x1080\nPlayhead: 12.3s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nsnip the last 30s of the clip",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":57.6,\"end\":87.6,\"reason\":\"Snip last 30s\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast_ad.mp4\nDuration: 253.9s\nResolution: 1920x1080\nPlayhead: 45.8s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 45.8\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove the last 1min",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":193.9,\"end\":253.9,\"reason\":\"Remove last 1min\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: unboxing_vlog.mp4\nDuration: 415.2s\nResolution: 1920x1080\nPlayhead: 30.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 30.0\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nplease discard the last 60 seconds",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":355.2,\"end\":415.2,\"reason\":\"Discard last 60 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: review_shoot.mp4\nDuration: 531.4s\nResolution: 1920x1080\nPlayhead: 120.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 120.0\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ndelete last 1 min",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":471.4,\"end\":531.4,\"reason\":\"Delete last 1 min\"}]}"
    }
]
