"""
Category 02 — Single Cut Operations

Goal: Teach the model all cut/trim/remove/delete variations.
      Every example outputs exactly one cut action.
"""

examples = [
   
    {
        "input": "[VIDEO METADATA]\nName: intro_clip.mp4\nDuration: 50.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ntrim off the first 5 seconds",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":5.0,\"reason\":\"Remove first 5 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: unboxing.mov\nDuration: 240.0s\nResolution: 1920x1080\nPlayhead: 120.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut out the segment from minute 2 to minute 2.5",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":120.0,\"end\":150.0,\"reason\":\"Cut requested range from 2:00 to 2:30\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast_master.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut out the portion from 1:15 to 1:45",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":75.0,\"end\":105.0,\"reason\":\"Cut requested range from 1:15 to 1:45\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: long_interview.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 120.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ndelete everything from the current playhead position to the very end of the video",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":120.0,\"end\":300.0,\"reason\":\"Remove from playhead to end\"}]}"
    },
   
    {
        "input": "[VIDEO METADATA]\nName: demo.mov\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ndelete last 45 seconds",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":75.0,\"end\":120.0,\"reason\":\"Remove last 45 seconds\"}]}"
    },
     
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ntrim from 1:20 to 2:10",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":80.0,\"end\":130.0,\"reason\":\"Cut range from 1:20 to 2:10\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nsnip the first 10 seconds",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":10.0,\"reason\":\"Snip first 10 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nslice out 0:30 to 0:45",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":30.0,\"end\":45.0,\"reason\":\"Slice out 0:30 to 0:45\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nchop off the last 20 seconds",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":100.0,\"end\":120.0,\"reason\":\"Chop off last 20 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nget rid of the segment from 1 minute to 2 minutes",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":60.0,\"end\":120.0,\"reason\":\"Get rid of segment from 1 to 2 minutes\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: gameplay.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 150.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut everything before the playhead",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":150.0,\"reason\":\"Remove everything before playhead\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: stream_highlight.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 500.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove everything after the current position",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":500.0,\"end\":1200.0,\"reason\":\"Remove everything after playhead\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 45.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut the 10 seconds before the playhead",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":35.0,\"end\":45.0,\"reason\":\"Cut 10 seconds before playhead\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog_raw.mp4\nDuration: 180.0s\nResolution: 1920x1080\nPlayhead: 60.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ndelete the next 5 seconds starting from the playhead",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":60.0,\"end\":65.0,\"reason\":\"Delete next 5 seconds from playhead\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: review.mp4\nDuration: 400.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove the last 10 seconds",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":390.0,\"end\":400.0,\"reason\":\"Remove last 10 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: intro.mp4\nDuration: 25.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut the first 15 seconds",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":15.0,\"reason\":\"Cut first 15 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: travel_vlog.mp4\nDuration: 450.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut out from 2:00 to 2:30",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":120.0,\"end\":150.0,\"reason\":\"Cut from 2:00 to 2:30\"}]}"
    }
]
