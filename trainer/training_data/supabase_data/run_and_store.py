"""
run_and_store.py
────────────────
For each test input:
  1. Hornet (fine-tuned SmolLM2) runs the input  → stored as ai_output
  2. NVIDIA GLM runs the same input               → stored as expected_output

score_logs.py then compares ai_output ↔ expected_output to grade Hornet.

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


# ─── Load credentials ─────────────────────────────────────────────────────────
def _load_credentials():
    if not IS_COLAB:
        from dotenv import load_dotenv
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.env.local"))
        load_dotenv(env_path)
        print(f"🔑 Loaded credentials from: {env_path}")
    else:
        print("🔑 Using credentials from environment (set in Colab cell).")


# ─── Resolve model paths ─────────────────────────────────────────────────────
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


# ─── Ask GLM for the correct answer ──────────────────────────────────────────
def ask_glm(user_input: str, api_key: str) -> str:
    """
    Asks NVIDIA GLM (the reference AI) for the correct answer to the same input.
    This becomes the expected_output that Hornet's output is compared against.
    """
    from openai import OpenAI

    client = OpenAI(base_url=NVIDIA_BASE_URL, api_key=api_key)
    completion = client.chat.completions.create(
        model=NVIDIA_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_INSTRUCTION},
            {"role": "user",   "content": user_input},
        ],
        temperature=0.2,   # Low temp → deterministic, reliable reference answer
        top_p=1,
        max_tokens=512,
        stream=False,
    )
    raw = completion.choices[0].message.content.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    return raw


# ─── Store to Supabase ────────────────────────────────────────────────────────
def store_result(
    supabase,
    user_input: str,
    ai_output: str,       # Hornet's answer
    expected_output: str, # GLM's correct answer
    input_id: str,
    model_name_tag: str,
) -> bool:
    """Inserts a row into ai_logs. score/is_correct are left null for score_logs.py."""
    try:
        supabase.table("ai_logs").insert({
            "user_input":      user_input,
            "ai_output":       ai_output,
            "expected_output": expected_output,
            "model_name":      model_name_tag,
            # score and is_correct are intentionally null — score_logs.py fills them
        }).execute()
        return True
    except Exception as e:
        print(f"  ⚠️  [Supabase Error for {input_id}]: {e}")
        return False


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

    # ── List mode ─────────────────────────────────────────────────────────────
    if list_only:
        print("\nAvailable test sets:")
        for i, s in enumerate(ALL_TEST_SETS, 1):
            print(f"  [{i}] {s['name']}  ({len(s['inputs'])} inputs)")
        print(f"\nTotal: {sum(len(s['inputs']) for s in ALL_TEST_SETS)} inputs")
        return

    # ── Resolve which sets to run ─────────────────────────────────────────────
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
    print(f"  HORNET AI — RUN & STORE")
    print(f"  Hornet  : fine-tuned SmolLM2  (→ ai_output)")
    print(f"  GLM     : {NVIDIA_MODEL}  (→ expected_output)")
    print(f"  Sets    : {', '.join(s['name'] for s in selected)}")
    print(f"  Inputs  : {total} total")
    print(f"{'='*60}\n")

    # ── Load Hornet model once ────────────────────────────────────────────────
    active_model, model_name_tag = _resolve_model_paths()
    pipe, tokenizer = load_hornet(active_model, model_name_tag)

    stored_count = 0
    failed_count = 0

    for test_set in selected:
        print(f"\n📋 {test_set['name']} ({len(test_set['inputs'])} inputs)")
        print("-" * 50)

        for item in test_set["inputs"]:
            input_id   = item["id"]
            user_input = item["user_input"]
            last_line  = user_input.splitlines()[-1][:55]
            done       = stored_count + failed_count + 1

            print(f"\n  ▶ [{done}/{total}] Input {input_id}: {last_line}...")

            try:
                # Step 1: Hornet answers
                t0         = time.time()
                ai_output  = run_hornet(pipe, tokenizer, user_input)
                hornet_ms  = round(time.time() - t0, 2)
                print(f"    🤖 Hornet ({hornet_ms}s): {ai_output[:80]}...")

                # Step 2: GLM answers (rate-limited — 3s gap)
                t0              = time.time()
                expected_output = ask_glm(user_input, nv_key)
                glm_ms          = round(time.time() - t0, 2)
                print(f"    🌐 GLM    ({glm_ms}s): {expected_output[:80]}...")

                # Step 3: Store both
                ok = store_result(supabase, user_input, ai_output, expected_output, input_id, model_name_tag)
                if ok:
                    print(f"    ✅ Stored → score_logs.py will grade Hornet vs GLM")
                    stored_count += 1
                else:
                    failed_count += 1

            except Exception as e:
                print(f"    ❌ Error on {input_id}: {e}")
                failed_count += 1

            # Respect NVIDIA free-tier: 20 req/min → 3s between GLM calls
            time.sleep(3)

    print(f"\n{'='*60}")
    print(f"✅ Stored : {stored_count}")
    print(f"❌ Failed : {failed_count}")
    print(f"{'='*60}")
    print("\nNext step: run score_logs.py to grade Hornet vs GLM!\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run Hornet (SmolLM2) + GLM on test inputs and store both outputs in Supabase"
    )
    parser.add_argument(
        "--set", nargs="*", type=int,
        help="Which set numbers to run (1–9). Omit to run all. Example: --set 1 3 5"
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
