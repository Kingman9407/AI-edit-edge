"""
Category 01 — JSON Formatting Discipline (Output Discipline)

Goal: Teach the model to output exactly ONE raw JSON object.
      It must NOT hallucinate markdown fences, backticks, or extra text.

Training order: FIRST — the model must learn this strict output structure.

New semantic format:
  - variation: first | last | before_playhead | after_playhead | range
  - For range: model echoes user's exact time strings — no conversion.
    Backend parses '1:20', '100', '45s' into seconds.
"""

examples = [
    # ── cut: first N seconds ──────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: clip.mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut the first 5 seconds",
        "output": "{\"message\":\"Removed the first 5 seconds of the video.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"first\",\"value\":5,\"unit\":\"seconds\",\"reason\":\"Remove first 5 seconds\"}]}"
    },

    # ── cut: last N seconds ───────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: vlog.mp4\nDuration: 153.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove the last 10 seconds",
        "output": "{\"message\":\"Removed the last 10 seconds of the video.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"last\",\"value\":10,\"unit\":\"seconds\",\"reason\":\"Remove last 10 seconds\"}]}"
    },

    # ── cut: explicit range (MM:SS expressed as seconds) ──────────────────
    {
        "input": "[VIDEO METADATA]\nName: tutorial.mp4\nDuration: 420.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut out the section from 1:00 to 1:30",
        "output": "{\"message\":\"Removed the section from 1:00 to 1:30.\",\"operations\":[{\"operation\":\"cut\",\"variation\":\"range\",\"start\":\"1:00\",\"end\":\"1:30\",\"unit\":\"seconds\",\"reason\":\"Remove 1:00 to 1:30\"}]}"
    },

    # ── mute: explicit range ──────────────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: clip.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute from 10 to 20 seconds",
        "output": "{\"message\":\"Muted the audio from 10 to 20 seconds.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"range\",\"start\":\"10\",\"end\":\"20\",\"unit\":\"seconds\",\"reason\":\"Mute requested range\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: podcast.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute from 60 to 90 seconds",
        "output": "{\"message\":\"Muted the audio from 60 to 90 seconds.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"range\",\"start\":\"60\",\"end\":\"90\",\"unit\":\"seconds\",\"reason\":\"Mute requested range\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: gameplay.mp4\nDuration: 600.0s\nResolution: 2560x1440\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute the background noise between 30 and 45 seconds",
        "output": "{\"message\":\"Muted the audio from 30 to 45 seconds to remove background noise.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"range\",\"start\":\"30\",\"end\":\"45\",\"unit\":\"seconds\",\"reason\":\"Mute background noise\"}]}"
    },

    # ── mute: first N seconds (implied start) ─────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: concert.mp4\nDuration: 3600.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute the intro until 120 seconds",
        "output": "{\"message\":\"Muted the audio for the first 120 seconds.\",\"operations\":[{\"operation\":\"mute\",\"variation\":\"first\",\"value\":120,\"unit\":\"seconds\",\"reason\":\"Mute intro\"}]}"
    },

    # ── add_audio_overlay: first N seconds ────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: intro.mp4\nDuration: 15.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nadd intro_music.mp3 over the first 10 seconds",
        "output": "{\"message\":\"Added intro_music.mp3 over the first 10 seconds.\",\"operations\":[{\"operation\":\"add_audio_overlay\",\"variation\":\"first\",\"value\":10,\"unit\":\"seconds\",\"track\":\"intro_music.mp3\",\"reason\":\"Add intro music\"}]}"
    },

    # ── add_audio_overlay: full video ─────────────────────────────────────
    {
        "input": "[VIDEO METADATA]\nName: video.mp4\nDuration: 90.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nadd music.mp3 to entire video",
        "output": "{\"message\":\"Added music.mp3 across the full video.\",\"operations\":[{\"operation\":\"add_audio_overlay\",\"variation\":\"range\",\"start\":\"0\",\"end\":\"90\",\"unit\":\"seconds\",\"track\":\"music.mp3\",\"reason\":\"Add background music to full video\"}]}"
    },
    {
        "input": "[VIDEO METADATA]\nName: montage.mp4\nDuration: 240.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nadd lofi_beats.mp3 to the entire clip",
        "output": "{\"message\":\"Added lofi_beats.mp3 across the full video.\",\"operations\":[{\"operation\":\"add_audio_overlay\",\"variation\":\"range\",\"start\":\"0\",\"end\":\"240\",\"unit\":\"seconds\",\"track\":\"lofi_beats.mp3\",\"reason\":\"Add lofi beats to full video\"}]}"
    },
]