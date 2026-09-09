#!/usr/bin/env python3
"""
hornet_dsl_vs_json_compare.ipynb  ←  Run as a Colab notebook
════════════════════════════════════════════════════════════════════════════════

Loads the Hornet fine-tuned ONNX (FP32) model from Hugging Face and runs
the 45 standard test inputs through it.

For every response it shows side-by-side:
  ┌─────────────────────┬─────────────────────────────────────────────────┐
  │ DSL output (raw)    │ JSON equivalent (synthesised by this script)    │
  └─────────────────────┴─────────────────────────────────────────────────┘

Results are saved to  hornet_compare_results.json  for later analysis.

Usage
─────
  1. Open in Google Colab (Runtime → GPU optional — CPU works fine for FP32)
  2. Run all cells top-to-bottom
  3. Download  hornet_compare_results.json  from the Files panel
"""

# ════════════════════════════════════════════════════════════════════════════
# CELL 1 — Install dependencies
# ════════════════════════════════════════════════════════════════════════════
# @title Install dependencies
# !pip install -q transformers onnxruntime huggingface_hub

# ════════════════════════════════════════════════════════════════════════════
# CELL 2 — Imports
# ════════════════════════════════════════════════════════════════════════════
# @title Imports
import re
import json
import time
import textwrap
from dataclasses import dataclass, asdict
from typing import List, Optional
import numpy as np

# ════════════════════════════════════════════════════════════════════════════
# CELL 3 — Download model & tokenizer from Hugging Face
# ════════════════════════════════════════════════════════════════════════════
# @title Download model from Hugging Face
from huggingface_hub import hf_hub_download, snapshot_download
import onnxruntime as ort
from transformers import AutoTokenizer

REPO_ID     = "Kingman9407/hornet"
ONNX_FILE   = "onnx/fp32/model.onnx"      # FP32 — highest accuracy
TOKENIZER_SUBDIR = "tokenizer"             # tokenizer files live here

print("📥 Downloading tokenizer …")
tokenizer_dir = snapshot_download(
    repo_id=REPO_ID,
    allow_patterns=["tokenizer/*", "tokenizer_config.json", "special_tokens_map.json",
                    "vocab.json", "merges.txt"],
)
tokenizer = AutoTokenizer.from_pretrained(tokenizer_dir)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token
print("✅ Tokenizer loaded.")

print(f"\n📥 Downloading ONNX model ({ONNX_FILE}) …")
onnx_path = hf_hub_download(repo_id=REPO_ID, filename=ONNX_FILE)
print(f"✅ ONNX model at: {onnx_path}")

# Load ONNX session
sess_options = ort.SessionOptions()
sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
session = ort.InferenceSession(onnx_path, sess_options=sess_options,
                                providers=["CPUExecutionProvider"])
print("✅ ONNX Runtime session ready.")


# ════════════════════════════════════════════════════════════════════════════
# CELL 4 — Inference helper (greedy decode, no KV-cache for simplicity)
# ════════════════════════════════════════════════════════════════════════════
# @title Inference helper

SYSTEM_PROMPT = (
    "You are Hornet, a video editing AI.\n\n"
    "Output format — exactly two parts, nothing else:\n"
    "SAY: <one sentence confirming what was done>\n"
    "<COMMAND> <VARIATION> [<N> SEC|MIN] [<start> <end>] [<track>]\n\n"
    "Commands: CUT | MUTE | ADD_AUDIO_OVERLAY\n"
    "Variations: FIRST | LAST | RANGE | BEFORE_PLAYHEAD | AFTER_PLAYHEAD | FULL_VIDEO\n\n"
    "Examples:\n"
    "SAY: Removed the first 10 seconds.\n"
    "CUT FIRST 10 SEC\n\n"
    "SAY: Cut from 1:00 to 2:30.\n"
    "CUT RANGE 1:00 2:30\n\n"
    "SAY: Removed everything before the playhead.\n"
    "CUT BEFORE_PLAYHEAD"
)

def build_prompt(user_input: str) -> str:
    """Render a ChatML prompt the model was trained on."""
    return (
        f"<|im_start|>system\n{SYSTEM_PROMPT}<|im_end|>\n"
        f"<|im_start|>user\n{user_input}<|im_end|>\n"
        f"<|im_start|>assistant\n"
    )

def generate(user_input: str, max_new_tokens: int = 80) -> str:
    """Run greedy generation and return the assistant text."""
    prompt    = build_prompt(user_input)
    enc       = tokenizer(prompt, return_tensors="np")
    input_ids = enc["input_ids"].astype(np.int64)
    attn_mask = enc["attention_mask"].astype(np.int64)

    generated = input_ids.copy()
    im_end_id = tokenizer.convert_tokens_to_ids("<|im_end|>")

    for _ in range(max_new_tokens):
        feeds = {"input_ids": generated,
                 "attention_mask": np.ones_like(generated, dtype=np.int64)}

        # Some ONNX exports name the output "logits", others use index 0
        out   = session.run(None, feeds)
        logits = out[0]                          # shape [1, seq, vocab]
        next_id = int(np.argmax(logits[0, -1]))  # greedy

        generated = np.concatenate([generated, [[next_id]]], axis=1)

        if next_id == im_end_id or next_id == tokenizer.eos_token_id:
            break

    # Decode only the newly generated part
    new_tokens  = generated[0][input_ids.shape[1]:]
    raw_output  = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
    return raw_output


# ════════════════════════════════════════════════════════════════════════════
# CELL 5 — DSL parser (mirrors dslParser.ts logic in Python)
# ════════════════════════════════════════════════════════════════════════════
# @title DSL parser

def _parse_timestamp(s: str) -> float:
    """Convert '1:30', '90', '90s', '1:30:00' → float seconds."""
    s = s.strip().lower()
    if s in ("duration", "end"):
        return 0.0
    if s.endswith("s") and ":" not in s:
        return float(s[:-1])
    parts = s.split(":")
    if len(parts) == 2:
        return int(parts[0]) * 60 + float(parts[1])
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    return float(s)

def _unit_to_seconds(n: float, unit: str) -> float:
    u = unit.upper()
    if u in ("MIN", "MINS", "MINUTE", "MINUTES"): return n * 60
    if u in ("HR",  "HRS",  "HOUR",   "HOURS"):   return n * 3600
    return n

@dataclass
class ParsedDSL:
    say: str
    command: Optional[str]           # CUT / MUTE / ADD_AUDIO_OVERLAY / MERGE / UNDO
    variation: Optional[str]         # FIRST / LAST / RANGE / BEFORE_PLAYHEAD / AFTER_PLAYHEAD / FULL_VIDEO
    start_sec: Optional[float]
    end_sec:   Optional[float]
    track:     Optional[str]
    undo_count: Optional[int]        # only for UNDO
    raw_command_line: Optional[str]
    parse_error: Optional[str]

def _extract_duration(user_input: str) -> float:
    m = re.search(r"Duration:\s*([\d.]+)s", user_input)
    return float(m.group(1)) if m else 0.0

def _extract_playhead(user_input: str) -> float:
    m = re.search(r"Playhead:\s*([\d.]+)s", user_input)
    return float(m.group(1)) if m else 0.0

def parse_dsl(raw: str, user_input: str) -> ParsedDSL:
    duration = _extract_duration(user_input)
    playhead = _extract_playhead(user_input)

    # Strip chat tokens
    raw = re.sub(r"<\|im_end\|>.*", "", raw, flags=re.DOTALL).strip()
    raw = re.sub(r"<\|im_start\|>[^\n]*", "", raw).strip()

    lines = [l.strip() for l in raw.splitlines() if l.strip()]

    say = ""
    command_line = None
    for line in lines:
        if line.upper().startswith("SAY:"):
            say = line[4:].strip()
        else:
            command_line = line
            break

    if not command_line:
        return ParsedDSL(say=say, command=None, variation=None, start_sec=None,
                         end_sec=None, track=None, undo_count=None,
                         raw_command_line=None, parse_error="no command line found")

    tokens = command_line.split()
    cmd = tokens[0].upper()
    rest = tokens[1:]

    try:
        if cmd in ("CUT", "MUTE"):
            if not rest:
                raise ValueError("missing variation")
            var = rest[0].upper()
            if var == "FIRST":
                n    = float(rest[1])
                secs = _unit_to_seconds(n, rest[2] if len(rest) > 2 else "SEC")
                return ParsedDSL(say=say, command=cmd, variation="FIRST",
                                 start_sec=0, end_sec=secs, track=None,
                                 undo_count=None, raw_command_line=command_line, parse_error=None)
            elif var == "LAST":
                n    = float(rest[1])
                secs = _unit_to_seconds(n, rest[2] if len(rest) > 2 else "SEC")
                return ParsedDSL(say=say, command=cmd, variation="LAST",
                                 start_sec=max(0, duration - secs), end_sec=duration,
                                 track=None, undo_count=None,
                                 raw_command_line=command_line, parse_error=None)
            elif var == "RANGE":
                s = _parse_timestamp(rest[1])
                e = _parse_timestamp(rest[2])
                return ParsedDSL(say=say, command=cmd, variation="RANGE",
                                 start_sec=s, end_sec=e, track=None,
                                 undo_count=None, raw_command_line=command_line, parse_error=None)
            elif var == "BEFORE_PLAYHEAD":
                if len(rest) >= 3 and rest[1].replace(".", "").isdigit():
                    n    = float(rest[1])
                    secs = _unit_to_seconds(n, rest[2])
                    start = max(0, playhead - secs)
                    end   = playhead
                else:
                    start, end = 0, playhead
                return ParsedDSL(say=say, command=cmd, variation="BEFORE_PLAYHEAD",
                                 start_sec=start, end_sec=end, track=None,
                                 undo_count=None, raw_command_line=command_line, parse_error=None)
            elif var == "AFTER_PLAYHEAD":
                if len(rest) >= 3 and rest[1].replace(".", "").isdigit():
                    n    = float(rest[1])
                    secs = _unit_to_seconds(n, rest[2])
                    start = playhead
                    end   = min(duration, playhead + secs)
                else:
                    start, end = playhead, duration
                return ParsedDSL(say=say, command=cmd, variation="AFTER_PLAYHEAD",
                                 start_sec=start, end_sec=end, track=None,
                                 undo_count=None, raw_command_line=command_line, parse_error=None)
            else:
                raise ValueError(f"unknown variation: {var}")

        elif cmd == "ADD_AUDIO_OVERLAY":
            var = rest[0].upper() if rest else "FULL_VIDEO"
            if var == "FULL_VIDEO":
                track = rest[1] if len(rest) > 1 else ""
                return ParsedDSL(say=say, command=cmd, variation="FULL_VIDEO",
                                 start_sec=0, end_sec=duration, track=track,
                                 undo_count=None, raw_command_line=command_line, parse_error=None)
            elif var == "FIRST":
                n = float(rest[1]); unit = rest[2] if len(rest) > 2 else "SEC"
                secs = _unit_to_seconds(n, unit)
                track = rest[3] if len(rest) > 3 else ""
                return ParsedDSL(say=say, command=cmd, variation="FIRST",
                                 start_sec=0, end_sec=secs, track=track,
                                 undo_count=None, raw_command_line=command_line, parse_error=None)
            elif var == "LAST":
                n = float(rest[1]); unit = rest[2] if len(rest) > 2 else "SEC"
                secs = _unit_to_seconds(n, unit)
                track = rest[3] if len(rest) > 3 else ""
                return ParsedDSL(say=say, command=cmd, variation="LAST",
                                 start_sec=max(0, duration - secs), end_sec=duration, track=track,
                                 undo_count=None, raw_command_line=command_line, parse_error=None)
            elif var == "RANGE":
                s = _parse_timestamp(rest[1]); e = _parse_timestamp(rest[2])
                track = rest[3] if len(rest) > 3 else ""
                return ParsedDSL(say=say, command=cmd, variation="RANGE",
                                 start_sec=s, end_sec=e, track=track,
                                 undo_count=None, raw_command_line=command_line, parse_error=None)

        elif cmd == "UNDO":
            arg = rest[0].upper() if rest else "1"
            count = 999 if arg == "ALL" else int(arg)
            return ParsedDSL(say=say, command="UNDO", variation=None,
                             start_sec=None, end_sec=None, track=None,
                             undo_count=count, raw_command_line=command_line, parse_error=None)

        raise ValueError(f"unknown command: {cmd}")

    except Exception as exc:
        return ParsedDSL(say=say, command=cmd, variation=None,
                         start_sec=None, end_sec=None, track=None,
                         undo_count=None, raw_command_line=command_line,
                         parse_error=str(exc))


# ════════════════════════════════════════════════════════════════════════════
# CELL 6 — DSL → JSON serialiser
# ════════════════════════════════════════════════════════════════════════════
# @title DSL → JSON converter

def dsl_to_json(parsed: ParsedDSL) -> dict:
    """
    Convert a parsed DSL result into the legacy Hornet JSON format.
    This is the format the model USED to output before DSL training.
    """
    if parsed.parse_error and not parsed.command:
        return {"message": parsed.say or parsed.parse_error, "operations": []}

    op_type_map = {
        "CUT":             "cut",
        "MUTE":            "mute",
        "ADD_AUDIO_OVERLAY": "add_audio_overlay",
        "UNDO":            "undo",
    }

    ops = []

    if parsed.command in ("CUT", "MUTE", "ADD_AUDIO_OVERLAY") and parsed.start_sec is not None:
        op = {
            "operation": op_type_map.get(parsed.command, parsed.command.lower()),
            "variation": (parsed.variation or "").lower(),
            "start":     round(parsed.start_sec, 1),
            "end":       round(parsed.end_sec,   1),
        }
        if parsed.track:
            op["track"] = parsed.track
        ops.append(op)
    elif parsed.command == "UNDO":
        ops.append({"operation": "undo", "count": parsed.undo_count})

    return {"message": parsed.say, "operations": ops}


# ════════════════════════════════════════════════════════════════════════════
# CELL 7 — Test inputs (all 45 canonical inputs)
# ════════════════════════════════════════════════════════════════════════════
# @title Test inputs — mirrors test_inputs.py from the trainer repo

ALL_TEST_SETS = [
    # ── SET 1: CUT FIRST ────────────────────────────────────────────────────
    ("1-1", "Set 1 — Cut First",
     "[VIDEO METADATA]\nName: vlog_day1.mp4\nDuration: 240.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut the first 8 seconds"),
    ("1-2", "Set 1 — Cut First",
     "[VIDEO METADATA]\nName: gaming_session.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ntrim off the first 15 seconds"),
    ("1-3", "Set 1 — Cut First",
     "[VIDEO METADATA]\nName: podcast_ep3.mp4\nDuration: 3600.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nsnip the first 30 seconds"),
    ("1-4", "Set 1 — Cut First",
     "[VIDEO METADATA]\nName: tutorial_react.mp4\nDuration: 900.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove the intro, it's the first 45 seconds"),
    ("1-5", "Set 1 — Cut First",
     "[VIDEO METADATA]\nName: concert_highlight.mp4\nDuration: 180.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nchop the first 12 seconds off"),

    # ── SET 2: CUT LAST ─────────────────────────────────────────────────────
    ("2-1", "Set 2 — Cut Last",
     "[VIDEO METADATA]\nName: interview_raw.mp4\nDuration: 420.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ndelete the last 20 seconds"),
    ("2-2", "Set 2 — Cut Last",
     "[VIDEO METADATA]\nName: product_demo.mp4\nDuration: 150.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove the last 7 seconds"),
    ("2-3", "Set 2 — Cut Last",
     "[VIDEO METADATA]\nName: cooking_show.mp4\nDuration: 720.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut off the ending, last 35 seconds"),
    ("2-4", "Set 2 — Cut Last",
     "[VIDEO METADATA]\nName: stream_clip.mp4\nDuration: 3600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 120.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ntrim the last 1 minute"),
    ("2-5", "Set 2 — Cut Last",
     "[VIDEO METADATA]\nName: drone_footage.mp4\nDuration: 480.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 450.0 -> 480.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nget rid of the last 50 seconds"),

    # ── SET 3: CUT RANGE ────────────────────────────────────────────────────
    ("3-1", "Set 3 — Cut Range",
     "[VIDEO METADATA]\nName: documentary.mp4\nDuration: 1800.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut from 1:00 to 2:30"),
    ("3-2", "Set 3 — Cut Range",
     "[VIDEO METADATA]\nName: lecture_bio.mp4\nDuration: 5400.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove the section from 3:00 to 4:15"),
    ("3-3", "Set 3 — Cut Range",
     "[VIDEO METADATA]\nName: workout_video.mp4\nDuration: 2400.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nslice out 5:30 to 7:00"),
    ("3-4", "Set 3 — Cut Range",
     "[VIDEO METADATA]\nName: travel_vlog.mp4\nDuration: 900.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 840.0 -> 900.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ndelete from 2:00 to 3:45"),
    ("3-5", "Set 3 — Cut Range",
     "[VIDEO METADATA]\nName: seminar_2024.mp4\nDuration: 7200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 180.0\n- 7020.0 -> 7200.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ntrim from 10:00 to 12:30"),

    # ── SET 4: MUTE RANGE ───────────────────────────────────────────────────
    ("4-1", "Set 4 — Mute Range",
     "[VIDEO METADATA]\nName: podcast_ep7.mp4\nDuration: 3600.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute from 45 to 90 seconds"),
    ("4-2", "Set 4 — Mute Range",
     "[VIDEO METADATA]\nName: gaming_clip.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nsilence the audio between 1:10 and 1:40"),
    ("4-3", "Set 4 — Mute Range",
     "[VIDEO METADATA]\nName: vlog_raw.mp4\nDuration: 800.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute the background noise between 30 and 45 seconds"),
    ("4-4", "Set 4 — Mute Range",
     "[VIDEO METADATA]\nName: tutorial_python.mp4\nDuration: 2700.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute between 100 and 160 seconds"),
    ("4-5", "Set 4 — Mute Range",
     "[VIDEO METADATA]\nName: wedding_video.mp4\nDuration: 5400.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute from 4:00 to 5:30"),

    # ── SET 5: MUTE FIRST / LAST ────────────────────────────────────────────
    ("5-1", "Set 5 — Mute First/Last",
     "[VIDEO METADATA]\nName: concert_live.mp4\nDuration: 3600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute the first 25 seconds"),
    ("5-2", "Set 5 — Mute First/Last",
     "[VIDEO METADATA]\nName: webinar_recording.mp4\nDuration: 7200.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nsilence the last 40 seconds"),
    ("5-3", "Set 5 — Mute First/Last",
     "[VIDEO METADATA]\nName: gameplay_stream.mp4\nDuration: 1800.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 90.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute the intro until 55 seconds"),
    ("5-4", "Set 5 — Mute First/Last",
     "[VIDEO METADATA]\nName: film_review.mp4\nDuration: 900.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nkill the audio for the last 18 seconds"),
    ("5-5", "Set 5 — Mute First/Last",
     "[VIDEO METADATA]\nName: sports_highlight.mp4\nDuration: 480.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nmute the first 2 minutes of background crowd noise"),

    # ── SET 6: ADD_AUDIO_OVERLAY ────────────────────────────────────────────
    ("6-1", "Set 6 — Audio Overlay",
     "[VIDEO METADATA]\nName: travel_montage.mp4\nDuration: 180.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nadd lofi_beats.mp3 to the entire video"),
    ("6-2", "Set 6 — Audio Overlay",
     "[VIDEO METADATA]\nName: product_launch.mp4\nDuration: 120.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nput intro_theme.mp3 over the first 20 seconds"),
    ("6-3", "Set 6 — Audio Overlay",
     "[VIDEO METADATA]\nName: nature_doc.mp4\nDuration: 600.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\noverlay ambient_nature.mp3 from 1:00 to 3:30"),
    ("6-4", "Set 6 — Audio Overlay",
     "[VIDEO METADATA]\nName: wedding_ceremony.mp4\nDuration: 2400.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 30.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nadd romantic_piano.mp3 across the whole clip"),
    ("6-5", "Set 6 — Audio Overlay",
     "[VIDEO METADATA]\nName: gym_reel.mp4\nDuration: 90.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ndrop hype_track.mp3 starting at 15 seconds"),

    # ── SET 7: PLAYHEAD ─────────────────────────────────────────────────────
    ("7-1", "Set 7 — Playhead Cut",
     "[VIDEO METADATA]\nName: stream_vod.mp4\nDuration: 1200.0s\nResolution: 1920x1080\nPlayhead: 300.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut everything before the playhead"),
    ("7-2", "Set 7 — Playhead Cut",
     "[VIDEO METADATA]\nName: presentation_final.mp4\nDuration: 900.0s\nResolution: 1280x720\nPlayhead: 450.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove everything after the current position"),
    ("7-3", "Set 7 — Playhead Cut",
     "[VIDEO METADATA]\nName: cooking_raw.mp4\nDuration: 720.0s\nResolution: 1920x1080\nPlayhead: 200.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut the 30 seconds before the playhead"),
    ("7-4", "Set 7 — Playhead Cut",
     "[VIDEO METADATA]\nName: vlog_raw.mp4\nDuration: 480.0s\nResolution: 1920x1080\nPlayhead: 120.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ndelete the next 60 seconds from here"),
    ("7-5", "Set 7 — Playhead Cut",
     "[VIDEO METADATA]\nName: sports_clip.mp4\nDuration: 360.0s\nResolution: 1920x1080\nPlayhead: 180.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 45.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nkeep only the part after the playhead, cut the rest"),

    # ── SET 8: CUT + MUTE ───────────────────────────────────────────────────
    ("8-1", "Set 8 — Cut + Mute",
     "[VIDEO METADATA]\nName: interview_long.mp4\nDuration: 2700.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut the first 10 seconds and mute from 1:00 to 1:30"),
    ("8-2", "Set 8 — Cut + Mute",
     "[VIDEO METADATA]\nName: tutorial_advanced.mp4\nDuration: 3600.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove the last 25 seconds and mute from 5:00 to 6:00"),
    ("8-3", "Set 8 — Cut + Mute",
     "[VIDEO METADATA]\nName: podcast_final.mp4\nDuration: 4500.0s\nResolution: 1280x720\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 45.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut from 2:00 to 2:30 and also silence from 10:00 to 10:45"),
    ("8-4", "Set 8 — Cut + Mute",
     "[VIDEO METADATA]\nName: gaming_tournament.mp4\nDuration: 7200.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 120.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ntrim the last 2 minutes and mute the crowd noise between 3:00 and 4:00"),
    ("8-5", "Set 8 — Cut + Mute",
     "[VIDEO METADATA]\nName: documentary_nature.mp4\nDuration: 5400.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ndelete the first 30 seconds and mute from 5:00 to 5:30"),

    # ── SET 9: CUT + AUDIO OVERLAY ──────────────────────────────────────────
    ("9-1", "Set 9 — Cut + Audio Overlay",
     "[VIDEO METADATA]\nName: travel_vlog_final.mp4\nDuration: 600.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut the first 5 seconds and add chill_vibes.mp3 to the whole video"),
    ("9-2", "Set 9 — Cut + Audio Overlay",
     "[VIDEO METADATA]\nName: short_film.mp4\nDuration: 900.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove the last 15 seconds and overlay epic_score.mp3 from 0:30 to 2:00"),
    ("9-3", "Set 9 — Cut + Audio Overlay",
     "[VIDEO METADATA]\nName: product_promo.mp4\nDuration: 60.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nsnip from 0:10 to 0:15 and put upbeat_pop.mp3 over the entire clip"),
    ("9-4", "Set 9 — Cut + Audio Overlay",
     "[VIDEO METADATA]\nName: wedding_reception.mp4\nDuration: 7200.0s\nResolution: 3840x2160\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- 0.0 -> 60.0\n- 7140.0 -> 7200.0\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\ncut from 5:00 to 5:30 and add jazz_night.mp3 to the entire video"),
    ("9-5", "Set 9 — Cut + Audio Overlay",
     "[VIDEO METADATA]\nName: fitness_montage.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\nBackground Music:\n- None\n\n[USER REQUEST]\nremove the first 8 seconds and drop workout_anthem.mp3 starting at 10 seconds"),
]


# ════════════════════════════════════════════════════════════════════════════
# CELL 8 — Run all test inputs and build comparison table
# ════════════════════════════════════════════════════════════════════════════
# @title Run inference & compare

def _user_request(user_input: str) -> str:
    """Extract just the USER REQUEST line for display."""
    m = re.search(r"\[USER REQUEST\]\n(.+)", user_input)
    return m.group(1).strip() if m else user_input[:80]

results = []

print(f"\n{'═'*70}")
print(f"  Running {len(ALL_TEST_SETS)} test inputs against Hornet FP32 ONNX model")
print(f"{'═'*70}\n")

current_set = ""
for test_id, set_name, user_input in ALL_TEST_SETS:
    if set_name != current_set:
        current_set = set_name
        print(f"\n{'─'*70}")
        print(f"  📂 {set_name}")
        print(f"{'─'*70}")

    user_q = _user_request(user_input)
    print(f"\n  [{test_id}] \"{user_q}\"")

    t0  = time.time()
    raw = generate(user_input)
    elapsed = time.time() - t0

    parsed  = parse_dsl(raw, user_input)
    as_json = dsl_to_json(parsed)

    # ── Pretty print ────────────────────────────────────────────────────────
    print(f"\n  ┌── DSL Output {'─'*50}")
    for line in raw.splitlines():
        print(f"  │  {line}")
    print(f"  ├── JSON Equivalent {'─'*46}")
    print(f"  │  {json.dumps(as_json, indent=4).replace(chr(10), chr(10)+'  │  ')}")
    status = "✅" if not parsed.parse_error else f"⚠️  {parsed.parse_error}"
    print(f"  └── Parse: {status}  •  {elapsed:.1f}s")

    results.append({
        "id":          test_id,
        "set":         set_name,
        "user_request": user_q,
        "raw_dsl":     raw,
        "dsl_parsed":  asdict(parsed),
        "json_equiv":  as_json,
        "parse_ok":    parsed.parse_error is None,
        "latency_s":   round(elapsed, 2),
    })

print(f"\n{'═'*70}")
total = len(results)
passed = sum(1 for r in results if r["parse_ok"])
print(f"  ✅ {passed}/{total} parsed cleanly  ({passed/total*100:.0f}%)")
print(f"{'═'*70}")


# ════════════════════════════════════════════════════════════════════════════
# CELL 9 — Save results to JSON
# ════════════════════════════════════════════════════════════════════════════
# @title Save results

OUTPUT_FILE = "hornet_compare_results.json"
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print(f"\n💾 Saved {len(results)} results to  {OUTPUT_FILE}")
print("   → Download from the Files panel (left sidebar) in Colab.")


# ════════════════════════════════════════════════════════════════════════════
# CELL 10 — Summary table
# ════════════════════════════════════════════════════════════════════════════
# @title Summary table by set

from collections import defaultdict

set_stats: dict = defaultdict(lambda: {"total": 0, "ok": 0})
for r in results:
    s = set_stats[r["set"]]
    s["total"] += 1
    s["ok"]    += int(r["parse_ok"])

print(f"\n{'Set':<30} {'Pass':>6} {'Total':>6} {'%':>6}")
print("─" * 55)
for set_name, stats in set_stats.items():
    pct  = stats["ok"] / stats["total"] * 100
    icon = "✅" if pct == 100 else "⚠️ " if pct >= 60 else "❌"
    print(f"  {icon}  {set_name:<28} {stats['ok']:>4}   {stats['total']:>4}   {pct:>4.0f}%")
