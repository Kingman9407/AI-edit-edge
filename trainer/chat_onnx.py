"""
chat_onnx.py — Chat with the INT8 ONNX model (simulates the web worker exactly)
Uses the same ChatML format, add_special_tokens=False, greedy decoding, no KV cache.
"""

import os
import re
import json
import time
import random
import numpy as np

# Paths — override via env var to support FP32 or INT8 from main.py
ONNX_MODEL_PATH  = os.environ.get("ONNX_MODEL_OVERRIDE", "./fine_tuned_smollm_onnx") + "/model.onnx"
ONNX_LABEL       = "INT8" if "fp32" not in ONNX_MODEL_PATH else "FP32"
TOKENIZER_PATH   = "./fine_tuned_smollm"
MAX_NEW_TOKENS   = 256

SYSTEM_INSTRUCTION = (
    "You are Hornet, a natural language processing (NLP) assistant. "
    "You analyze the user's video editing requests and return a structured JSON object "
    "containing two fields: 'message' (a natural response) and 'operations' (a list of video edit actions "
    "like 'cut', 'mute', 'add_audio_overlay' with start and end timestamps in seconds). "
    "Output ONLY a raw JSON object. Do NOT use markdown formatting, backticks, or extra text outside the JSON."
)


# ──────────────────────────────────────────────────────────────────────────────
# Video context helpers (identical to chat_agent.py)
# ──────────────────────────────────────────────────────────────────────────────

def format_video_context(state: dict) -> str:
    metadata = (
        f"Name: {state.get('name')}\n"
        f"Duration: {state.get('duration')}s\n"
        f"Resolution: {state.get('resolution')}\n"
        f"Playhead: {state.get('playhead')}s"
    )

    def fmt_list(items):
        if not items:
            return "- None"
        return "\n".join(f"- {i['start']} -> {i['end']}" for i in items)

    timeline = (
        "Cuts:\n" + fmt_list(state.get("existing_cuts", [])) + "\n\n"
        "Muted Sections:\n" + fmt_list(state.get("silent_sections", [])) + "\n\n"
        "Subtitles:\n- None\n\n"
        "Background Music:\n" + fmt_list(state.get("bg_music", []))
    )

    recent = state.get("recent_edits", [])
    recent_str = "None" if not recent else "\n".join(
        f"{i+1}. {e}" for i, e in enumerate(recent))
    last = state.get("last_action", "None")

    return (
        f"[VIDEO METADATA]\n{metadata}\n\n"
        f"[TIMELINE STATE]\n{timeline}\n\n"
        f"[RECENT EDITS]\n{recent_str}\n\n"
        f"[LAST ACTION]\n{last}"
    )


def random_video() -> dict:
    names = [
        "vlog_park_walk.mp4", "lecture_deep_learning.mp4",
        "cooking_tutorial_lasagna.mp4", "family_gathering.mov",
        "gaming_highlights.mp4", "podcast_episode_42.mp4",
    ]
    return {
        "name": random.choice(names),
        "duration": 480.0,
        "resolution": random.choice(["1920x1080", "1280x720", "3840x2160"]),
        "playhead": round(random.uniform(0.0, 480.0), 1),
        "silent_sections": [],
        "existing_cuts": [],
        "bg_music": [],
        "recent_edits": [],
        "last_action": "None",
    }


# ──────────────────────────────────────────────────────────────────────────────
# JSON parser (same as chat_agent.py)
# ──────────────────────────────────────────────────────────────────────────────

def parse_json(text: str) -> dict:
    start = text.find("{")
    if start == -1:
        return {}
    depth = 0
    in_str = False
    esc = False
    for i, ch in enumerate(text[start:], start=start):
        if esc:
            esc = False; continue
        if ch == "\\" and in_str:
            esc = True; continue
        if ch == '"':
            in_str = not in_str; continue
        if in_str:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    parsed = json.loads(text[start:i + 1])
                    return parsed if isinstance(parsed, dict) else {}
                except json.JSONDecodeError:
                    return {}
    return {}


# ──────────────────────────────────────────────────────────────────────────────
# ONNX inference — exact replica of the web worker
# ──────────────────────────────────────────────────────────────────────────────

def run_onnx(session, tokenizer, eos_id: int,
             user_content: str, state: dict) -> tuple[str, float, int]:
    """
    Builds a ChatML prompt (matching the web worker exactly) and runs
    greedy decoding through the ONNX session.
    Returns (raw_output, elapsed_seconds, num_generated_tokens).
    """
    video_ctx = format_video_context(state)
    user_msg = f"{video_ctx}\n\n[USER REQUEST]\n{user_content}"

    # Build ChatML — identical to edge-llm.worker.ts
    prompt_str = (
        f"<|im_start|>system\n{SYSTEM_INSTRUCTION}<|im_end|>\n"
        f"<|im_start|>user\n{user_msg}<|im_end|>\n"
        f"<|im_start|>assistant\n"
    )

    # add_special_tokens=False — ChatML already has all special tokens
    input_ids = tokenizer.encode(prompt_str, add_special_tokens=False)
    
    print("Token count:", len(input_ids))
    print("First 20:", input_ids[:20])
    print("Last 20:", input_ids[-20:])
    print("ALL TOKENS:", input_ids)
    print("DECODED PROMPT:\n", tokenizer.decode(input_ids, skip_special_tokens=False))

    generated = []

    # KV cache shape constants — matches config.json
    kv_shape = (1, 3, 0, 64)   # [batch, num_kv_heads=3, seq=0, head_dim=64]
    empty_kv = np.zeros(kv_shape, dtype=np.float32)
    kv_inputs = {
        inp.name for inp in session.get_inputs()
        if inp.name.startswith("past_key_values.")
    }

    start = time.perf_counter()

    for step in range(MAX_NEW_TOKENS):
        seq_len = len(input_ids)
        feeds = {
            "input_ids":      np.array([input_ids], dtype=np.int64),
            "attention_mask": np.ones((1, seq_len), dtype=np.int64),
            "position_ids":   np.arange(seq_len, dtype=np.int64).reshape(1, seq_len),
        }
        for name in kv_inputs:
            feeds[name] = empty_kv

        outputs     = session.run(None, feeds)
        out_names   = [o.name for o in session.get_outputs()]
        logits_idx  = next((i for i, n in enumerate(out_names) if n == "logits"), 0)
        last_logits = outputs[logits_idx][0, -1, :]   # [vocab_size]
        next_token  = int(np.argmax(last_logits))

        if next_token == eos_id:
            break

        generated.append(next_token)
        input_ids.append(next_token)

    elapsed = time.perf_counter() - start
    raw = tokenizer.decode(generated, skip_special_tokens=True)
    return raw, elapsed, len(generated)


# ──────────────────────────────────────────────────────────────────────────────
# Apply operations to timeline state
# ──────────────────────────────────────────────────────────────────────────────

def apply_ops(ops: list, state: dict, request: str):
    applied = []
    for op in ops:
        kind  = op.get("operation", "")
        start = op.get("start", 0)
        end   = op.get("end", 0)

        if kind == "cut":
            state["existing_cuts"].append({"start": start, "end": end})
            applied.append(f"Cut {start}s → {end}s")
        elif kind in ("mute", "mute_all"):
            state["silent_sections"].append({"start": start, "end": end})
            applied.append(f"Muted {start}s → {end}s")
        elif kind == "add_audio_overlay":
            state["bg_music"].append({"start": start, "end": end})
            applied.append(f"Added audio overlay {start}s → {end}s")

    if applied:
        state["recent_edits"].append(request)
        if len(state["recent_edits"]) > 5:
            state["recent_edits"].pop(0)
        state["last_action"] = ", ".join(applied)


# ──────────────────────────────────────────────────────────────────────────────
# Main chat loop
# ──────────────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "=" * 70)
    print(f"  🤖  ONNX {ONNX_LABEL} CHAT  (web worker simulation)")
    print(f"  Model: {ONNX_MODEL_PATH}")
    print("=" * 70)

    # ── Load model ────────────────────────────────────────────────────────────
    try:
        import onnxruntime as ort
        from transformers import AutoTokenizer
    except ImportError:
        print("❌ Missing deps — run: pip install onnxruntime transformers")
        return

    if not os.path.exists(ONNX_MODEL_PATH):
        print(f"❌ ONNX model not found: {ONNX_MODEL_PATH}")
        print("   Export it first (option 1 / convert_to_onnx.py).")
        return

    print(f"\n📦 Loading ONNX model…  ({ONNX_MODEL_PATH})")
    session = ort.InferenceSession(ONNX_MODEL_PATH,
                                   providers=["CPUExecutionProvider"])

    print(f"🔤 Loading tokenizer…   ({TOKENIZER_PATH})")
    tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_PATH, local_files_only=True)
    eos_id    = tokenizer.eos_token_id
    print(f"✅ Ready!  EOS = '{tokenizer.eos_token}'  (id={eos_id})")

    # ── Video state ───────────────────────────────────────────────────────────
    state = random_video()
    print(f"\n🎬 Video loaded: {state['name']}  ({state['duration']}s)\n")

    # ── Chat loop ─────────────────────────────────────────────────────────────
    while True:
        try:
            user_input = input("You (Ask Agent to Edit) > ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n\nGoodbye!")
            break

        if not user_input:
            continue
        if user_input.lower() in ("exit", "quit", "q"):
            print("Goodbye!")
            break

        print("⏳ Generating…")
        raw, elapsed, n_tokens = run_onnx(session, tokenizer, eos_id,
                                          user_input, state)
        tok_per_sec = n_tokens / max(elapsed, 0.001)

        print(f"\n🤖 ONNX RAW OUTPUT:")
        print("-" * 50)
        print(raw)
        print("-" * 50)

        parsed = parse_json(raw)
        msg  = parsed.get("message", "⚠️  Could not parse response.")
        ops  = parsed.get("operations", [])

        print(f"\n🗣️  AGENT: {msg}")

        if ops:
            apply_ops(ops, state, user_input)
            print(f"\n✅ OPERATIONS ({len(ops)}):")
            print(json.dumps(ops, indent=2))
        else:
            print("\n⚠️  No operations.")

        print(f"\n⏱️  {elapsed:.2f}s | ⚡ {tok_per_sec:.1f} tok/s | 🎟️  {n_tokens} tokens")

        # Show current timeline
        print("\n🎬 TIMELINE:")
        print("─" * 40)
        print(format_video_context(state))
        print("─" * 40 + "\n")


if __name__ == "__main__":
    main()
