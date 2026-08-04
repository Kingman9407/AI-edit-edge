"""
run_and_store.py
────────────────
Runs all test inputs through the fine-tuned Hornet (SmolLM2) model directly
and stores BOTH the user_input and ai_output into Supabase ai_logs.

No HTTP server needed — model loads directly in Python.
Designed to run inside Google Colab (or locally).

Usage:
    python run_and_store.py
    python run_and_store.py --set 1          # Run only Set 1 (Cut First)
    python run_and_store.py --set 1 2 3      # Run sets 1, 2, 3
"""

import os
import sys
import json
import argparse
import time

# ─── Detect Colab ────────────────────────────────────────────────────────────
# userdata.get() only works in the Jupyter kernel, NOT in subprocesses.
# Instead: set env vars in your Colab cell BEFORE running this script.
# This script will inherit them automatically.
try:
    import google.colab  # noqa: F401
    IS_COLAB = True
except ImportError:
    IS_COLAB = False

# ─── Heavy imports (torch etc.) ───────────────────────────────────────────────
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline

# ─── Constants ────────────────────────────────────────────────────────────────
SYSTEM_INSTRUCTION = (
    "You are Hornet, a video editing AI. Return JSON with 'message' and 'operations' (cut, mute, add_audio_overlay). "
    "If the user mentions time expressions requiring calculation, output a <tool_call> block first. "
    "Otherwise, output the final JSON directly."
)
MAX_NEW_TOKENS = 256


def _load_credentials():
    """Load Supabase credentials.
    - In Colab: env vars are set in the notebook cell before running this script.
    - Locally: load from .env.local via dotenv.
    """
    if not IS_COLAB:
        from dotenv import load_dotenv
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.env.local"))
        load_dotenv(env_path)
        print(f"🔑 Loaded credentials from: {env_path}")
    else:
        print("🔑 Using credentials from environment (set in Colab cell).")


def _resolve_model_paths():
    """Return (model_path, base_model, active_model, model_name_tag)."""
    if IS_COLAB:
        model_path = "/content/repo/trainer/fine_tuned_smollm"
        base_model  = "/content/repo/trainer/SmolLM2-135M-Instruct"
    else:
        model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../fine_tuned_smollm"))
        base_model  = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../SmolLM2-135M-Instruct"))

    active_model   = model_path if os.path.exists(model_path) else base_model
    model_name_tag = "fine_tuned_smollm" if os.path.exists(model_path) else "smollm2-base"
    return active_model, model_name_tag


# ─── Load Model ───────────────────────────────────────────────────────────────
def load_model(active_model: str, model_name_tag: str):
    if not os.path.exists(active_model):
        print(f"❌ Model not found at: {active_model}")
        print("   Run train.py (or download_model.py) first.")
        sys.exit(1)

    device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"🚀 Loading model from: {active_model}")
    print(f"   Device: {device.upper()}")

    tokenizer = AutoTokenizer.from_pretrained(active_model, local_files_only=True)
    tokenizer.pad_token = "<|endoftext|>"

    model = AutoModelForCausalLM.from_pretrained(
        active_model,
        torch_dtype=torch.float32,
        local_files_only=True,
    ).to(device)

    pipe = pipeline("text-generation", model=model, tokenizer=tokenizer, device=device)
    print(f"✅ Model loaded! ({model_name_tag})")
    return pipe, tokenizer, device


# ─── Run Single Input ─────────────────────────────────────────────────────────
def run_input(pipe, tokenizer, user_input: str) -> str:
    """
    Formats the user_input into ChatML, runs it through the model,
    and returns the raw assistant output string.
    """
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

    # Extract only the assistant's reply (after the last <|im_start|>assistant)
    if "<|im_start|>assistant" in full_text:
        reply = full_text.split("<|im_start|>assistant")[-1]
    else:
        reply = full_text[len(prompt):]

    return reply.replace("<|im_end|>", "").strip()


# ─── Store to Supabase ────────────────────────────────────────────────────────
def store_result(supabase, user_input: str, ai_output: str, input_id: str, model_name_tag: str) -> bool:
    """Inserts user_input + ai_output into Supabase ai_logs. Score is left null."""
    try:
        supabase.table("ai_logs").insert({
            "user_input": user_input,
            "ai_output":  ai_output,
            "model_name": model_name_tag,
            # score and is_correct are left null — score_logs.py will fill them
        }).execute()
        return True
    except Exception as e:
        print(f"  ⚠️  [Supabase Error for {input_id}]: {e}")
        return False


# ─── Main Runner ──────────────────────────────────────────────────────────────
def main(set_ids: list = None):
    # ── 1. Load credentials (safe to call here, not at import time) ──────────
    _load_credentials()

    from supabase import create_client, Client
    sb_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    sb_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not sb_url or not sb_key:
        print("❌ Missing Supabase credentials! Set SUPABASE_URL and SUPABASE_KEY.")
        sys.exit(1)
    supabase: Client = create_client(sb_url, sb_key)

    # ── 2. Resolve model paths ────────────────────────────────────────────────
    active_model, model_name_tag = _resolve_model_paths()

    # ── 3. Import test inputs ─────────────────────────────────────────────────
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from test_inputs import ALL_TEST_SETS

    # Filter sets if requested
    if set_ids:
        selected = [ALL_TEST_SETS[i - 1] for i in set_ids if 1 <= i <= len(ALL_TEST_SETS)]
    else:
        selected = ALL_TEST_SETS

    total = sum(len(s["inputs"]) for s in selected)
    print(f"\n{'='*60}")
    print(f"  HORNET AI — RUN & STORE ({total} inputs across {len(selected)} sets)")
    print(f"  Model: {model_name_tag}")
    print(f"{'='*60}\n")

    # ── 4. Load model ─────────────────────────────────────────────────────────
    pipe, tokenizer, device = load_model(active_model, model_name_tag)

    stored_count = 0
    failed_count = 0

    for test_set in selected:
        print(f"\n📋 {test_set['name']} ({len(test_set['inputs'])} inputs)")
        print("-" * 50)

        for item in test_set["inputs"]:
            input_id   = item["id"]
            user_input = item["user_input"]

            print(f"\n  ▶ Input {input_id}: {user_input.splitlines()[-1][:60]}...")

            try:
                start     = time.time()
                ai_output = run_input(pipe, tokenizer, user_input)
                latency   = round(time.time() - start, 2)

                print(f"    ← Output ({latency}s): {ai_output[:100]}...")

                ok = store_result(supabase, user_input, ai_output, input_id, model_name_tag)
                if ok:
                    print(f"    ✅ Stored in Supabase")
                    stored_count += 1
                else:
                    failed_count += 1

            except Exception as e:
                print(f"    ❌ Model error on {input_id}: {e}")
                failed_count += 1

    print(f"\n{'='*60}")
    print(f"✅ Stored: {stored_count} | ❌ Failed: {failed_count}")
    print(f"{'='*60}")
    print("\nNext step: run score_logs.py to grade the results!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Hornet AI on test inputs and store in Supabase")
    parser.add_argument("--set", nargs="*", type=int, help="Which set numbers to run (1-9). Omit to run all.")
    args = parser.parse_args()
    main(args.set)
