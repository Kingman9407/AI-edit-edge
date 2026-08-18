"""
Category 02 — Single Cut Operations (DSL format, corrected)

Conforms to DSL_REFERENCE grammar, EXTENDED per decision below:
  CUT FIRST <N> SEC|MIN
  CUT LAST <N> SEC|MIN
  CUT RANGE <start> <end>              (space-separated, echoed as user gave it)
  CUT BEFORE_PLAYHEAD                   (no args — "everything before")
  CUT BEFORE_PLAYHEAD <N> SEC|MIN       (bounded — the N sec/min immediately before playhead)
  CUT AFTER_PLAYHEAD                    (no args — "everything after")
  CUT AFTER_PLAYHEAD <N> SEC|MIN        (bounded — the N sec/min immediately after playhead)

DECISION (this file): BEFORE_PLAYHEAD/AFTER_PLAYHEAD now take an OPTIONAL
duration argument. Omitted = cut everything before/after. Present = cut only
that bounded window adjacent to the playhead. This extends DSL_REFERENCE.py,
which currently documents these as no-arg only — update that file's
"variations" examples/description to match before using this in training.
"""

examples = [
    {
        "input": "[VIDEO METADATA]\nName: intro_clip.mp4\nDuration: 50.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ntrim off the first 5 seconds",
        "output": "SAY: Trimmed the first 5 seconds.\nCUT FIRST 5 SEC"
    },
    {
        "input": "[VIDEO METADATA]\nName: gaming.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ntrim the first 45 seconds",
        "output": "SAY: Trimmed the first 45 seconds.\nCUT FIRST 45 SEC"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nsnip the first 10 seconds",
        "output": "SAY: Snipped the first 10 seconds.\nCUT FIRST 10 SEC"
    },
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 1800.0s\nResolution: 1920x1080\nPlayhead: 50.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut the first 30s",
        "output": "SAY: Cut the first 30 seconds.\nCUT FIRST 30 SEC"
    },
    {
        "input": "[VIDEO METADATA]\nName: presentation.mp4\nDuration: 144.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncrop out the first 2 minutes of the video",
        "output": "SAY: Cropped out the first 2 minutes.\nCUT FIRST 2 MIN"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast.mp4\nDuration: 3600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nremove first 1 minute",
        "output": "SAY: Removed the first 1 minute.\nCUT FIRST 1 MIN"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mov\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ndelete last 45 seconds",
        "output": "SAY: Deleted the last 45 seconds.\nCUT LAST 45 SEC"
    },
    {
        "input": "[VIDEO METADATA]\nName: car_review.mp4\nDuration: 762.7s\nResolution: 1280x720\nPlayhead: 60.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nremove last 1min",
        "output": "SAY: Removed the last 1 minute.\nCUT LAST 1 MIN"
    },
    {
        "input": "[VIDEO METADATA]\nName: seminar.mp4\nDuration: 5400.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ndelete the last 2 mins",
        "output": "SAY: Deleted the last 2 minutes.\nCUT LAST 2 MIN"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 350.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut the segment between 100 seconds and 150 seconds",
        "output": "SAY: Cut the segment from 100 to 150 seconds.\nCUT RANGE 100s 150s"
    },
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ntrim from 1:20 to 2:10",
        "output": "SAY: Cut the segment from 1:20 to 2:10.\nCUT RANGE 1:20 2:10"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nslice out 0:30 to 0:45",
        "output": "SAY: Sliced out the segment from 0:30 to 0:45.\nCUT RANGE 0:30 0:45"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nget rid of the segment from 1 minute to 2 minutes",
        "output": "SAY: Removed the segment from 1 to 2 minutes.\nCUT RANGE 1m 2m"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 762.7s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 702.7 -> 762.7\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nremove from 3:00 to 4:00",
        "output": "SAY: Removed the segment from 3:00 to 4:00.\nCUT RANGE 3:00 4:00"
    },
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 900.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut from 2:00 to 3:30",
        "output": "SAY: Cut the segment from 2:00 to 3:30.\nCUT RANGE 2:00 3:30"
    },
    {
        "input": "[VIDEO METADATA]\nName: gaming.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 1140.0 -> 1200.0\n- 0.0 -> 45.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ntrim from 5:00 to 6:00",
        "output": "SAY: Trimmed the segment from 5:00 to 6:00.\nCUT RANGE 5:00 6:00"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast.mp4\nDuration: 3600.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 3540.0 -> 3600.0\n- 0.0 -> 120.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ndelete from 10:00 to 12:00",
        "output": "SAY: Deleted the segment from 10:00 to 12:00.\nCUT RANGE 10:00 12:00"
    },
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 500.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 440.0 -> 500.0\n- 0.0 -> 30.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nsnip from 1:30 to 2:45",
        "output": "SAY: Snipped the segment from 1:30 to 2:45.\nCUT RANGE 1:30 2:45"
    },
    {
        "input": "[VIDEO METADATA]\nName: gameplay.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 150.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut everything before the playhead",
        "output": "SAY: Cut everything before the playhead.\nCUT BEFORE_PLAYHEAD"
    },
    {
        "input": "[VIDEO METADATA]\nName: stream_highlight.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 500.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nremove everything after the current position",
        "output": "SAY: Removed everything after the playhead.\nCUT AFTER_PLAYHEAD"
    },
    {
        "input": "[VIDEO METADATA]\nName: documentary.mp4\nDuration: 4800.0s\nResolution: 1920x1080\nPlayhead: 600.0s\n\n[TIMELINE STATE]\nCuts:\n- 4740.0 -> 4800.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ndelete everything before the playhead",
        "output": "SAY: Deleted everything before the playhead.\nCUT BEFORE_PLAYHEAD"
    },
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 45.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut the 10 seconds before the playhead",
        "output": "SAY: Cut the 10 seconds before the playhead.\nCUT BEFORE_PLAYHEAD 10 SEC"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog_raw.mp4\nDuration: 215.0s\nResolution: 1920x1080\nPlayhead: 60.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ndelete the next 5 seconds starting from the playhead",
        "output": "SAY: Deleted the next 5 seconds from the playhead.\nCUT AFTER_PLAYHEAD 5 SEC"
    },
    {
        "input": "[VIDEO METADATA]\nName: lecture.mp4\nDuration: 3600.0s\nResolution: 1920x1080\nPlayhead: 300.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut the 2 minutes before the playhead",
        "output": "SAY: Cut the 2 minutes before the playhead.\nCUT BEFORE_PLAYHEAD 2 MIN"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast_raw.mp4\nDuration: 7200.0s\nResolution: 1280x720\nPlayhead: 600.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nremove the 5 minutes leading up to the playhead",
        "output": "SAY: Removed the 5 minutes before the playhead.\nCUT BEFORE_PLAYHEAD 5 MIN"
    },
    {
        "input": "[VIDEO METADATA]\nName: seminar.mp4\nDuration: 5400.0s\nResolution: 1920x1080\nPlayhead: 1200.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ndelete the next 3 minutes from the playhead",
        "output": "SAY: Deleted the next 3 minutes from the playhead.\nCUT AFTER_PLAYHEAD 3 MIN"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 900.0s\nResolution: 1920x1080\nPlayhead: 180.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ntrim the next 1 minute after the playhead",
        "output": "SAY: Trimmed the next 1 minute from the playhead.\nCUT AFTER_PLAYHEAD 1 MIN"
    },
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 1800.0s\nResolution: 1920x1080\nPlayhead: 240.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut the 30 seconds before the playhead",
        "output": "SAY: Cut the 30 seconds before the playhead.\nCUT BEFORE_PLAYHEAD 30 SEC"
    },
    {
        "input": "[VIDEO METADATA]\nName: gaming.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 500.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 45.0\n- 1140.0 -> 1200.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nsnip the 20 seconds before current position",
        "output": "SAY: Snipped the 20 seconds before the playhead.\nCUT BEFORE_PLAYHEAD 20 SEC"
    },
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 600.0s\nResolution: 1280x720\nPlayhead: 120.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 30.0\n- 570.0 -> 600.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nremove the next 15 seconds from here",
        "output": "SAY: Removed the next 15 seconds from the playhead.\nCUT AFTER_PLAYHEAD 15 SEC"
    },
    {
        "input": "[VIDEO METADATA]\nName: stream_clip.mp4\nDuration: 3600.0s\nResolution: 1920x1080\nPlayhead: 900.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 120.0\n- 3480.0 -> 3600.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut the next 45 seconds starting from the playhead",
        "output": "SAY: Cut the next 45 seconds from the playhead.\nCUT AFTER_PLAYHEAD 45 SEC"
    },
    {
        "input": "[VIDEO METADATA]\nName: wedding.mp4\nDuration: 7200.0s\nResolution: 3840x2160\nPlayhead: 3600.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 180.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ntrim everything after the current position",
        "output": "SAY: Trimmed everything after the playhead.\nCUT AFTER_PLAYHEAD"
    },
    {
        "input": "[VIDEO METADATA]\nName: gameplay.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 150.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nkeep only the part after the playhead",
        "output": "SAY: Kept only the part after the playhead.\nCUT BEFORE_PLAYHEAD"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog_raw.mp4\nDuration: 215.0s\nResolution: 1920x1080\nPlayhead: 60.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\njust keep everything from here on out",
        "output": "SAY: Kept everything from the playhead onward.\nCUT BEFORE_PLAYHEAD"
    },
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 45.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nonly keep the part starting at the current position",
        "output": "SAY: Kept only the part starting at the playhead.\nCUT BEFORE_PLAYHEAD"
    },
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 1800.0s\nResolution: 1920x1080\nPlayhead: 240.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nkeep only what's after the playhead, cut the rest",
        "output": "SAY: Kept only the part after the playhead.\nCUT BEFORE_PLAYHEAD"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast.mp4\nDuration: 3600.0s\nResolution: 1280x720\nPlayhead: 600.0s\n\n[TIMELINE STATE]\nCuts:\n- 3540.0 -> 3600.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ntoss everything before the playhead, I only want what comes after",
        "output": "SAY: Removed everything before the playhead, keeping only what comes after.\nCUT BEFORE_PLAYHEAD"
    },
    {
        "input": "[VIDEO METADATA]\nName: stream_highlight.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 500.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nkeep only the part before the playhead",
        "output": "SAY: Kept only the part before the playhead.\nCUT AFTER_PLAYHEAD"
    },
    {
        "input": "[VIDEO METADATA]\nName: lecture.mp4\nDuration: 3600.0s\nResolution: 1920x1080\nPlayhead: 300.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nonly keep up to where the playhead is\n",
        "output": "SAY: Kept only the part up to the playhead.\nCUT AFTER_PLAYHEAD"
    },
    {
        "input": "[VIDEO METADATA]\nName: seminar.mp4\nDuration: 5400.0s\nResolution: 1920x1080\nPlayhead: 1200.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut everything past this point, keep only what's before it",
        "output": "SAY: Removed everything after the playhead, keeping only what comes before.\nCUT AFTER_PLAYHEAD"
    },
    {
        "input": "[VIDEO METADATA]\nName: gaming.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 500.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 45.0\n- 1140.0 -> 1200.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nkeep only what's before the current position",
        "output": "SAY: Kept only the part before the playhead.\nCUT AFTER_PLAYHEAD"
    },
    {
        "input": "[VIDEO METADATA]\nName: wedding.mp4\nDuration: 7200.0s\nResolution: 3840x2160\nPlayhead: 3600.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 180.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nI only want the footage before the playhead, ditch the rest",
        "output": "SAY: Kept only the footage before the playhead.\nCUT AFTER_PLAYHEAD"
    },
    {
        "input": "[VIDEO METADATA]\nName: documentary.mp4\nDuration: 4800.0s\nResolution: 1920x1080\nPlayhead: 600.0s\n\n[TIMELINE STATE]\nCuts:\n- 4740.0 -> 4800.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nkeep the video starting from the playhead onward, cut the beginning",
        "output": "SAY: Kept the video starting from the playhead, removed the beginning.\nCUT BEFORE_PLAYHEAD"
    },
]