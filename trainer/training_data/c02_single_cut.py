"""
Category 02 — Single Cut Operations (DSL format)

Goal: Teach the model all cut/trim/remove/delete variations using
      the flat DSL grammar: SAY: <message> + CUT <variation> <args>
      Every example outputs exactly one cut operation.

DSL grammar reminder:
  CUT first <N>s|<N>m
  CUT last <N>s|<N>m
  CUT before_playhead <N>s|<N>m
  CUT after_playhead <N>s|<N>m
  CUT range <start>-<end>       (MM:SS form, no unit suffix)
  CUT range <start>s-<end>s     (plain seconds)
  CUT range <start>m-<end>m     (plain minutes)
"""

examples = [
    {
        "input": "[VIDEO METADATA]\nName: intro_clip.mp4\nDuration: 50.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ntrim off the first 5 seconds",
        "output": "SAY: Trimmed the first 5 seconds.\nCUT first 5s"
    },
    {
        "input": "[VIDEO METADATA]\nName: gaming.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ntrim the first 45 seconds",
        "output": "SAY: Trimmed the first 45 seconds.\nCUT first 45s"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nsnip the first 10 seconds",
        "output": "SAY: Snipped the first 10 seconds.\nCUT first 10s"
    },
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 1800.0s\nResolution: 1920x1080\nPlayhead: 50.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut the first 30s",
        "output": "SAY: Cut the first 30 seconds.\nCUT first 30s"
    },
    {
        "input": "[VIDEO METADATA]\nName: presentation.mp4\nDuration: 144.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncrop out the first 2 minutes of the video",
        "output": "SAY: Cropped out the first 2 minutes.\nCUT first 2m"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast.mp4\nDuration: 3600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nremove first 1 minute",
        "output": "SAY: Removed the first 1 minute.\nCUT first 1m"
    },
    {
        "input": "[VIDEO METADATA]\nName: demo.mov\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ndelete last 45 seconds",
        "output": "SAY: Deleted the last 45 seconds.\nCUT last 45s"
    },
    {
        "input": "[VIDEO METADATA]\nName: car_review.mp4\nDuration: 762.7s\nResolution: 1280x720\nPlayhead: 60.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nremove last 1min",
        "output": "SAY: Removed the last 1 minute.\nCUT last 1m"
    },
    {
        "input": "[VIDEO METADATA]\nName: seminar.mp4\nDuration: 5400.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ndelete the last 2 mins",
        "output": "SAY: Deleted the last 2 minutes.\nCUT last 2m"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 350.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut the segment between 100 seconds and 150 seconds",
        "output": "SAY: Cut the segment from 100 to 150 seconds.\nCUT range 100s-150s"
    },
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ntrim from 1:20 to 2:10",
        "output": "SAY: Cut the segment from 1:20 to 2:10.\nCUT range 1:20-2:10"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nslice out 0:30 to 0:45",
        "output": "SAY: Sliced out the segment from 0:30 to 0:45.\nCUT range 0:30-0:45"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nget rid of the segment from 1 minute to 2 minutes",
        "output": "SAY: Removed the segment from 1 to 2 minutes.\nCUT range 1m-2m"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 762.7s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 702.7 -> 762.7\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nremove from 3:00 to 4:00",
        "output": "SAY: Removed the segment from 3:00 to 4:00.\nCUT range 3:00-4:00"
    },
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 900.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut from 2:00 to 3:30",
        "output": "SAY: Cut the segment from 2:00 to 3:30.\nCUT range 2:00-3:30"
    },
    {
        "input": "[VIDEO METADATA]\nName: gaming.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 1140.0 -> 1200.0\n- 0.0 -> 45.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ntrim from 5:00 to 6:00",
        "output": "SAY: Trimmed the segment from 5:00 to 6:00.\nCUT range 5:00-6:00"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast.mp4\nDuration: 3600.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 3540.0 -> 3600.0\n- 0.0 -> 120.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ndelete from 10:00 to 12:00",
        "output": "SAY: Deleted the segment from 10:00 to 12:00.\nCUT range 10:00-12:00"
    },
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 500.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 440.0 -> 500.0\n- 0.0 -> 30.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nsnip from 1:30 to 2:45",
        "output": "SAY: Snipped the segment from 1:30 to 2:45.\nCUT range 1:30-2:45"
    },
    {
        "input": "[VIDEO METADATA]\nName: gameplay.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 150.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut everything before the playhead",
        "output": "SAY: Cut everything before the playhead.\nCUT before_playhead 150s"
    },
    {
        "input": "[VIDEO METADATA]\nName: stream_highlight.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 500.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nremove everything after the current position",
        "output": "SAY: Removed everything after the playhead.\nCUT after_playhead 700s"
    },
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 45.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut the 10 seconds before the playhead",
        "output": "SAY: Cut the 10 seconds before the playhead.\nCUT before_playhead 10s"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog_raw.mp4\nDuration: 215.0s\nResolution: 1920x1080\nPlayhead: 60.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ndelete the next 5 seconds starting from the playhead",
        "output": "SAY: Deleted the next 5 seconds from the playhead.\nCUT after_playhead 5s"
    },
    {
        "input": "[VIDEO METADATA]\nName: lecture.mp4\nDuration: 3600.0s\nResolution: 1920x1080\nPlayhead: 300.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut the 2 minutes before the playhead",
        "output": "SAY: Cut the 2 minutes before the playhead.\nCUT before_playhead 2m"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast_raw.mp4\nDuration: 7200.0s\nResolution: 1280x720\nPlayhead: 600.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nremove the 5 minutes leading up to the playhead",
        "output": "SAY: Removed the 5 minutes before the playhead.\nCUT before_playhead 5m"
    },
    {
        "input": "[VIDEO METADATA]\nName: seminar.mp4\nDuration: 5400.0s\nResolution: 1920x1080\nPlayhead: 1200.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ndelete the next 3 minutes from the playhead",
        "output": "SAY: Deleted the next 3 minutes from the playhead.\nCUT after_playhead 3m"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 900.0s\nResolution: 1920x1080\nPlayhead: 180.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ntrim the next 1 minute after the playhead",
        "output": "SAY: Trimmed the next 1 minute from the playhead.\nCUT after_playhead 1m"
    },
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 1800.0s\nResolution: 1920x1080\nPlayhead: 240.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut the 30 seconds before the playhead",
        "output": "SAY: Cut the 30 seconds before the playhead.\nCUT before_playhead 30s"
    },
    {
        "input": "[VIDEO METADATA]\nName: gaming.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 500.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 45.0\n- 1140.0 -> 1200.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nsnip the 20 seconds before current position",
        "output": "SAY: Snipped the 20 seconds before the playhead.\nCUT before_playhead 20s"
    },
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 600.0s\nResolution: 1280x720\nPlayhead: 120.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 30.0\n- 570.0 -> 600.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nremove the next 15 seconds from here",
        "output": "SAY: Removed the next 15 seconds from the playhead.\nCUT after_playhead 15s"
    },
    {
        "input": "[VIDEO METADATA]\nName: stream_clip.mp4\nDuration: 3600.0s\nResolution: 1920x1080\nPlayhead: 900.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 120.0\n- 3480.0 -> 3600.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut the next 45 seconds starting from the playhead",
        "output": "SAY: Cut the next 45 seconds from the playhead.\nCUT after_playhead 45s"
    },
    {
        "input": "[VIDEO METADATA]\nName: documentary.mp4\nDuration: 4800.0s\nResolution: 1920x1080\nPlayhead: 600.0s\n\n[TIMELINE STATE]\nCuts:\n- 4740.0 -> 4800.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ndelete everything before the playhead",
        "output": "SAY: Deleted everything before the playhead.\nCUT before_playhead 600s"
    },
    {
        "input": "[VIDEO METADATA]\nName: wedding.mp4\nDuration: 7200.0s\nResolution: 3840x2160\nPlayhead: 3600.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 180.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ntrim everything after the current position",
        "output": "SAY: Trimmed everything after the playhead.\nCUT after_playhead 3600s"
    },
    {
        "input": "[VIDEO METADATA]\nName: gameplay.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 150.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nkeep only the part after the playhead",
        "output": "SAY: Kept only the part after the playhead.\nCUT before_playhead 150s"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog_raw.mp4\nDuration: 215.0s\nResolution: 1920x1080\nPlayhead: 60.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\njust keep everything from here on out",
        "output": "SAY: Kept everything from the playhead onward.\nCUT before_playhead 60s"
    },
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 45.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nonly keep the part starting at the current position",
        "output": "SAY: Kept only the part starting at the playhead.\nCUT before_playhead 45s"
    },
    {
        "input": "[VIDEO METADATA]\nName: interview.mp4\nDuration: 1800.0s\nResolution: 1920x1080\nPlayhead: 240.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nkeep only what's after the playhead, cut the rest",
        "output": "SAY: Kept only the part after the playhead.\nCUT before_playhead 240s"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast.mp4\nDuration: 3600.0s\nResolution: 1280x720\nPlayhead: 600.0s\n\n[TIMELINE STATE]\nCuts:\n- 3540.0 -> 3600.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ntoss everything before the playhead, I only want what comes after",
        "output": "SAY: Removed everything before the playhead, keeping only what comes after.\nCUT before_playhead 600s"
    },
    {
        "input": "[VIDEO METADATA]\nName: stream_highlight.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 500.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nkeep only the part before the playhead",
        "output": "SAY: Kept only the part before the playhead.\nCUT after_playhead 700s"
    },
    {
        "input": "[VIDEO METADATA]\nName: lecture.mp4\nDuration: 3600.0s\nResolution: 1920x1080\nPlayhead: 300.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nonly keep up to where the playhead is\n",
        "output": "SAY: Kept only the part up to the playhead.\nCUT after_playhead 3300s"
    },
    {
        "input": "[VIDEO METADATA]\nName: seminar.mp4\nDuration: 5400.0s\nResolution: 1920x1080\nPlayhead: 1200.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\ncut everything past this point, keep only what's before it",
        "output": "SAY: Removed everything after the playhead, keeping only what comes before.\nCUT after_playhead 4200s"
    },
    {
        "input": "[VIDEO METADATA]\nName: gaming.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 500.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 45.0\n- 1140.0 -> 1200.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nkeep only what's before the current position",
        "output": "SAY: Kept only the part before the playhead.\nCUT after_playhead 700s"
    },
    {
        "input": "[VIDEO METADATA]\nName: wedding.mp4\nDuration: 7200.0s\nResolution: 3840x2160\nPlayhead: 3600.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 180.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nI only want the footage before the playhead, ditch the rest",
        "output": "SAY: Kept only the footage before the playhead.\nCUT after_playhead 3600s"
    },
    {
        "input": "[VIDEO METADATA]\nName: documentary.mp4\nDuration: 4800.0s\nResolution: 1920x1080\nPlayhead: 600.0s\n\n[TIMELINE STATE]\nCuts:\n- 4740.0 -> 4800.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[RECENT ACTIONS]\n- None\n\n[USER REQUEST]\nkeep the video starting from the playhead onward, cut the beginning",
        "output": "SAY: Kept the video starting from the playhead, removed the beginning.\nCUT before_playhead 600s"
    },
]