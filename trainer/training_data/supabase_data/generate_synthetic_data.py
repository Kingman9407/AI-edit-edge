"""
generate_synthetic_data.py
──────────────────────────
Uses the NVIDIA API (z-ai/glm-5.2 via integrate.api.nvidia.com) to generate
synthetic training examples and push them directly into Supabase ai_logs as
pre-scored, passing rows.

Rate limit: 20 requests per minute (free tier).

Colab Secrets required:
  - SUPABASE_URL
  - SUPABASE_KEY
  - NVIDIA_API_KEY

Usage:
    python generate_synthetic_data.py
    python generate_synthetic_data.py --batch 20   # generate 20 examples
"""

import os
import sys
import json
import argparse

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

from openai import OpenAI
from supabase import create_client, Client

# ─── Config ───────────────────────────────────────────────────────────────────
DEFAULT_BATCH_SIZE = 10
NVIDIA_MODEL       = "z-ai/glm-5.2"
NVIDIA_BASE_URL    = "https://integrate.api.nvidia.com/v1"


def get_nvidia_completion(prompt: str, api_key: str) -> str:
    """Calls the NVIDIA API (GLM-5.2) and returns the raw response text."""
    client = OpenAI(
        base_url=NVIDIA_BASE_URL,
        api_key=api_key,
    )
    completion = client.chat.completions.create(
        model=NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=1,
        top_p=1,
        max_tokens=16384,
        seed=42,
        stream=False,
    )
    return completion.choices[0].message.content


def build_prompt(batch_size: int) -> str:
    return f"""
You are an expert training data generator for a video editing AI.
Generate exactly {batch_size} unique and highly diverse user requests and the exact expected JSON output the AI should return.

The AI's rules:
- It returns JSON with 'message' (string) and 'operations' (array of objects).
- Valid operations:
  - cut: requires start (number) and end (number)
  - mute: requires start (number) and end (number)
  - add_audio_overlay: requires url (string), start (number)

IMPORTANT: Make the user requests conversational and varied. Some should be simple ("cut the first 5 seconds"), some complex ("mute between 10s and 20s and cut the end from 30s to 40s").

Return strictly as a JSON object with a single key 'examples' containing a list of objects.
Each object must have:
- "user_input": The text the user typed
- "ai_output": The exact JSON object the AI should return (as a string)

Example:
{{
    "examples": [
        {{
            "user_input": "cut the video from 0s to 5s",
            "ai_output": "{{\"message\": \"Cutting the first 5 seconds.\", \"operations\": [{{\"action\": \"cut\", \"start\": 0, \"end\": 5}}]}}"
        }}
    ]
}}
"""


def main(batch_size: int = DEFAULT_BATCH_SIZE) -> int:
    """
    Main generator. Returns the number of rows inserted into Supabase.
    """
    print("=" * 60)
    print("    HORNET AI — SYNTHETIC DATA GENERATOR (NVIDIA GLM)")
    print("=" * 60)

    # ── Credentials ───────────────────────────────────────────────────────────
    sb_url    = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    sb_key    = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    nvidia_key = os.environ.get("NVIDIA_API_KEY")

    if not sb_url or not sb_key:
        print("❌ Missing Supabase credentials. Set SUPABASE_URL / SUPABASE_KEY.")
        sys.exit(1)
    if not nvidia_key:
        print("❌ Missing NVIDIA_API_KEY. Add it to Colab Secrets or .env.local.")
        sys.exit(1)

    supabase: Client = create_client(sb_url, sb_key)

    # ── Generate ──────────────────────────────────────────────────────────────
    print(f"\n🧠 Asking NVIDIA GLM ({NVIDIA_MODEL}) to generate {batch_size} examples...")
    result_text = None
    try:
        result_text = get_nvidia_completion(build_prompt(batch_size), nvidia_key)
        # GLM may wrap the JSON in markdown — strip code fences if present
        cleaned = result_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        data     = json.loads(cleaned.strip())
        examples = data.get("examples", [])
    except Exception as e:
        raw = result_text if result_text else "None"
        print(f"❌ Failed to parse or generate data: {e}\nRaw Output:\n{raw}")
        return 0

    print(f"✅ Generated {len(examples)} examples. Pushing to Supabase...")

    # ── Insert into Supabase ──────────────────────────────────────────────────
    success_count = 0
    for ex in examples:
        user_input = ex.get("user_input")
        ai_output  = ex.get("ai_output")

        if not user_input or not ai_output:
            continue

        # GLM sometimes returns ai_output as a dict instead of a string
        if isinstance(ai_output, dict):
            ai_output = json.dumps(ai_output)

        try:
            supabase.table("ai_logs").insert({
                "user_input":      user_input,
                "ai_output":       ai_output,
                "expected_output": ai_output,
                "score":           100.0,
                "is_correct":      True,
                "model_name":      f"synthetic-{NVIDIA_MODEL}",
            }).execute()
            success_count += 1
        except Exception as e:
            print(f"  [Error inserting row]: {e}")

    print(f"\n{'='*60}")
    print(f"🎉 Inserted {success_count} synthetic logs into Supabase 'ai_logs'!")
    print(f"{'='*60}\n")
    return success_count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic training data via NVIDIA GLM API")
    parser.add_argument("--batch", type=int, default=DEFAULT_BATCH_SIZE, help="Number of examples to generate")
    args = parser.parse_args()
    main(batch_size=args.batch)
