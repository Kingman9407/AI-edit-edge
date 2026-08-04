"""
test_inputs.py — Structured test inputs for Hornet AI
Organized by operation/feature. Each group tests one feature at a time.
Send these one-by-one to the model to evaluate its output.
"""

# ─────────────────────────────────────────────────────────────────────────────
# SET 1: CUT — first N seconds
# ─────────────────────────────────────────────────────────────────────────────
SET_1_CUT_FIRST = [
    {
        "id": "1-1",
        "user_input": "[VIDEO METADATA]\nName: vlog_day1.mp4\nDuration: 240.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut the first 8 seconds"
    },
    {
        "id": "1-2",
        "user_input": "[VIDEO METADATA]\nName: gaming_session.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ntrim off the first 15 seconds"
    },
    {
        "id": "1-3",
        "user_input": "[VIDEO METADATA]\nName: podcast_ep3.mp4\nDuration: 3600.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nsnip the first 30 seconds"
    },
    {
        "id": "1-4",
        "user_input": "[VIDEO METADATA]\nName: tutorial_react.mp4\nDuration: 900.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove the intro, it's the first 45 seconds"
    },
    {
        "id": "1-5",
        "user_input": "[VIDEO METADATA]\nName: concert_highlight.mp4\nDuration: 180.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nchop the first 12 seconds off"
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# SET 2: CUT — last N seconds
# ─────────────────────────────────────────────────────────────────────────────
SET_2_CUT_LAST = [
    {
        "id": "2-1",
        "user_input": "[VIDEO METADATA]\nName: interview_raw.mp4\nDuration: 420.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ndelete the last 20 seconds"
    },
    {
        "id": "2-2",
        "user_input": "[VIDEO METADATA]\nName: product_demo.mp4\nDuration: 150.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove the last 7 seconds"
    },
    {
        "id": "2-3",
        "user_input": "[VIDEO METADATA]\nName: cooking_show.mp4\nDuration: 720.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut off the ending, last 35 seconds"
    },
    {
        "id": "2-4",
        "user_input": "[VIDEO METADATA]\nName: stream_clip.mp4\nDuration: 3600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 120.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ntrim the last 1 minute"
    },
    {
        "id": "2-5",
        "user_input": "[VIDEO METADATA]\nName: drone_footage.mp4\nDuration: 480.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 450.0 -> 480.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nget rid of the last 50 seconds"
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# SET 3: CUT — range (MM:SS timestamps)
# ─────────────────────────────────────────────────────────────────────────────
SET_3_CUT_RANGE = [
    {
        "id": "3-1",
        "user_input": "[VIDEO METADATA]\nName: documentary.mp4\nDuration: 1800.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut from 1:00 to 2:30"
    },
    {
        "id": "3-2",
        "user_input": "[VIDEO METADATA]\nName: lecture_bio.mp4\nDuration: 5400.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove the section from 3:00 to 4:15"
    },
    {
        "id": "3-3",
        "user_input": "[VIDEO METADATA]\nName: workout_video.mp4\nDuration: 2400.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nslice out 5:30 to 7:00"
    },
    {
        "id": "3-4",
        "user_input": "[VIDEO METADATA]\nName: travel_vlog.mp4\nDuration: 900.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 840.0 -> 900.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ndelete from 2:00 to 3:45"
    },
    {
        "id": "3-5",
        "user_input": "[VIDEO METADATA]\nName: seminar_2024.mp4\nDuration: 7200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 180.0\n- 7020.0 -> 7200.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ntrim from 10:00 to 12:30"
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# SET 4: MUTE — range
# ─────────────────────────────────────────────────────────────────────────────
SET_4_MUTE_RANGE = [
    {
        "id": "4-1",
        "user_input": "[VIDEO METADATA]\nName: podcast_ep7.mp4\nDuration: 3600.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute from 45 to 90 seconds"
    },
    {
        "id": "4-2",
        "user_input": "[VIDEO METADATA]\nName: gaming_clip.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nsilence the audio between 1:10 and 1:40"
    },
    {
        "id": "4-3",
        "user_input": "[VIDEO METADATA]\nName: interview_final.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 30.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute the background noise from 2:00 to 2:30"
    },
    {
        "id": "4-4",
        "user_input": "[VIDEO METADATA]\nName: tutorial_python.mp4\nDuration: 2700.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute between 100 and 160 seconds"
    },
    {
        "id": "4-5",
        "user_input": "[VIDEO METADATA]\nName: wedding_video.mp4\nDuration: 5400.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute from 4:00 to 5:30"
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# SET 5: MUTE — first N / last N
# ─────────────────────────────────────────────────────────────────────────────
SET_5_MUTE_FIRST_LAST = [
    {
        "id": "5-1",
        "user_input": "[VIDEO METADATA]\nName: concert_live.mp4\nDuration: 3600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute the first 25 seconds"
    },
    {
        "id": "5-2",
        "user_input": "[VIDEO METADATA]\nName: webinar_recording.mp4\nDuration: 7200.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nsilence the last 40 seconds"
    },
    {
        "id": "5-3",
        "user_input": "[VIDEO METADATA]\nName: gameplay_stream.mp4\nDuration: 1800.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 90.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute the intro until 55 seconds"
    },
    {
        "id": "5-4",
        "user_input": "[VIDEO METADATA]\nName: film_review.mp4\nDuration: 900.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nkill the audio for the last 18 seconds"
    },
    {
        "id": "5-5",
        "user_input": "[VIDEO METADATA]\nName: sports_highlight.mp4\nDuration: 480.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute the first 2 minutes of background crowd noise"
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# SET 6: ADD_AUDIO_OVERLAY
# ─────────────────────────────────────────────────────────────────────────────
SET_6_AUDIO_OVERLAY = [
    {
        "id": "6-1",
        "user_input": "[VIDEO METADATA]\nName: travel_montage.mp4\nDuration: 180.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nadd lofi_beats.mp3 to the entire video"
    },
    {
        "id": "6-2",
        "user_input": "[VIDEO METADATA]\nName: product_launch.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nput intro_theme.mp3 over the first 20 seconds"
    },
    {
        "id": "6-3",
        "user_input": "[VIDEO METADATA]\nName: nature_doc.mp4\nDuration: 600.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\noverlay ambient_nature.mp3 from 1:00 to 3:30"
    },
    {
        "id": "6-4",
        "user_input": "[VIDEO METADATA]\nName: wedding_ceremony.mp4\nDuration: 2400.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 30.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nadd romantic_piano.mp3 across the whole clip"
    },
    {
        "id": "6-5",
        "user_input": "[VIDEO METADATA]\nName: gym_reel.mp4\nDuration: 90.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ndrop hype_track.mp3 starting at 15 seconds"
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# SET 7: CUT — before_playhead / after_playhead
# ─────────────────────────────────────────────────────────────────────────────
SET_7_PLAYHEAD = [
    {
        "id": "7-1",
        "user_input": "[VIDEO METADATA]\nName: stream_vod.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 300.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut everything before the playhead"
    },
    {
        "id": "7-2",
        "user_input": "[VIDEO METADATA]\nName: presentation_final.mp4\nDuration: 900.0s\nResolution: 1280x720\nPlayhead: 450.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove everything after the current position"
    },
    {
        "id": "7-3",
        "user_input": "[VIDEO METADATA]\nName: cooking_raw.mp4\nDuration: 720.0s\nResolution: 1920x1080\nPlayhead: 200.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut the 30 seconds before the playhead"
    },
    {
        "id": "7-4",
        "user_input": "[VIDEO METADATA]\nName: vlog_raw.mp4\nDuration: 480.0s\nResolution: 1920x1080\nPlayhead: 120.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ndelete the next 60 seconds from here"
    },
    {
        "id": "7-5",
        "user_input": "[VIDEO METADATA]\nName: sports_clip.mp4\nDuration: 360.0s\nResolution: 1920x1080\nPlayhead: 180.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 45.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nkeep only the part after the playhead, cut the rest"
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# SET 8: MULTI-OPERATION — cut + mute
# ─────────────────────────────────────────────────────────────────────────────
SET_8_CUT_AND_MUTE = [
    {
        "id": "8-1",
        "user_input": "[VIDEO METADATA]\nName: interview_long.mp4\nDuration: 2700.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut the first 10 seconds and mute from 1:00 to 1:30"
    },
    {
        "id": "8-2",
        "user_input": "[VIDEO METADATA]\nName: tutorial_advanced.mp4\nDuration: 3600.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove the last 25 seconds and mute from 5:00 to 6:00"
    },
    {
        "id": "8-3",
        "user_input": "[VIDEO METADATA]\nName: podcast_final.mp4\nDuration: 4500.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 45.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut from 2:00 to 2:30 and also silence from 10:00 to 10:45"
    },
    {
        "id": "8-4",
        "user_input": "[VIDEO METADATA]\nName: gaming_tournament.mp4\nDuration: 7200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 120.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ntrim the last 2 minutes and mute the crowd noise between 3:00 and 4:00"
    },
    {
        "id": "8-5",
        "user_input": "[VIDEO METADATA]\nName: documentary_nature.mp4\nDuration: 5400.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ndelete the first 30 seconds and mute from 5:00 to 5:30"
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# SET 9: MULTI-OPERATION — cut + audio overlay
# ─────────────────────────────────────────────────────────────────────────────
SET_9_CUT_AND_AUDIO = [
    {
        "id": "9-1",
        "user_input": "[VIDEO METADATA]\nName: travel_vlog_final.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut the first 5 seconds and add chill_vibes.mp3 to the whole video"
    },
    {
        "id": "9-2",
        "user_input": "[VIDEO METADATA]\nName: short_film.mp4\nDuration: 900.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove the last 15 seconds and overlay epic_score.mp3 from 0:30 to 2:00"
    },
    {
        "id": "9-3",
        "user_input": "[VIDEO METADATA]\nName: product_promo.mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nsnip from 0:10 to 0:15 and put upbeat_pop.mp3 over the entire clip"
    },
    {
        "id": "9-4",
        "user_input": "[VIDEO METADATA]\nName: wedding_reception.mp4\nDuration: 7200.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n- 7140.0 -> 7200.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut from 5:00 to 5:30 and add jazz_night.mp3 to the entire video"
    },
    {
        "id": "9-5",
        "user_input": "[VIDEO METADATA]\nName: fitness_montage.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove the first 8 seconds and drop workout_anthem.mp3 starting at 10 seconds"
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# Master registry — ordered for sequential testing
# ─────────────────────────────────────────────────────────────────────────────
ALL_TEST_SETS = [
    {"name": "Set 1 — Cut First",           "inputs": SET_1_CUT_FIRST},
    {"name": "Set 2 — Cut Last",            "inputs": SET_2_CUT_LAST},
    {"name": "Set 3 — Cut Range (MM:SS)",   "inputs": SET_3_CUT_RANGE},
    {"name": "Set 4 — Mute Range",          "inputs": SET_4_MUTE_RANGE},
    {"name": "Set 5 — Mute First/Last",     "inputs": SET_5_MUTE_FIRST_LAST},
    {"name": "Set 6 — Add Audio Overlay",   "inputs": SET_6_AUDIO_OVERLAY},
    {"name": "Set 7 — Playhead Cut",        "inputs": SET_7_PLAYHEAD},
    {"name": "Set 8 — Cut + Mute",          "inputs": SET_8_CUT_AND_MUTE},
    {"name": "Set 9 — Cut + Audio Overlay", "inputs": SET_9_CUT_AND_AUDIO},
]

ALL_INPUTS_FLAT = [
    item
    for test_set in ALL_TEST_SETS
    for item in test_set["inputs"]
]

if __name__ == "__main__":
    print(f"Total test inputs: {len(ALL_INPUTS_FLAT)}")
    for test_set in ALL_TEST_SETS:
        print(f"  {test_set['name']}: {len(test_set['inputs'])} inputs")
