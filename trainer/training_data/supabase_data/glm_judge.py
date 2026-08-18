"""
glm_judge.py
────────────
Handles all communication with the NVIDIA GLM API for the Hornet AI pipeline.

Responsibilities:
  1. ask_glm      — Query GLM with a user_input to get the expected DSL answer
  2. test_glm_api — Validate that the API key and endpoint are reachable

This module is intentionally decoupled from validation and Supabase storage.
Import it from run_and_store.py or pipeline.py.
"""

import time

# ─── NVIDIA / GLM Config ─────────────────────────────────────────────────────
NVIDIA_MODEL    = "z-ai/glm-5.2"
NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"

# ─── System instruction sent to GLM as judge ─────────────────────────────────
# This must produce the same DSL output format the Hornet model is trained on,
# so that compare_outputs in validator.py can meaningfully compare them.
GLM_JUDGE_SYSTEM = (
    "You are Hornet, a video editing AI. "
    "Given a user video editing request with metadata and timeline state, "
    "return exactly a two-line flat text response (or more if multiple operations):\n"
    "Line 1: A message starting with 'SAY: ' describing what was done.\n"
    "Line 2+: Command lines starting with 'CUT', 'MUTE', or 'ADD_AUDIO_OVERLAY'.\n\n"
    "Command format:\n"
    "COMMAND variation [value/start] [end] [track]\n"
    "- variation: first | last | range | before_playhead | after_playhead | full_video\n"
    "- value/start/end: Echo the user's exact time string (e.g. '1:30', '90s', '10'). "
    "Add 's' if it's just a plain number and the user said seconds.\n"
    "- track: only for ADD_AUDIO_OVERLAY (e.g. 'music.mp3')\n\n"
    "Example:\n"
    "[USER REQUEST]\n"
    "cut the first 8 seconds\n"
    "-->\n"
    "SAY: Removed the first 8 seconds of the video.\n"
    "CUT first 8s\n\n"
    "Return ONLY the raw text. No markdown, no code fences, no JSON, no explanation."
)


# ─── API Health Check ────────────────────────────────────────────────────────

def test_glm_api(api_key: str) -> bool:
    """
    Sends a tiny request to the NVIDIA GLM API to verify it is reachable
    and the key is valid. Returns True on success, False on failure.

    Args:
        api_key: NVIDIA API key string

    Returns:
        True if the API responds correctly, False otherwise.
    """
    try:
        from openai import OpenAI
        client = OpenAI(base_url=NVIDIA_BASE_URL, api_key=api_key, timeout=20.0)
        resp = client.chat.completions.create(
            model=NVIDIA_MODEL,
            messages=[{"role": "user", "content": "Reply with the word OK only."}],
            max_tokens=5,
            temperature=0,
            stream=False,
        )
        reply = resp.choices[0].message.content.strip()
        print(f"  ✅ GLM API OK — response: {reply!r}")
        return True
    except Exception as e:
        print(f"  ❌ GLM API FAILED: {e}")
        return False


# ─── GLM Question Asker ───────────────────────────────────────────────────────

def ask_glm(user_input: str, api_key: str, retries: int = 3) -> str:
    """
    Queries GLM with the same user_input that Hornet received and asks it
    to produce the correct expected DSL output. This is the reference answer
    that the validator will compare Hornet's output against.

    Args:
        user_input: The full prompt (video context + user request)
        api_key:    NVIDIA API key
        retries:    Number of retry attempts on failure (default: 3)

    Returns:
        The cleaned DSL string from GLM, or "" if all attempts fail.
    """
    from openai import OpenAI
    client = OpenAI(base_url=NVIDIA_BASE_URL, api_key=api_key, timeout=30.0)

    last_error = None
    for attempt in range(1, retries + 1):
        try:
            completion = client.chat.completions.create(
                model=NVIDIA_MODEL,
                messages=[
                    {"role": "system", "content": GLM_JUDGE_SYSTEM},
                    {"role": "user",   "content": user_input},
                ],
                temperature=0.2,   # Low temperature = deterministic reference answer
                top_p=1,
                max_tokens=128,    # DSL output is very short — cap tokens
                stream=False,
            )
            raw = completion.choices[0].message.content.strip()

            # Strip markdown code fences if GLM wraps its output anyway
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()
                if raw.endswith("```"):
                    raw = raw[:-3].strip()

            return raw

        except Exception as e:
            last_error = e
            wait = attempt * 5
            print(f"    ⚠️  GLM attempt {attempt}/{retries} failed: {e}. Retrying in {wait}s...")
            time.sleep(wait)

    print(f"    ❌ GLM gave up after {retries} attempts: {last_error}")
    return ""


# ─── Self-test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import os

    api_key = os.environ.get("NVIDIA_API_KEY")
    if not api_key:
        print("❌ NVIDIA_API_KEY not set. Export it first.")
    else:
        print("── GLM Judge Self-Test ──\n")
        print("1. API health check:")
        ok = test_glm_api(api_key)

        if ok:
            print("\n2. Asking GLM to judge a sample input:")
            sample = (
                "[VIDEO METADATA]\n"
                "Name: sample.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n"
                "[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\n"
                "Background Music:\n- None\n\n"
                "[USER REQUEST]\ncut the first 10 seconds"
            )
            expected = ask_glm(sample, api_key)
            print(f"   GLM expected output:\n{expected}")
