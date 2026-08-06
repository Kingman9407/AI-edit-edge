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
    args = parser.parse_args()

    import run_and_store
    run_and_store.main(
        set_ids=args.batches,
        interactive=args.interactive,
        list_only=args.list,
    )


if __name__ == "__main__":
    main()
