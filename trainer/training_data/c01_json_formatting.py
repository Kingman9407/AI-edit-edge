"""
Category 01 — DSL Formatting Discipline (Output Discipline)

Goal: Teach the model to output exactly two lines:
      SAY: <natural language confirmation>
      <COMMAND> <MODE> <ARGS>

      No markdown fences, no JSON, no extra commentary.

Training order: FIRST — the model must learn this strict output structure.

DSL format:
  - MODE keywords are UPPERCASE: FIRST | LAST | RANGE | BEFORE_PLAYHEAD |
    AFTER_PLAYHEAD | FULL_VIDEO
  - FIRST/LAST durations are canonicalized to "<NUMBER> <UNIT>" with UNIT
    as SEC or MIN (uppercase).
  - RANGE timestamps are echoed exactly as the user typed them — no
    conversion. Backend parses '1:00', '100', '45s' into seconds.
"""
examples = [

# ── cut: first N seconds ──────────────────────────────────────────────
{
    "input": "... cut the first 5 seconds",
    "output": "SAY: Removed the first 5 seconds of the video.\nCUT FIRST 5 SEC"
},

# ── cut: last N seconds ───────────────────────────────────────────────
{
    "input": "... remove the last 10 seconds",
    "output": "SAY: Removed the last 10 seconds of the video.\nCUT LAST 10 SEC"
},

# ── cut: explicit range ───────────────────────────────────────────────
{
    "input": "... cut out the section from 1:00 to 1:30",
    "output": "SAY: Removed the section from 1:00 to 1:30.\nCUT RANGE 1:00 1:30"
},

# ── mute: explicit range ──────────────────────────────────────────────
{
    "input": "... mute from 10 to 20 seconds",
    "output": "SAY: Muted the audio from 10 to 20 seconds.\nMUTE RANGE 10 20"
},
{
    "input": "... mute from 60 to 90 seconds",
    "output": "SAY: Muted the audio from 60 to 90 seconds.\nMUTE RANGE 60 90"
},
{
    "input": "... mute the background noise between 30 and 45 seconds",
    "output": "SAY: Muted the audio from 30 to 45 seconds to remove background noise.\nMUTE RANGE 30 45"
},

# ── mute: first N seconds ─────────────────────────────────────────────
{
    "input": "... mute the intro until 120 seconds",
    "output": "SAY: Muted the audio for the first 120 seconds.\nMUTE FIRST 120 SEC"
},

# ── add_audio_overlay: first N seconds ────────────────────────────────
{
    "input": "... add intro_music.mp3 over the first 10 seconds",
    "output": "SAY: Added intro_music.mp3 over the first 10 seconds.\nADD_AUDIO_OVERLAY FIRST 10 SEC intro_music.mp3"
},

# ── add_audio_overlay: full video ─────────────────────────────────────
{
    "input": "... add music.mp3 to entire video",
    "output": "SAY: Added music.mp3 across the full video.\nADD_AUDIO_OVERLAY FULL_VIDEO music.mp3"
},
{
    "input": "... add lofi_beats.mp3 to the entire clip",
    "output": "SAY: Added lofi_beats.mp3 across the full video.\nADD_AUDIO_OVERLAY FULL_VIDEO lofi_beats.mp3"
}

]