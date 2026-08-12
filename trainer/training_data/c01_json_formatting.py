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
    "input": "... cut the first 5 seconds",
    "output": "SAY: Removed the first 5 seconds of the video.\nCUT first 5s"
},

# ── cut: last N seconds ───────────────────────────────────────────────
{
    "input": "... remove the last 10 seconds",
    "output": "SAY: Removed the last 10 seconds of the video.\nCUT last 10s"
},

# ── cut: explicit range ───────────────────────────────────────────────
{
    "input": "... cut out the section from 1:00 to 1:30",
    "output": "SAY: Removed the section from 1:00 to 1:30.\nCUT range 1:00 1:30"
},

# ── mute: explicit range ──────────────────────────────────────────────
{
    "input": "... mute from 10 to 20 seconds",
    "output": "SAY: Muted the audio from 10 to 20 seconds.\nMUTE range 10 20"
},
{
    "input": "... mute from 60 to 90 seconds",
    "output": "SAY: Muted the audio from 60 to 90 seconds.\nMUTE range 60 90"
},
{
    "input": "... mute the background noise between 30 and 45 seconds",
    "output": "SAY: Muted the audio from 30 to 45 seconds to remove background noise.\nMUTE range 30 45"
},

# ── mute: first N seconds ─────────────────────────────────────────────
{
    "input": "... mute the intro until 120 seconds",
    "output": "SAY: Muted the audio for the first 120 seconds.\nMUTE first 120s"
},

# ── add_audio_overlay: first N seconds ────────────────────────────────
{
    "input": "... add intro_music.mp3 over the first 10 seconds",
    "output": "SAY: Added intro_music.mp3 over the first 10 seconds.\nADD_AUDIO_OVERLAY first 10s intro_music.mp3"
},

# ── add_audio_overlay: full video ─────────────────────────────────────
{
    "input": "... add music.mp3 to entire video",
    "output": "SAY: Added music.mp3 across the full video.\nADD_AUDIO_OVERLAY full_video music.mp3"
},
{
    "input": "... add lofi_beats.mp3 to the entire clip",
    "output": "SAY: Added lofi_beats.mp3 across the full video.\nADD_AUDIO_OVERLAY full_video lofi_beats.mp3"
}

]