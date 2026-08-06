"""
run_and_store.py
────────────────
For each selected test batch:
  1. Hornet (fine-tuned SmolLM2) runs each input → ai_output
  2. GLM judges the output against the user request → PASS/FAIL + reason
  3. Result stored to Supabase with is_correct + score (reason) filled immediately
  4. PASS rows are appended to auto_training_data.jsonl inline — no separate steps needed

Usage:
    python run_and_store.py                  # Run all sets
    python run_and_store.py --set 1          # Run only Set 1
    python run_and_store.py --set 1 2 3      # Run sets 1, 2, 3
    python run_and_store.py --list           # List available sets and exit
    python run_and_store.py --interactive    # Pick sets interactively
"""

import os
import sys
import json
import argparse
import time

# ─── Detect Colab ────────────────────────────────────────────────────────────
try:
    import google.colab  # noqa: F401
    IS_COLAB = True
except ImportError:
    IS_COLAB = False

# ─── Constants ────────────────────────────────────────────────────────────────
NVIDIA_MODEL    = "z-ai/glm-5.2"
NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
MAX_NEW_TOKENS  = 256

# System instruction used when running Hornet (must match train.py)
SYSTEM_INSTRUCTION = (
    "You are Hornet, a video editing AI. "
    "Given a user video editing request with metadata and timeline state, "
    "return a JSON object with exactly two keys:\n"
    "  - \"message\": a friendly string describing what was done\n"
    "  - \"operations\": an array of operation objects\n\n"
    "Each operation object:\n"
    "  - \"operation\": one of \"cut\" | \"mute\" | \"add_audio_overlay\"\n"
    "  - \"variation\": one of \"first\" | \"last\" | \"range\" | \"before_playhead\" | \"after_playhead\"\n"
    "  - \"value\": (number) used when variation is \"first\" or \"last\" — the N seconds\n"
    "  - \"start\": (string) used when variation is \"range\"\n"
    "  - \"end\": (string) used when variation is \"range\"\n"
    "  - \"unit\": always \"seconds\"\n"
    "  - \"track\": (string) only for add_audio_overlay — the filename\n"
    "  - \"reason\": a short string explaining why\n\n"
    "Return ONLY the raw JSON object. No markdown, no code fences, no explanation."
)

# System instruction used when writing ChatML to the training JSONL
# (must match the system instruction used during SFT training)
CHATML_SYSTEM = (
    "You are Hornet, a video editing AI. Return JSON with 'message' and 'operations' "
    "(cut, mute, add_audio_overlay). "
    "If the user mentions time expressions requiring calculation, output a <tool_call> block first. "
    "Otherwise, output the final JSON directly."
)

# GLM judge system prompt
JUDGE_SYSTEM = (
    "You are a strict evaluator for Hornet, a video editing AI assistant.\n"
    "Hornet must return a valid JSON object with exactly two keys:\n"
    "  - \"message\": a friendly string\n"
    "  - \"operations\": an array of operation objects, each with:\n"
    "      \"operation\" (cut/mute/add_audio_overlay), "
    "\"variation\" (first/last/range/before_playhead/after_playhead),\n"
    "      and the appropriate parameter fields (value, start, end, unit, track, reason).\n\n"
    "Evaluate whether the RESPONSE correctly and completely fulfils the REQUEST.\n"
    "Reply with EXACTLY one of:\n"
    "  PASS: <one-line reason why it is correct>\n"
    "  FAIL: <one-line reason why it is wrong or incomplete>"
)

# Output JSONL — lives alongside this file in supabase_data/
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "auto_training_data.jsonl")


# ─── Load credentials ─────────────────────────────────────────────────────────
def _load_credentials():
    if not IS_COLAB:
        from dotenv import load_dotenv
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.env.local"))
        load_dotenv(env_path)
        print(f"🔑 Loaded credentials from: {env_path}")
    else:
        print("🔑 Using credentials from environment (set in Colab cell).")


# ─── Resolve model paths ──────────────────────────────────────────────────────
def _resolve_model_paths():
    if IS_COLAB:
        model_path = "/content/repo/trainer/fine_tuned_smollm"
        base_model = "/content/repo/trainer/SmolLM2-135M-Instruct"
    else:
        model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../fine_tuned_smollm"))
        base_model = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../SmolLM2-135M-Instruct"))

    active_model   = model_path if os.path.exists(model_path) else base_model
    model_name_tag = "fine_tuned_smollm" if os.path.exists(model_path) else "smollm2-base"
    return active_model, model_name_tag


# ─── Load Hornet (SmolLM2) ────────────────────────────────────────────────────
def load_hornet(active_model: str, model_name_tag: str):
    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline

    if not os.path.exists(active_model):
        print(f"❌ Model not found at: {active_model}")
        print("   Run train.py (or download_model.py) first.")
        sys.exit(1)

    device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"🚀 Loading Hornet from: {active_model}")
    print(f"   Device: {device.upper()}")

    tokenizer = AutoTokenizer.from_pretrained(active_model, local_files_only=True)
    tokenizer.pad_token = "<|endoftext|>"

    model = AutoModelForCausalLM.from_pretrained(
        active_model,
        torch_dtype=torch.float32,
        local_files_only=True,
    ).to(device)

    pipe = pipeline("text-generation", model=model, tokenizer=tokenizer, device=device)
    print(f"✅ Hornet loaded! ({model_name_tag})")
    return pipe, tokenizer


# ─── Run Hornet on a single input ─────────────────────────────────────────────
def run_hornet(pipe, tokenizer, user_input: str) -> str:
    """Runs the fine-tuned SmolLM2 on a user_input and returns the raw output."""
    prompt = (
        f"<|im_start|>system\n{SYSTEM_INSTRUCTION}<|im_end|>\n"
        f"<|im_start|>user\n{user_input}<|im_end|>\n"
        f"<|im_start|>assistant\n"
    )
    outputs = pipe(
        prompt,
        max_new_tokens=MAX_NEW_TOKENS,
        do_sample=False,
        temperature=1.0,
        pad_token_id=tokenizer.eos_token_id,
    )
    full_text = outputs[0]["generated_text"]
    if "<|im_start|>assistant" in full_text:
        reply = full_text.split("<|im_start|>assistant")[-1]
    else:
        reply = full_text[len(prompt):]
    return reply.replace("<|im_end|>", "").strip()


# ─── GLM judge: PASS or FAIL? ─────────────────────────────────────────────────
def judge_with_glm(user_input: str, ai_output: str, api_key: str) -> tuple[bool, str]:
    """
    Asks GLM to judge whether Hornet's ai_output correctly fulfils the user_input.
    Returns (is_correct: bool, reason: str).
    """
    from openai import OpenAI

    client = OpenAI(base_url=NVIDIA_BASE_URL, api_key=api_key)
    judge_prompt = (
        f"REQUEST:\n{user_input}\n\n"
        f"RESPONSE:\n{ai_output}"
    )

    completion = client.chat.completions.create(
        model=NVIDIA_MODEL,
        messages=[
            {"role": "system", "content": JUDGE_SYSTEM},
            {"role": "user",   "content": judge_prompt},
        ],
        temperature=0.0,   # Fully deterministic judge
        top_p=1,
        max_tokens=80,
        stream=False,
    )
    raw = completion.choices[0].message.content.strip()

    # Parse "PASS: reason" or "FAIL: reason"
    upper = raw.upper()
    if upper.startswith("PASS"):
        is_correct = True
        reason = raw[raw.find(":") + 1:].strip() if ":" in raw else "Correct response."
    elif upper.startswith("FAIL"):
        is_correct = False
        reason = raw[raw.find(":") + 1:].strip() if ":" in raw else "Incorrect response."
    else:
        # Ambiguous — treat as fail but preserve full response
        is_correct = False
        reason = f"[ambiguous verdict] {raw}"

    return is_correct, reason


# ─── Store to Supabase ────────────────────────────────────────────────────────
def store_result(
    supabase,
    user_input: str,
    ai_output: str,
    is_correct: bool,
    score_reason: str,
    input_id: str,
    model_name_tag: str,
) -> bool:
    """
    Inserts a fully-scored row into ai_logs.
    score = GLM judge reason string; is_correct = PASS/FAIL verdict.
    """
    try:
        supabase.table("ai_logs").insert({
            "user_input":  user_input,
            "ai_output":   ai_output,
            "score":       score_reason,
            "is_correct":  is_correct,
            "model_name":  model_name_tag,
        }).execute()
        return True
    except Exception as e:
        print(f"  ⚠️  [Supabase Error for {input_id}]: {e}")
        return False


# ─── Append a passing row to the JSONL training file ─────────────────────────
def append_to_jsonl(user_input: str, ai_output: str):
    """Formats as ChatML and appends one line to auto_training_data.jsonl."""
    text  = f"<|im_start|>system\n{CHATML_SYSTEM}<|im_end|>\n"
    text += f"<|im_start|>user\n{user_input}<|im_end|>\n"
    text += f"<|im_start|>assistant\n{ai_output}<|im_end|>\n"
    record = {"text": text}
    with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


# ─── Interactive batch picker ─────────────────────────────────────────────────
def pick_sets_interactively(all_sets: list) -> list:
    print("\n╔══════════════════════════════════════════════════════╗")
    print("║          HORNET AI — SELECT TEST BATCHES             ║")
    print("╠══════════════════════════════════════════════════════╣")
    for i, s in enumerate(all_sets, 1):
        print(f"║  [{i:>2}] {s['name']:<40} ({len(s['inputs'])} inputs) ║")
    print("║  [ 0] Run ALL sets                                   ║")
    print("╚══════════════════════════════════════════════════════╝\n")

    raw = input("Enter set numbers separated by spaces (e.g. '1 3 5'), or 0 for all: ").strip()

    if not raw or raw == "0":
        return list(range(1, len(all_sets) + 1))

    chosen = []
    for token in raw.split():
        try:
            n = int(token)
            if 1 <= n <= len(all_sets):
                chosen.append(n)
            else:
                print(f"  ⚠  Ignoring out-of-range: {n}")
        except ValueError:
            print(f"  ⚠  Ignoring invalid input: {token!r}")

    return sorted(set(chosen))


# ─── Main ─────────────────────────────────────────────────────────────────────
def main(set_ids: list = None, interactive: bool = False, list_only: bool = False):
    _load_credentials()

    from supabase import create_client, Client
    sb_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    sb_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    nv_key = os.environ.get("NVIDIA_API_KEY")

    if not sb_url or not sb_key:
        print("❌ Missing Supabase credentials! Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.")
        sys.exit(1)
    if not nv_key:
        print("❌ Missing NVIDIA_API_KEY. Add it to Colab Secrets or .env.local.")
        sys.exit(1)

    supabase: Client = create_client(sb_url, sb_key)

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from test_inputs import ALL_TEST_SETS

    # ── List mode ──────────────────────────────────────────────────────────────
    if list_only:
        print("\nAvailable test sets:")
        for i, s in enumerate(ALL_TEST_SETS, 1):
            print(f"  [{i}] {s['name']}  ({len(s['inputs'])} inputs)")
        print(f"\nTotal: {sum(len(s['inputs']) for s in ALL_TEST_SETS)} inputs")
        return

    # ── Resolve which sets to run ──────────────────────────────────────────────
    if interactive:
        set_ids = pick_sets_interactively(ALL_TEST_SETS)
        if not set_ids:
            print("No sets selected. Exiting.")
            return

    if set_ids:
        selected = [ALL_TEST_SETS[i - 1] for i in set_ids if 1 <= i <= len(ALL_TEST_SETS)]
    else:
        selected = ALL_TEST_SETS

    total = sum(len(s["inputs"]) for s in selected)

    print(f"\n{'='*60}")
    print(f"  🐝 HORNET AI — RUN + JUDGE + EXTRACT")
    print(f"  Scorer  : GLM ({NVIDIA_MODEL}) as judge")
    print(f"  Sets    : {', '.join(s['name'] for s in selected)}")
    print(f"  Inputs  : {total} total")
    print(f"  Output  : {OUTPUT_FILE}")
    print(f"{'='*60}\n")

    # ── Load Hornet model once ─────────────────────────────────────────────────
    active_model, model_name_tag = _resolve_model_paths()
    pipe, tokenizer = load_hornet(active_model, model_name_tag)

    # ── Ensure output file exists (clear for a fresh run) ─────────────────────
    # Comment out the open() below if you want to APPEND to an existing file
    open(OUTPUT_FILE, "w").close()
    print(f"📄 Cleared {OUTPUT_FILE} — will append as batches complete.\n")

    grand_stored = 0
    grand_passed = 0
    grand_failed = 0
    grand_errors = 0
    global_idx   = 0

    for test_set in selected:
        set_name   = test_set["name"]
        set_inputs = test_set["inputs"]

        print(f"\n{'━'*60}")
        print(f"  📋 BATCH: {set_name}  ({len(set_inputs)} inputs)")
        print(f"{'━'*60}")

        batch_passed = 0
        batch_failed = 0

        for item in set_inputs:
            input_id   = item["id"]
            user_input = item["user_input"]
            last_line  = user_input.splitlines()[-1][:55]
            global_idx += 1

            print(f"\n  ▶ [{global_idx}/{total}] {input_id}: {last_line}...")

            try:
                # ── Step 1: Hornet answers ─────────────────────────────────────
                t0        = time.time()
                ai_output = run_hornet(pipe, tokenizer, user_input)
                hornet_ms = round(time.time() - t0, 2)
                print(f"    🤖 Hornet ({hornet_ms}s): {ai_output[:90]}...")

                # ── Step 2: GLM judges the answer ─────────────────────────────
                t0           = time.time()
                is_correct, reason = judge_with_glm(user_input, ai_output, nv_key)
                judge_ms     = round(time.time() - t0, 2)
                verdict_icon = "✅" if is_correct else "❌"
                verdict_word = "PASS" if is_correct else "FAIL"
                print(f"    {verdict_icon} Judge ({judge_ms}s): {verdict_word} — {reason}")

                # ── Step 3: Store to Supabase ─────────────────────────────────
                ok = store_result(
                    supabase, user_input, ai_output,
                    is_correct, reason, input_id, model_name_tag
                )
                if ok:
                    grand_stored += 1
                    print(f"    💾 Stored to Supabase")

                # ── Step 4: Append to JSONL if PASS ───────────────────────────
                if is_correct:
                    append_to_jsonl(user_input, ai_output)
                    batch_passed += 1
                    grand_passed += 1
                    print(f"    📝 Appended to auto_training_data.jsonl")
                else:
                    batch_failed += 1
                    grand_failed += 1

            except Exception as e:
                print(f"    ❌ Error on {input_id}: {e}")
                grand_errors += 1

            # Respect NVIDIA free-tier: 20 req/min → ~3s between judge calls
            time.sleep(3)

        # ── Batch summary ──────────────────────────────────────────────────────
        print(f"\n  ✔  Batch '{set_name}' complete → "
              f"✅ {batch_passed} passed  ❌ {batch_failed} failed")

    # ── Grand summary ──────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"  🎉 ALL BATCHES COMPLETE")
    print(f"{'='*60}")
    print(f"  Stored to Supabase : {grand_stored}")
    print(f"  ✅ Passed (→ JSONL) : {grand_passed}")
    print(f"  ❌ Failed           : {grand_failed}")
    if grand_errors:
        print(f"  ⚠️  Errors          : {grand_errors}")
    print(f"\n  📄 auto_training_data.jsonl → {grand_passed} training examples")
    print(f"{'='*60}")
    if grand_passed > 0:
        print("\n✅ Ready! Update train.py to use auto_training_data.jsonl for the next run.\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run Hornet on test inputs, judge with GLM, store results and extract passing rows"
    )
    parser.add_argument(
        "--set", nargs="*", type=int,
        help="Which set numbers to run (1-N). Omit to run all. Example: --set 1 3 5"
    )
    parser.add_argument(
        "--interactive", action="store_true",
        help="Show an interactive menu to pick which sets to run"
    )
    parser.add_argument(
        "--list", action="store_true",
        help="List all available test sets and exit"
    )
    args = parser.parse_args()
    main(set_ids=args.set, interactive=args.interactive, list_only=args.list)
