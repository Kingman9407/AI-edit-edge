"""
glm_judge.py
────────────
Handles all communication with the NVIDIA API for the Hornet AI pipeline.
Currently uses: nvidia/nemotron-3-super-120b-a12b (with chain-of-thought reasoning)

Responsibilities:
  1. ask_judge     — Query Nemotron with a user_input to get the expected DSL answer
  2. test_judge_api — Validate that the API key and endpoint are reachable

This module is intentionally decoupled from validation and Supabase storage.
Import it from run_and_store.py or pipeline.py.
"""

import time
import os

# ─── NVIDIA / Nemotron Config ─────────────────────────────────────────────────
NVIDIA_MODEL    = "nvidia/nemotron-3-super-120b-a12b"
NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"

# ─── System instruction sent to Nemotron as judge ─────────────────────────────
# Must produce the same DSL output format Hornet is trained on so that
# compare_outputs() in validator.py can meaningfully compare them.
JUDGE_SYSTEM = (
    "You are Hornet, a video editing AI. "
    "Given a user video editing request with metadata and timeline state, "
    "return a flat text response:\n"
    "Line 1: SAY: <natural language confirmation of what was done>\n"
    "Line 2+: One DSL command per operation.\n\n"

    "DSL command format (UPPERCASE keywords, exact):\n"
    "  CUT FIRST <N> SEC|MIN\n"
    "  CUT LAST <N> SEC|MIN\n"
    "  CUT RANGE <start> <end>             (space-separated; echo the user's exact time strings)\n"
    "  CUT BEFORE_PLAYHEAD                  (cut everything before playhead — no args)\n"
    "  CUT BEFORE_PLAYHEAD <N> SEC|MIN      (cut only N sec/min immediately before playhead)\n"
    "  CUT AFTER_PLAYHEAD                   (cut everything after playhead — no args)\n"
    "  CUT AFTER_PLAYHEAD <N> SEC|MIN       (cut only N sec/min immediately after playhead)\n"
    "  MUTE FIRST <N> SEC|MIN\n"
    "  MUTE LAST <N> SEC|MIN\n"
    "  MUTE RANGE <start> <end>\n"
    "  MUTE BEFORE_PLAYHEAD\n"
    "  MUTE AFTER_PLAYHEAD\n"
    "  ADD_AUDIO_OVERLAY FIRST <N> SEC|MIN <track.mp3>\n"
    "  ADD_AUDIO_OVERLAY LAST <N> SEC|MIN <track.mp3>\n"
    "  ADD_AUDIO_OVERLAY RANGE <start> <end> <track.mp3>\n"
    "  ADD_AUDIO_OVERLAY FULL_VIDEO <track.mp3>\n\n"

    "Rules:\n"
    "- RANGE timestamps: echo exactly as the user gave them (e.g. '1:30', '100s', '2m')\n"
    "- FIRST/LAST durations: always use the '<N> SEC' or '<N> MIN' form (space before unit)\n"
    "- BEFORE_PLAYHEAD / AFTER_PLAYHEAD with NO arg = cut/mute EVERYTHING before/after\n"
    "- BEFORE_PLAYHEAD / AFTER_PLAYHEAD WITH arg = cut/mute only that window adjacent to playhead\n"
    "- No markdown, no code fences, no JSON, no explanation — raw DSL text only\n\n"

    "Examples:\n"
    "  cut the first 10 seconds → SAY: Removed the first 10 seconds.\\nCUT FIRST 10 SEC\n"
    "  cut from 1:00 to 2:30 → SAY: Removed from 1:00 to 2:30.\\nCUT RANGE 1:00 2:30\n"
    "  cut everything before the playhead → SAY: Removed everything before the playhead.\\nCUT BEFORE_PLAYHEAD\n"
    "  cut the 30 seconds before the playhead → SAY: Cut the 30 seconds before the playhead.\\nCUT BEFORE_PLAYHEAD 30 SEC\n"
    "  add lofi.mp3 to entire video → SAY: Added lofi.mp3 to the full video.\\nADD_AUDIO_OVERLAY FULL_VIDEO lofi.mp3\n"
)


# ─── API Health Check ────────────────────────────────────────────────────────

def test_glm_api(api_key: str) -> bool:
    """
    Sends a tiny request to the NVIDIA API to verify it is reachable
    and the key is valid. Returns True on success, False on failure.

    Args:
        api_key: NVIDIA API key string
    """
    try:
        from openai import OpenAI
        client = OpenAI(base_url=NVIDIA_BASE_URL, api_key=api_key, timeout=30.0)

        # Use streaming to match production usage
        content_parts = []
        stream = client.chat.completions.create(
            model=NVIDIA_MODEL,
            messages=[{"role": "user", "content": "Reply with the word OK only."}],
            max_tokens=16,
            temperature=1,
            top_p=0.95,
            extra_body={
                "chat_template_kwargs": {"enable_thinking": True},
                "reasoning_budget": 128,   # minimal budget for health check
            },
            stream=True,
        )
        for chunk in stream:
            if not chunk.choices:
                continue
            if chunk.choices[0].delta.content is not None:
                content_parts.append(chunk.choices[0].delta.content)

        reply = "".join(content_parts).strip()
        print(f"  ✅ Nemotron API OK — response: {reply!r}")
        return True
    except Exception as e:
        print(f"  ❌ Nemotron API FAILED: {e}")
        return False

# Keep the old name as an alias so pipeline.py doesn't break
test_judge_api = test_glm_api


# ─── Nemotron Judge — ask for expected DSL answer ─────────────────────────────

def ask_glm(user_input: str, api_key: str, retries: int = 3) -> str:
    """
    Queries Nemotron with the same user_input Hornet received and asks it
    to produce the correct expected DSL output. Uses chain-of-thought
    reasoning internally but only returns the final DSL answer.

    Args:
        user_input: The full prompt (video context + user request)
        api_key:    NVIDIA API key
        retries:    Number of retry attempts on failure (default: 3)

    Returns:
        The final DSL string (SAY: ... + command lines), or "" on failure.
    """
    from openai import OpenAI
    client = OpenAI(base_url=NVIDIA_BASE_URL, api_key=api_key, timeout=60.0)

    last_error = None
    for attempt in range(1, retries + 1):
        try:
            content_parts = []
            reasoning_shown = False

            stream = client.chat.completions.create(
                model=NVIDIA_MODEL,
                messages=[
                    {"role": "system", "content": JUDGE_SYSTEM},
                    {"role": "user",   "content": user_input},
                ],
                temperature=1,
                top_p=0.95,
                max_tokens=16384,
                extra_body={
                    "chat_template_kwargs": {"enable_thinking": True},
                    "reasoning_budget": 4096,  # give model room to think
                },
                stream=True,
            )

            for chunk in stream:
                if not chunk.choices:
                    continue

                # Collect reasoning (thinking) — printed for debugging only
                reasoning = getattr(chunk.choices[0].delta, "reasoning_content", None)
                if reasoning and not reasoning_shown:
                    print("    💭 [Nemotron thinking...]", end="", flush=True)
                    reasoning_shown = True

                # Collect the actual final output
                if chunk.choices[0].delta.content is not None:
                    content_parts.append(chunk.choices[0].delta.content)

            if reasoning_shown:
                print()  # newline after thinking indicator

            raw = "".join(content_parts).strip()

            # Strip markdown code fences if Nemotron wraps output anyway
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
            print(f"    ⚠️  Nemotron attempt {attempt}/{retries} failed: {e}. Retrying in {wait}s...")
            time.sleep(wait)

    print(f"    ❌ Nemotron gave up after {retries} attempts: {last_error}")
    return ""

# Keep old name as alias
ask_judge = ask_glm


# ─── Self-test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    api_key = os.environ.get("NVIDIA_API_KEY")
    if not api_key:
        print("❌ NVIDIA_API_KEY not set. Export it first:\n   export NVIDIA_API_KEY=nvapi-...")
    else:
        print(f"── Nemotron Judge Self-Test ({NVIDIA_MODEL}) ──\n")
        print("1. API health check:")
        ok = test_glm_api(api_key)

        if ok:
            print("\n2. Asking Nemotron to judge a sample input:")
            sample = (
                "[VIDEO METADATA]\n"
                "Name: sample.mp4\nDuration: 300.0s\nResolution: 1920x1080\nPlayhead: 0.0s\n\n"
                "[TIMELINE STATE]\nCuts:\n- None\n\nMuted Sections:\n- None\n\n"
                "Background Music:\n- None\n\n"
                "[USER REQUEST]\ncut the first 10 seconds"
            )
            expected = ask_glm(sample, api_key)
            print(f"\n   Expected DSL output:\n   {expected}")
