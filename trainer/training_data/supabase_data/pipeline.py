"""
pipeline.py
───────────
Single-entry-point orchestrator for the Hornet AI post-training pipeline.
Run this in one Colab cell after training is complete.

Each batch runs its full cycle inline:
  run → GLM judge → extract (PASS rows → auto_training_data.jsonl)

Usage:
    python pipeline.py                        # run all batches
    python pipeline.py --batches 1 3 5        # run only batches 1, 3 and 5
    python pipeline.py --list                 # list available batches and exit
    python pipeline.py --interactive          # pick batches interactively

Colab one-liner:
    !python trainer/training_data/supabase_data/pipeline.py
"""

import argparse
import sys
import os

# Ensure sibling imports resolve correctly
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


# ─── GLM API Health Check ─────────────────────────────────────────────────────
def test_glm_api(api_key: str, base_url: str, model: str) -> bool:
    """
    Sends a tiny request to the NVIDIA GLM API to verify it is reachable
    and the key is valid. Returns True on success, False on failure.
    """
    try:
        from openai import OpenAI
        client = OpenAI(base_url=base_url, api_key=api_key, timeout=20.0)
        resp = client.chat.completions.create(
            model=model,
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


def main():
    parser = argparse.ArgumentParser(
        description="Hornet AI post-training pipeline orchestrator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python pipeline.py                  # run all batches
  python pipeline.py --batches 1 3    # run batches 1 and 3 only
  python pipeline.py --list           # list all available batches
  python pipeline.py --interactive    # interactive batch picker
        """,
    )
    parser.add_argument(
        "--batches", nargs="*", type=int, metavar="N",
        help=(
            "Batch numbers to run (e.g. --batches 1 3 5). "
            "Omit to run all batches."
        ),
    )
    parser.add_argument(
        "--list", action="store_true",
        help="List all available batches and exit.",
    )
    parser.add_argument(
        "--interactive", action="store_true",
        help="Show an interactive menu to pick which batches to run.",
    )
    parser.add_argument(
        "--skip-api-check", action="store_true",
        help="Skip the GLM API health check (useful for --list mode).",
    )
    args = parser.parse_args()

    import run_and_store

    # ── GLM API check (skip if just listing) ──────────────────────────────────
    if not args.list and not args.skip_api_check:
        nv_key = os.environ.get("NVIDIA_API_KEY")
        print("\n🔍 Testing NVIDIA GLM API before starting pipeline...")
        if not nv_key:
            print("  ❌ NVIDIA_API_KEY not set in environment. Aborting.")
            sys.exit(1)
        if not test_glm_api(nv_key, run_and_store.NVIDIA_BASE_URL, run_and_store.NVIDIA_MODEL):
            print("\n  Pipeline aborted — fix the GLM API connection first.")
            sys.exit(1)
        print()

    run_and_store.main(
        set_ids=args.batches,
        interactive=args.interactive,
        list_only=args.list,
    )


if __name__ == "__main__":
    main()
