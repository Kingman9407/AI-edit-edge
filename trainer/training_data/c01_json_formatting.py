"""
Category 01 — JSON Formatting Discipline (Output Discipline)

Goal: Teach the model to output exactly ONE raw JSON object.
      It must NOT hallucinate markdown fences, backticks, or extra text.

Training order: FIRST — the model must learn this strict Single-Stage structure.
"""

examples = [
    # ── Reinforce: raw json object, no markdown, stop ────────────────────
    {
        "input": "[VIDEO METADATA]\nName: clip.mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut the first 5 seconds",
        "output": "{\"message\":\"I have applied the cut operation to remove the first 5 seconds of the video.\",\"operations\":[{\"operation\":\"cut\",\"start\":0.0,\"end\":5.0,\"reason\":\"Remove first 5 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: clip.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute from 10 to 20 seconds",
        "output": "{\"message\":\"I have muted the audio track between 10 and 20 seconds as requested.\",\"operations\":[{\"operation\":\"mute\",\"start\":10.0,\"end\":20.0,\"reason\":\"Mute requested range\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 90.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nadd music.mp3 to entire video",
        "output": "{\"message\":\"I have overlaid the background music track across the entire duration.\",\"operations\":[{\"operation\":\"add_audio_overlay\",\"start\":0.0,\"end\":90.0,\"reason\":\"Add background music to full video\",\"track\":\"music.mp3\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 153.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nremove the last 10 seconds",
        "output": "{\"message\":\"I've removed the final 10 seconds of the video.\",\"operations\":[{\"operation\":\"cut\",\"start\":143.0,\"end\":153.0,\"reason\":\"Remove last 10 seconds\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute from 60 to 90 seconds",
        "output": "{\"message\":\"The audio has been muted for the requested section.\",\"operations\":[{\"operation\":\"mute\",\"start\":60.0,\"end\":90.0,\"reason\":\"Mute requested range\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: gameplay.mp4\nDuration: 600.0s\nResolution: 2560x1440\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute the background noise between 30 and 45 seconds",
        "output": "{\"message\":\"The audio track has been muted between 30 and 45 seconds to remove the background noise.\",\"operations\":[{\"operation\":\"mute\",\"start\":30.0,\"end\":45.0,\"reason\":\"Mute background noise\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: intro.mp4\nDuration: 15.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nadd intro_music.mp3 over the first 10 seconds",
        "output": "{\"message\":\"I've added the intro music track over the first 10 seconds of the video.\",\"operations\":[{\"operation\":\"add_audio_overlay\",\"start\":0.0,\"end\":10.0,\"reason\":\"Add intro music\",\"track\":\"intro_music.mp3\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 420.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\ncut out the section from 1:00 to 1:30",
        "output": "{\"message\":\"I have removed the section from 60 seconds to 90 seconds as requested.\",\"operations\":[{\"operation\":\"cut\",\"start\":60.0,\"end\":90.0,\"reason\":\"Remove 1:00 to 1:30 section\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: concert.mp4\nDuration: 3600.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nmute the intro until 120 seconds",
        "output": "{\"message\":\"The audio for the first 120 seconds has been muted.\",\"operations\":[{\"operation\":\"mute\",\"start\":0.0,\"end\":120.0,\"reason\":\"Mute intro\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: montage.mp4\nDuration: 240.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nSubtitles:\n- None\n\nBackground Music:\n- None\n\n[RECENT EDITS]\nNone\n\n[LAST ACTION]\nNone\n\n[USER REQUEST]\nadd lofi_beats.mp3 to the entire clip",
        "output": "{\"message\":\"I have applied the lofi_beats.mp3 track to the entire duration of the video.\",\"operations\":[{\"operation\":\"add_audio_overlay\",\"start\":0.0,\"end\":240.0,\"reason\":\"Add lofi beats to montage\",\"track\":\"lofi_beats.mp3\"}]}"
    }
]
