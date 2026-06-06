"""
test_onnx_model.py — Side-by-side model comparison runner.

Modes (set via COMPARE_MODE env var or interactive prompt):
  pytorch_vs_int8  — PyTorch float32 vs ONNX INT8
  pytorch_vs_fp16  — PyTorch float32 vs ONNX FP16
  pytorch_vs_fp32  — PyTorch float32 vs ONNX FP32
  int8_vs_fp32     — ONNX INT8 vs ONNX FP32
  all_four         — PyTorch + ONNX INT8 + ONNX FP16 + ONNX FP32
"""

import os
import json
import time
import random
import numpy as np

# ──────────────────────────────────────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────────────────────────────────────
INT8_MODEL_PATH  = "./fine_tuned_smollm_onnx/model.onnx"
FP16_MODEL_PATH  = "./fine_tuned_smollm_onnx_fp16/model.onnx"
FP32_MODEL_PATH  = "./fine_tuned_smollm_onnx_fp32/model.onnx"
TOKENIZER_PATH   = "./fine_tuned_smollm"
PYTORCH_PATH     = "./fine_tuned_smollm"
MAX_NEW_TOKENS   = 256

SYSTEM_INSTRUCTION = (
    "You are Hornet, a natural language processing (NLP) assistant. "
    "You analyze the user's video editing requests and return a structured JSON object "
    "containing two fields: 'message' (a natural response) and 'operations' (a list of video edit actions "
    "like 'cut', 'mute', 'add_audio_overlay' with start and end timestamps in seconds). "
    "Output ONLY a raw JSON object. Do NOT use markdown formatting, backticks, or extra text outside the JSON."
)

MOCK_STATE = {
    "name": "lecture_deep_learning.mp4",
    "duration": 480.0,
    "resolution": "1920x1080",
    "playhead": 0.0,
    "existing_cuts": [],
    "silent_sections": [],
    "bg_music": [],
    "recent_edits": [],
    "last_action": "None",
}


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def format_context(state: dict) -> str:
    def fmt(items):
        return "- None" if not items else "\n".join(f"- {i['start']} -> {i['end']}" for i in items)
    return (
        f"[VIDEO METADATA]\nName: {state['name']}\nDuration: {state['duration']}s\n"
        f"Resolution: {state['resolution']}\nPlayhead: {state['playhead']}s\n\n"
        f"[TIMELINE STATE]\nCuts:\n{fmt(state['existing_cuts'])}\n\n"
        f"Muted Sections:\n{fmt(state['silent_sections'])}\n\n"
        f"Subtitles:\n- None\n\nBackground Music:\n{fmt(state['bg_music'])}\n\n"
        f"[RECENT EDITS]\n{'None' if not state['recent_edits'] else chr(10).join(f'{i+1}. {e}' for i,e in enumerate(state['recent_edits']))}\n\n"
        f"[LAST ACTION]\n{state['last_action']}"
    )


def build_chatml(user_request: str, state: dict) -> str:
    return (
        f"<|im_start|>system\n{SYSTEM_INSTRUCTION}<|im_end|>\n"
        f"<|im_start|>user\n{format_context(state)}\n\n[USER REQUEST]\n{user_request}<|im_end|>\n"
        f"<|im_start|>assistant\n"
    )


def parse_json(text: str) -> dict:
    start = text.find("{")
    if start == -1:
        return {}
    depth = 0
    in_str = esc = False
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
                    p = json.loads(text[start:i + 1])
                    return p if isinstance(p, dict) else {}
                except json.JSONDecodeError:
                    return {}
    return {}


def infer_onnx(session, tokenizer, eos_id: int, prompt_str: str) -> tuple[str, float, int]:
    """Greedy decoding through ONNX session — exact web worker replica."""
    input_ids = tokenizer.encode(prompt_str, add_special_tokens=False)
    generated = []
    kv_shape  = (1, 3, 0, 64)
    empty_kv  = np.zeros(kv_shape, dtype=np.float32)
    kv_inputs = {inp.name for inp in session.get_inputs() if inp.name.startswith("past_key_values.")}
    out_names = [o.name for o in session.get_outputs()]
    logits_idx = next((i for i, n in enumerate(out_names) if n == "logits"), 0)

    start = time.perf_counter()
    for _ in range(MAX_NEW_TOKENS):
        seq_len = len(input_ids)
        feeds = {
            "input_ids":      np.array([input_ids], dtype=np.int64),
            "attention_mask": np.ones((1, seq_len), dtype=np.int64),
            "position_ids":   np.arange(seq_len, dtype=np.int64).reshape(1, seq_len),
        }
        for name in kv_inputs:
            feeds[name] = empty_kv
        logits     = session.run(None, feeds)[logits_idx]
        next_token = int(np.argmax(logits[0, -1, :]))
        if next_token == eos_id:
            break
        generated.append(next_token)
        input_ids.append(next_token)

    elapsed = time.perf_counter() - start
    return tokenizer.decode(generated, skip_special_tokens=True), elapsed, len(generated)


def infer_pytorch(pipe, tokenizer, prompt_str: str) -> tuple[str, float, int]:
    start = time.perf_counter()
    out = pipe(prompt_str, max_new_tokens=MAX_NEW_TOKENS, do_sample=False,
               eos_token_id=tokenizer.eos_token_id,
               pad_token_id=tokenizer.eos_token_id)
    elapsed = time.perf_counter() - start
    raw = out[0]["generated_text"]
    return raw, elapsed, max(1, len(tokenizer.encode(raw)))


def print_result(label: str, raw: str, elapsed: float, n_tokens: int):
    tok_per_s = n_tokens / max(elapsed, 0.001)
    parsed    = parse_json(raw)
    msg       = parsed.get("message", "⚠️ No JSON")
    ops       = parsed.get("operations", [])
    valid     = "✅" if parsed else "❌ invalid JSON"

    print(f"\n{'─'*60}")
    print(f"  {label}   {valid}  |  {elapsed:.2f}s  |  {tok_per_s:.1f} tok/s  |  {n_tokens} tokens")
    print(f"{'─'*60}")
    print(f"  RAW:  {raw[:120]}{'…' if len(raw)>120 else ''}")
    print(f"  MSG:  {msg}")
    if ops:
        print(f"  OPS:  {json.dumps(ops)}")
    else:
        print(f"  OPS:  (none)")


# ──────────────────────────────────────────────────────────────────────────────
# Model loaders
# ──────────────────────────────────────────────────────────────────────────────

def load_onnx(path: str, tokenizer):
    import onnxruntime as ort
    print(f"📦 Loading ONNX: {path}")
    session = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
    eos_id  = tokenizer.eos_token_id
    print(f"✅ ONNX ready. EOS='{tokenizer.eos_token}' (id={eos_id})")
    return session, eos_id


def load_pytorch():
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
    print(f"📦 Loading PyTorch: {PYTORCH_PATH}")
    tok   = AutoTokenizer.from_pretrained(PYTORCH_PATH, local_files_only=True)
    model = AutoModelForCausalLM.from_pretrained(PYTORCH_PATH, local_files_only=True)
    dev   = "mps" if torch.backends.mps.is_available() else "cpu"
    pipe  = pipeline("text-generation", model=model.to(dev), tokenizer=tok,
                     device=dev, return_full_text=False)
    print(f"✅ PyTorch ready on {dev.upper()}")
    return pipe, tok


# ──────────────────────────────────────────────────────────────────────────────
# Comparison chat loop
# ──────────────────────────────────────────────────────────────────────────────

def comparison_loop(runners: list, state: dict):
    """
    runners: list of (label, run_fn) where run_fn(prompt_str) -> (raw, elapsed, n_tokens)
    """
    print(f"\nModels active: {', '.join(r[0] for r in runners)}")
    print("Type your video editing request. 'exit' to quit.\n")

    while True:
        try:
            user_input = input("You > ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye!"); break
        if not user_input:
            continue
        if user_input.lower() in ("exit", "quit", "q"):
            print("Goodbye!"); break

        prompt_str = build_chatml(user_input, state)
        print()
        for label, run_fn in runners:
            raw, elapsed, n = run_fn(prompt_str)
            print_result(label, raw, elapsed, n)

        print()


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

def main():
    try:
        import onnxruntime  # noqa
        from transformers import AutoTokenizer
    except ImportError:
        print("❌ Missing deps — run: pip install onnxruntime transformers")
        return

    # Determine mode
    mode = os.environ.get("COMPARE_MODE", "").strip()
    if not mode:
        print("\n" + "=" * 60)
        print("  Select comparison mode:")
        print("  [A]  PyTorch (float32) vs ONNX INT8")
        print("  [B]  PyTorch (float32) vs ONNX FP16")
        print("  [C]  PyTorch (float32) vs ONNX FP32")
        print("  [D]  ONNX INT8 vs ONNX FP32")
        print("  [E]  All variants: PyTorch + INT8 + FP16 + FP32")
        print("=" * 60)
        sel  = input("Choice: ").strip().upper()
        mode = {"A": "pytorch_vs_int8", "B": "pytorch_vs_fp16", "C": "pytorch_vs_fp32",
                "D": "int8_vs_fp32",    "E": "all_four"}.get(sel, "pytorch_vs_int8")

    print(f"\n🔬 Comparison mode: {mode}\n")

    # Load shared tokenizer
    tok = AutoTokenizer.from_pretrained(TOKENIZER_PATH, local_files_only=True)

    runners = []

    need_pytorch = mode in ("pytorch_vs_int8", "pytorch_vs_fp16", "pytorch_vs_fp32", "all_four")
    need_int8    = mode in ("pytorch_vs_int8",  "int8_vs_fp32",   "all_four")
    need_fp16    = mode in ("pytorch_vs_fp16", "all_four")
    need_fp32    = mode in ("pytorch_vs_fp32",  "int8_vs_fp32",   "all_four")

    if need_pytorch:
        pipe, ptok = load_pytorch()
        runners.append(("🟣 PyTorch FP32", lambda p, _pipe=pipe, _tok=ptok: infer_pytorch(_pipe, _tok, p)))

    if need_int8:
        if not os.path.exists(INT8_MODEL_PATH):
            print(f"❌ INT8 model not found: {INT8_MODEL_PATH}")
        else:
            s8, eos8 = load_onnx(INT8_MODEL_PATH, tok)
            runners.append(("🔴 ONNX INT8   ", lambda p, _s=s8, _e=eos8: infer_onnx(_s, tok, _e, p)))

    if need_fp16:
        if not os.path.exists(FP16_MODEL_PATH):
            print(f"❌ FP16 model not found: {FP16_MODEL_PATH}")
        else:
            s16, eos16 = load_onnx(FP16_MODEL_PATH, tok)
            runners.append(("🟡 ONNX FP16   ", lambda p, _s=s16, _e=eos16: infer_onnx(_s, tok, _e, p)))

    if need_fp32:
        if not os.path.exists(FP32_MODEL_PATH):
            print(f"❌ FP32 model not found: {FP32_MODEL_PATH}")
        else:
            s32, eos32 = load_onnx(FP32_MODEL_PATH, tok)
            runners.append(("🟢 ONNX FP32   ", lambda p, _s=s32, _e=eos32: infer_onnx(_s, tok, _e, p)))

    if not runners:
        print("❌ No models could be loaded. Check paths.")
        return

    comparison_loop(runners, MOCK_STATE)


if __name__ == "__main__":
    main()
