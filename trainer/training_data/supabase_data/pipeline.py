"""
pipeline.py
───────────
Single-entry-point orchestrator for the Hornet AI post-training pipeline.
Run this in one Colab cell after training is complete.

Steps:
  run     → run_and_store.py  : run fine-tuned model on test inputs → Supabase
  score   → score_logs.py     : grade responses via BERT embeddings → Supabase
  extract → extract_db_logs.py: export passing rows → auto_training_data.jsonl

Usage:
    python pipeline.py                     # run all 3 steps in order
    python pipeline.py --steps run score   # run only specific steps
    python pipeline.py --steps score --rescore-all  # re-grade all rows

Colab one-liner:
    !python trainer/training_data/supabase_data/pipeline.py
"""

import argparse
import sys
import time

STEPS = ["run", "score", "extract"]


def step_run():
    print("\n" + "━" * 60)
    print("  STEP 1 — RUN MODEL & STORE OUTPUTS")
    print("━" * 60)
    import run_and_store
    run_and_store.main()


def step_score(rescore_all: bool = False):
    print("\n" + "━" * 60)
    print("  STEP 2 — SCORE LOGS (BERT Cosine Similarity)")
    print("━" * 60)
    import score_logs
    return score_logs.main(rescore_all=rescore_all)


def step_extract():
    print("\n" + "━" * 60)
    print("  STEP 3 — EXTRACT PASSING LOGS → auto_training_data.jsonl")
    print("━" * 60)
    import extract_db_logs
    return extract_db_logs.main()


def main():
    parser = argparse.ArgumentParser(
        description="Hornet AI post-training pipeline orchestrator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Steps:
  run     – Run fine-tuned model on test inputs and store outputs in Supabase
  score   – Score all ungraded Supabase rows using BERT cosine similarity
  extract – Export passing rows (is_correct=True) to auto_training_data.jsonl
        """
    )
    parser.add_argument(
        "--steps", nargs="*", choices=STEPS, default=STEPS,
        help="Which steps to run (default: all). Options: run score extract"
    )
    parser.add_argument(
        "--rescore-all", action="store_true",
        help="When scoring, re-grade ALL rows (not just unscored ones)"
    )
    args = parser.parse_args()

    selected = args.steps or STEPS

    print("=" * 60)
    print("   🐝 HORNET AI — PIPELINE ORCHESTRATOR")
    print("=" * 60)
    print(f"   Steps to run: {' → '.join(selected)}")
    print("=" * 60)

    total_start = time.time()
    summary = {}

    if "run" in selected:
        t = time.time()
        step_run()
        summary["run"] = f"{round(time.time() - t, 1)}s"

    if "score" in selected:
        t = time.time()
        scored = step_score(rescore_all=args.rescore_all)
        summary["score"] = f"{scored} rows scored in {round(time.time() - t, 1)}s"

    if "extract" in selected:
        t = time.time()
        written = step_extract()
        summary["extract"] = f"{written} examples written in {round(time.time() - t, 1)}s"

    # ── Final Summary ─────────────────────────────────────────────────────────
    total_time = round(time.time() - total_start, 1)
    print("\n" + "=" * 60)
    print("   🎉 PIPELINE COMPLETE")
    print("=" * 60)
    for step, result in summary.items():
        print(f"   {step.upper():<10} → {result}")
    print(f"\n   Total time: {total_time}s")
    print("=" * 60)

    if "extract" in selected:
        print("\n✅ auto_training_data.jsonl is ready.")
        print("   Next: update train.py to use this new dataset for the next training run.")


if __name__ == "__main__":
    # Ensure imports resolve relative to this script's directory
    import os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    main()
