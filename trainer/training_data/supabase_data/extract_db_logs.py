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

# ─── Env: Colab Secrets → dotenv fallback ────────────────────────────────────
try:
    from google.colab import userdata
    os.environ["NEXT_PUBLIC_SUPABASE_URL"]      = userdata.get("SUPABASE_URL")
    os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = userdata.get("SUPABASE_KEY")
    print("🔑 Loaded credentials from Colab Secrets.")
except ImportError:
    from dotenv import load_dotenv
    _env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.env.local"))
    load_dotenv(_env_path)
    print(f"🔑 Loaded credentials from: {_env_path}")

from supabase import create_client, Client

# ─── System instruction (must match train.py / run_and_store.py exactly) ─────
SYSTEM_INSTRUCTION = (
    "You are Hornet, a video editing AI. Return JSON with 'message' and 'operations' (cut, mute, add_audio_overlay). "
    "If the user mentions time expressions requiring calculation, output a <tool_call> block first. "
    "Otherwise, output the final JSON directly."
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
