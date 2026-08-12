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
You are an expert training data generator for a video editing AI called Hornet.
Generate exactly {batch_size} unique and highly diverse examples.

Each example is a user request sent to Hornet along with video metadata context, and Hornet's exact response in a flat text DSL.

━━━ INPUT FORMAT ━━━
The user_input always follows this structure:

[VIDEO METADATA]
Name: <filename>
Duration: <seconds>s
Resolution: <WxH>
Playhead: <seconds>s

[TIMELINE STATE]
Cuts:
- <existing cuts or None>

Muted Sections:
- <existing mutes or None>

Background Music:
- <existing music or None>

[USER REQUEST]
<the user's natural language request>

━━━ OUTPUT SCHEMA ━━━
Hornet returns a flat text response with exactly two lines (or more if multiple operations):
Line 1: A message starting with "SAY: " describing what was done.
Line 2+: Command lines starting with "CUT", "MUTE", or "ADD_AUDIO_OVERLAY".

Command format:
COMMAND variation [value/start] [end] [track]
- variation: first | last | range | before_playhead | after_playhead
- value/start/end: Echo the user's exact time string (e.g. "1:30", "90s", "10"). Add a unit like "s" if it's just a number and the user said seconds.
- track: only for ADD_AUDIO_OVERLAY (e.g. "music.mp3")

━━━ EXAMPLES ━━━
cut first N seconds → CUT first Ns
cut last N seconds  → CUT last Ns
cut from X to Y     → CUT range X Y
cut before playhead → CUT before_playhead
cut after playhead  → CUT after_playhead
same logic for MUTE; ADD_AUDIO_OVERLAY uses range with a track e.g. ADD_AUDIO_OVERLAY range X Y music.mp3
Full video overlay: ADD_AUDIO_OVERLAY full_video music.mp3

━━━ RULES ━━━
- user_input MUST include the full [VIDEO METADATA] and [TIMELINE STATE] block
- ai_output MUST be a literal string matching the DSL exactly (newlines as \\n).
- Make requests conversational and varied — simple and complex
- Include multi-operation examples (cut + mute, cut + add_audio_overlay)
- Vary video names, durations, resolutions, and existing timeline states

Return ONLY a JSON object with key "examples" containing a list of objects.
Each object has "user_input" (string) and "ai_output" (string).

Example:
{{
    "examples": [
        {{
            "user_input": "[VIDEO METADATA]\\nName: vlog.mp4\\nDuration: 240.0s\\nResolution: 1920x1080\\nPlayhead: 0.0s\\n\\n[TIMELINE STATE]\\nCuts:\\n- None\\n\\nMuted Sections:\\n- None\\n\\nBackground Music:\\n- None\\n\\n[USER REQUEST]\\ncut the first 8 seconds",
            "ai_output": "SAY: Removed the first 8 seconds of the video.\\nCUT first 8s"
        }},
        {{
            "user_input": "[VIDEO METADATA]\\nName: game.mp4\\nDuration: 600.0s\\nResolution: 1920x1080\\nPlayhead: 0.0s\\n\\n[TIMELINE STATE]\\nCuts:\\n- None\\n\\nMuted Sections:\\n- None\\n\\nBackground Music:\\n- None\\n\\n[USER REQUEST]\\nmute from 1:00 to 2:00",
            "ai_output": "SAY: Muted the audio from 1:00 to 2:00.\\nMUTE range 1:00 2:00"
        }},
        {{
            "user_input": "[VIDEO METADATA]\\nName: travel.mp4\\nDuration: 180.0s\\nResolution: 1920x1080\\nPlayhead: 0.0s\\n\\n[TIMELINE STATE]\\nCuts:\\n- None\\n\\nMuted Sections:\\n- None\\n\\nBackground Music:\\n- None\\n\\n[USER REQUEST]\\nadd lofi.mp3 to the entire video",
            "ai_output": "SAY: Added lofi.mp3 across the full video.\\nADD_AUDIO_OVERLAY full_video lofi.mp3"
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

        if not isinstance(ai_output, str):
            ai_output = str(ai_output)

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
    print(f"🎉 Requested {batch_size} examples. Inserted {success_count} synthetic logs into Supabase 'ai_logs'!")
    print(f"{'='*60}\n")
    return success_count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic training data via NVIDIA GLM API")
    parser.add_argument("--batch", type=int, default=DEFAULT_BATCH_SIZE, help="Number of examples to generate")
    args = parser.parse_args()
    main(batch_size=args.batch)
