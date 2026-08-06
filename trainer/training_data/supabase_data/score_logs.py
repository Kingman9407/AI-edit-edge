"""
score_logs.py — DEPRECATED
──────────────────────────
This file has been superseded by the inline GLM-as-Judge scoring now built
into run_and_store.py.

Scoring now happens in real-time after each input:
  • GLM judges Hornet's output against the user request (PASS / FAIL)
  • is_correct + score (judge reason) are written to Supabase immediately
  • Passing rows are appended to auto_training_data.jsonl inline

To re-run the pipeline, use:
    python pipeline.py                   # all batches
    python pipeline.py --batches 1 3 5   # selected batches
    python pipeline.py --interactive     # interactive picker

To re-extract all passing rows from Supabase manually:
    python extract_db_logs.py
"""

raise SystemExit(
    "\n❌  score_logs.py is deprecated.\n"
    "   Scoring is now handled inline by run_and_store.py via GLM-as-Judge.\n"
    "   Run:  python pipeline.py\n"
)
