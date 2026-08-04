"""
score_logs.py
─────────────
Fetches unscored rows from Supabase ai_logs, scores them using the
BAAI/bge-small-en-v1.5 BERT embedding model (cosine similarity between
user_input and ai_output), then writes score + is_correct back to Supabase.

Usage:
    python score_logs.py          # score all ungraded rows
    python score_logs.py --all    # re-score everything (even already scored rows)
"""

import os
import sys

# ─── Cache dirs → local .cache so the BGE model stays in workspace ───────────
cache_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".cache"))
os.makedirs(cache_dir, exist_ok=True)
os.environ["HF_HOME"]               = cache_dir
os.environ["HUGGINGFACE_HUB_CACHE"] = cache_dir
os.environ["TRANSFORMERS_CACHE"]    = cache_dir
os.environ["TORCH_HOME"]            = cache_dir
os.environ["HF_DATASETS_CACHE"]     = cache_dir

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

import json
import argparse
import numpy as np
from supabase import create_client, Client
from sentence_transformers import SentenceTransformer

# ─── Config ───────────────────────────────────────────────────────────────────
PASS_THRESHOLD = 55.0   # minimum score % to mark is_correct = True
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"


def calculate_similarity(model: SentenceTransformer, text1: str, text2: str) -> float:
    """Returns cosine similarity (0–1) between two texts using the embedding model."""
    if not text1 or not text2:
        return 0.0
    embeddings = model.encode([text1, text2])
    vec1, vec2 = embeddings[0], embeddings[1]
    similarity = np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))
    return float(similarity)


def main(rescore_all: bool = False) -> int:
    """
    Main scorer. Returns the number of rows successfully updated.
    """
    print("=" * 60)
    print("          HORNET AI — SCORE LOGS")
    print("=" * 60)

    # ── Supabase ──────────────────────────────────────────────────────────────
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("❌ Missing Supabase credentials. Set SUPABASE_URL / SUPABASE_KEY.")
        sys.exit(1)
    supabase: Client = create_client(url, key)

    # ── Embedding model ───────────────────────────────────────────────────────
    print(f"\n📦 Loading embedding model: {EMBEDDING_MODEL} ...")
    model = SentenceTransformer(EMBEDDING_MODEL)
    print("✅ Model loaded!")

    # ── Fetch logs ────────────────────────────────────────────────────────────
    if rescore_all:
        print("\n📥 Fetching ALL logs (--all flag set)...")
        response = supabase.table("ai_logs").select("*").execute()
    else:
        print("\n📥 Fetching unscored logs (score IS NULL)...")
        response = supabase.table("ai_logs").select("*").is_("score", "null").execute()

    logs = response.data
    if not logs:
        print("⚠️  No logs to score. Exiting.")
        return 0

    print(f"✅ Found {len(logs)} logs to score.\n")

    # ── Score & update ────────────────────────────────────────────────────────
    updated_count = 0
    skipped_count = 0

    for log in logs:
        log_id     = log["id"]
        user_input = log.get("user_input", "")
        ai_output  = log.get("ai_output",  "")

        if not user_input or not ai_output:
            print(f"  ⚠️  Skipping log {log_id}: missing user_input or ai_output.")
            skipped_count += 1
            continue

        similarity      = calculate_similarity(model, ai_output, user_input)
        score_pct       = round(similarity * 100, 2)
        is_correct      = score_pct >= PASS_THRESHOLD

        status_icon = "✅" if is_correct else "❌"
        print(f"  {status_icon} [{log_id}] Score: {score_pct}%  |  is_correct: {is_correct}")

        supabase.table("ai_logs").update({
            "score":      score_pct,
            "is_correct": is_correct,
        }).eq("id", log_id).execute()
        updated_count += 1

    print(f"\n{'='*60}")
    print(f"✅ Scored: {updated_count}  |  ⚠️  Skipped: {skipped_count}")
    print(f"{'='*60}")
    print("Next step: run extract_db_logs.py to build your new training dataset!\n")
    return updated_count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Score Hornet AI logs in Supabase")
    parser.add_argument("--all", action="store_true", help="Re-score ALL rows, not just unscored ones")
    args = parser.parse_args()
    main(rescore_all=args.all)
