"""
extract_db_logs.py
──────────────────
Pulls all rows where is_correct=True from Supabase ai_logs and formats
them as a ChatML JSONL file ready for SmolLM2 fine-tuning.

Output: ./auto_training_data.jsonl  (inside supabase_data/, self-contained)

Usage:
    python extract_db_logs.py
"""

import os
import sys
import json

# ─── Env: inherited from Colab cell → dotenv fallback for local ─────────────────
try:
    import google.colab  # noqa: F401
    IS_COLAB = True
except ImportError:
    IS_COLAB = False

if not IS_COLAB:
    from dotenv import load_dotenv
    _env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.env.local"))
    load_dotenv(_env_path)
    print(f"🔑 Loaded credentials from: {_env_path}")
else:
    print("🔑 Using credentials from environment (set in Colab cell).")

from supabase import create_client, Client

# ─── System instruction (must match train.py / run_and_store.py exactly) ─────
SYSTEM_INSTRUCTION = (
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

# Output lives inside supabase_data/ — keeping everything self-contained
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "auto_training_data.jsonl")


def format_chatml(user_content: str, assistant_output: str) -> dict:
    """Formats a single interaction into ChatML for SmolLM2 SFT."""
    text  = f"<|im_start|>system\n{SYSTEM_INSTRUCTION}<|im_end|>\n"
    text += f"<|im_start|>user\n{user_content}<|im_end|>\n"
    text += f"<|im_start|>assistant\n{assistant_output}<|im_end|>\n"
    return {"text": text}


def main() -> int:
    """
    Main extractor. Returns the number of rows written to disk.
    """
    print("=" * 60)
    print("      HORNET AI — EXTRACT PASSING LOGS")
    print("=" * 60)

    # ── Supabase ──────────────────────────────────────────────────────────────
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("❌ Missing Supabase credentials. Set SUPABASE_URL / SUPABASE_KEY.")
        sys.exit(1)
    supabase: Client = create_client(url, key)

    # ── Fetch passing logs ────────────────────────────────────────────────────
    print("\n📥 Fetching logs where is_correct = True ...")
    response = supabase.table("ai_logs").select("*").eq("is_correct", True).execute()
    logs = response.data

    if not logs:
        print("⚠️  No passing logs found in Supabase. Run score_logs.py first!")
        return 0

    print(f"✅ Found {len(logs)} passing logs.")

    # ── Write ChatML JSONL ────────────────────────────────────────────────────
    print(f"\n💾 Writing dataset to: {OUTPUT_FILE}")
    written = 0
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for log in logs:
            user_input = log.get("user_input", "")
            ai_output  = log.get("ai_output",  "")

            if not user_input or not ai_output:
                continue

            record = format_chatml(user_input, ai_output)
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
            written += 1

    print(f"\n{'='*60}")
    print(f"🎉 auto_training_data.jsonl created with {written} examples!")
    print(f"{'='*60}")
    print("You can now re-run train.py pointing to this new dataset.\n")
    return written


if __name__ == "__main__":
    main()
