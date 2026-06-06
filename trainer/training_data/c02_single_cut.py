"""
Category 02 — Single Cut Operations

Goal: Teach the model all cut/trim/remove/delete variations.
      Every example outputs exactly one cut action.
"""

examples = [
    {
        "input": "[VIDEO METADATA]\nName: vlog_entry_01.mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- 10.5 -> 15.2\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove the silent gap in the beginning of the video",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":10.5,\"end\":15.2,\"reason\":\"Remove silent gap\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: cooking_tutorial.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 100.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 10.0\n\nMuted Sections:\n- 150.0 -> 165.5\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut the quiet gap in the middle of the video",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":150.0,\"end\":165.5,\"reason\":\"Remove quiet gap in middle\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: intro_clip.mp4\nDuration: 50.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ntrim off the first 5 seconds",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":5.0,\"reason\":\"Remove first 5 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: unboxing.mov\nDuration: 240.0s\nResolution: 1920x1080\nPlayhead: 120.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut out the segment from minute 2 to minute 2.5",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":120.0,\"end\":150.0,\"reason\":\"Cut requested range from 2:00 to 2:30\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast_master.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut out the portion from 1:15 to 1:45",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":75.0,\"end\":105.0,\"reason\":\"Cut requested range from 1:15 to 1:45\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: long_interview.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 120.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ndelete everything from the current playhead position to the very end of the video",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":120.0,\"end\":300.0,\"reason\":\"Remove from playhead to end\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: short_vlog.mp4\nDuration: 90.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut intro",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":10.0,\"reason\":\"Remove intro\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: promo.mp4\nDuration: 60.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove beginning",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":15.0,\"reason\":\"Remove beginning segment\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mov\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ndelete last 45 seconds",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":75.0,\"end\":120.0,\"reason\":\"Remove last 45 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: gameplay_full.mp4\nDuration: 180.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove middle section",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":60.0,\"end\":120.0,\"reason\":\"Remove middle third of video\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: review.mp4\nDuration: 180.0s\nResolution: 1920x1080\nPlayhead: 10.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- 130.0 -> 142.5\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove that long silent period near the end of the video",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":130.0,\"end\":142.5,\"reason\":\"Remove long silent period near end\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ntrim from 1:20 to 2:10",
        "output": "{\"message\":\"I have applied the requested edits to the timeline.\",\"operations\":[{\"operation\":\"cut\",\"start\":80.0,\"end\":130.0,\"reason\":\"Cut range from 1:20 to 2:10\"}]}"
    }
]
