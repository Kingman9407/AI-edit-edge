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
import argparse
import time

# ─── Detect Colab ────────────────────────────────────────────────────────────
try:
    import google.colab  # noqa: F401
    IS_COLAB = True
except ImportError:
    IS_COLAB = False

# ─── Constants ────────────────────────────────────────────────────────────────
MAX_NEW_TOKENS = 256

# System instruction used when running Hornet (must match train.py)
# IMPORTANT: do NOT put "Return ONLY..." at the end — the model echoes it.
# Format constraints go at the TOP so they're part of the persona, not a
# trailing instruction that the model predicts and repeats as output.
SYSTEM_INSTRUCTION = (
    "You are Hornet, a video editing AI. "
    "Output format — two parts only, stop immediately after the last command line:\n"
    "SAY: <one sentence confirming what was done>\n"
    "<COMMAND> <VARIATION> [<N> SEC|MIN] [<start> <end>] [<track>]\n\n"
    "Commands (UPPERCASE): CUT | MUTE | ADD_AUDIO_OVERLAY\n"
    "Variations (UPPERCASE): FIRST | LAST | RANGE | BEFORE_PLAYHEAD | AFTER_PLAYHEAD | FULL_VIDEO\n"
    "Duration format: <N> SEC or <N> MIN (never '10s' or '2m').\n\n"
    "Examples:\n"
    "SAY: Removed the first 8 seconds.\n"
    "CUT FIRST 8 SEC\n\n"
    "SAY: Cut from 1:00 to 2:30.\n"
    "CUT RANGE 1:00 2:30\n\n"
    "SAY: Removed everything before the playhead.\n"
    "CUT BEFORE_PLAYHEAD"
)

# ─── Import dedicated modules ─────────────────────────────────────────────────
# glm_judge.py  — all GLM API question-asking logic
# validator.py  — all DSL output validation + Supabase storage + JSONL append
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glm_judge import ask_glm, test_glm_api, NVIDIA_MODEL, NVIDIA_BASE_URL
from validator import compare_outputs, store_result, append_to_jsonl, OUTPUT_FILE


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
        dtype=torch.float32,          # fix: torch_dtype deprecated, use dtype
        local_files_only=True,
    ).to(device)

    pipe = pipeline(
        "text-generation",
        model=model,
        tokenizer=tokenizer,
        device=device,
        clean_up_tokenization_spaces=False,  # fix: suppress BPE tokenizer warning
    )
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
    # Pass all generation args explicitly to avoid deprecation warning
    outputs = pipe(
        prompt,
        max_new_tokens=MAX_NEW_TOKENS,
        do_sample=False,
        eos_token_id=tokenizer.eos_token_id,
        pad_token_id=tokenizer.eos_token_id,
        return_full_text=False,
    )
    reply = outputs[0]["generated_text"].replace("<|im_end|>", "").strip()
    return reply





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

                # ── Step 2: GLM generates expected output ─────────────────────
                t0               = time.time()
                expected_output  = ask_glm(user_input, nv_key)
                glm_ms           = round(time.time() - t0, 2)
                
                # ── Step 3: Validate DSL — semantic + strict format ───────────────
                is_correct, reason, fmt_score, fmt_issues = compare_outputs(ai_output, expected_output)
                verdict_icon = "✅" if is_correct else "❌"
                verdict_word = "PASS" if is_correct else "FAIL"
                fmt_icon     = "🟢" if fmt_score >= 0.8 else "🟡" if fmt_score >= 0.4 else "🔴"

                print(f"    🌐 GLM ({glm_ms}s): {expected_output[:90]}...")
                print(f"    {verdict_icon} Semantic: {verdict_word} — {reason}")
                print(f"    {fmt_icon} Format:   {fmt_score:.0%}" +
                      (f" — {'; '.join(fmt_issues[:2])}{' ...' if len(fmt_issues)>2 else ''}" if fmt_issues else " — canonical"))

                # ── Step 4: Store to Supabase ─────────────────────────────────────
                ok = store_result(
                    supabase, user_input, ai_output, expected_output,
                    is_correct, reason, fmt_score, fmt_issues, input_id, model_name_tag
                )
                if ok:
                    grand_stored += 1
                    print(f"    💾 Stored to Supabase")

                # ── Step 5: Append to JSONL only if semantic PASS + format ≥ 80% ──
                if is_correct and fmt_score >= 0.8:
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
