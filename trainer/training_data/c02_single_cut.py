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
        "input": "[VIDEO METADATA]\nName: vlog_raw.mp4\nDuration: 215.0s\nResolution: 1920x1080\nPlayhead: 60.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ndelete the next 5 seconds starting from the playhead",
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
    },
    {
        "input": "[VIDEO METADATA]\nName: game_session.mp4\nDuration: 900.0s\nResolution: 1920x1080\nPlayhead: 300.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ndiscard the next 20 seconds from the playhead",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":300.0,\"end\":320.0,\"reason\":\"Discard next 20 seconds from playhead\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: presentation.mp4\nDuration: 144.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncrop out the first 2 minutes of the video",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":120.0,\"reason\":\"Crop out first 2 minutes\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 350.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut the segment between 100 seconds and 150 seconds",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":100.0,\"end\":150.0,\"reason\":\"Cut segment between 100s and 150s\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 500.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ndiscard the final 15 seconds of the video",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":485.0,\"end\":500.0,\"reason\":\"Discard final 15 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: soundcheck.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ntrim the portion from 45s to 90s",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":45.0,\"end\":90.0,\"reason\":\"Trim portion from 45s to 90s\"}]}"
    },
   
    {
        "input": "[VIDEO METADATA]\nName: car_review.mp4\nDuration: 762.7s\nResolution: 1280x720\nPlayhead: 60.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove last 1min",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":702.7,\"end\":762.7,\"reason\":\"Remove last 1 min\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 500.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut last 1 min",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":440.0,\"end\":500.0,\"reason\":\"Remove last 1 min\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: presentation_recording.mp4\nDuration: 920.5s\nResolution: 1920x1080\nPlayhead: 120.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 120.0\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove the last minute",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":860.5,\"end\":920.5,\"reason\":\"Remove last minute\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: unboxing_vlog.mp4\nDuration: 415.2s\nResolution: 1920x1080\nPlayhead: 30.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 30.0\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nplease discard the last 60 seconds",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":355.2,\"end\":415.2,\"reason\":\"Discard last 60 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog_unboxing.mp4\nDuration: 377.2s\nResolution: 1920x1080\nPlayhead: 15.3s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove first 1 min",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":60.0,\"reason\":\"Remove first 1 min\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: daily_vlog.mp4\nDuration: 955.1s\nResolution: 1920x1080\nPlayhead: 882.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut first 1 min",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":60.0,\"reason\":\"Cut first 1 min\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: game_stream.mov\nDuration: 1042.9s\nResolution: 1280x720\nPlayhead: 501.1s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ndelete the first minute",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":60.0,\"reason\":\"Delete first minute\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: cooking_show.mp4\nDuration: 833.3s\nResolution: 1920x1080\nPlayhead: 211.5s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove last 1 min",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":773.3,\"end\":833.3,\"reason\":\"Remove last 1 min\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: family_trip.mp4\nDuration: 401.5s\nResolution: 1920x1080\nPlayhead: 399.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove the last 1 minute",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":341.5,\"end\":401.5,\"reason\":\"Remove last 1 minute\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: product_review.mp4\nDuration: 188.8s\nResolution: 1920x1080\nPlayhead: 12.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut last 1 min",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":128.8,\"end\":188.8,\"reason\":\"Cut last 1 min\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: drone_footage.mov\nDuration: 544.7s\nResolution: 3840x2160\nPlayhead: 50.5s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ndelete last 1 min",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":484.7,\"end\":544.7,\"reason\":\"Delete last 1 min\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast_clip.mp4\nDuration: 991.1s\nResolution: 1920x1080\nPlayhead: 80.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove last 30 sec",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":961.1,\"end\":991.1,\"reason\":\"Remove last 30 sec\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: teaser.mp4\nDuration: 202.2s\nResolution: 1280x720\nPlayhead: 15.1s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut the last 30 seconds",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":172.2,\"end\":202.2,\"reason\":\"Cut last 30 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: random_video.mp4\nDuration: 645.9s\nResolution: 1920x1080\nPlayhead: 333.3s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ndelete last 30s",
        "output": "{\"message\":\"the cut operation have been performed\",\"operations\":[{\"operation\":\"cut\",\"start\":615.9,\"end\":645.9,\"reason\":\"Delete last 30s\"}]}"
    }
]
