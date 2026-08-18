"""
validator.py
────────────
All DSL output validation logic for the Hornet AI pipeline.

Responsibilities:
  1. compare_outputs  — Semantically validate Hornet's DSL vs GLM's expected DSL
  2. store_result     — Persist a scored row into Supabase ai_logs
  3. append_to_jsonl  — Append a PASS row to auto_training_data.jsonl as ChatML

This module has NO dependency on the GLM judge or Hornet model.
Import it from run_and_store.py or pipeline.py.
"""

import os
import sys
import json

# ─── Output JSONL path ───────────────────────────────────────────────────────
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "auto_training_data.jsonl")

# ─── ChatML system prompt (must match train.py SFT system instruction) ────────
CHATML_SYSTEM = (
    "You are Hornet, a video editing AI. Return a flat text response with a 'SAY: ' message "
    "and command lines (CUT, MUTE, ADD_AUDIO_OVERLAY). "
    "If the user mentions time expressions requiring calculation, output a <tool_call> block first. "
    "Otherwise, output the final DSL response directly.\n\n"
    "Example:\n"
    "[USER REQUEST]\n"
    "cut the first 8 seconds\n"
    "-->\n"
    "SAY: Removed the first 8 seconds of the video.\n"
    "CUT first 8s"
)


# ─── Semantic DSL Validator ───────────────────────────────────────────────────

def compare_outputs(ai_output: str, expected_output: str) -> tuple:
    """
    Semantically validates Hornet's DSL output against GLM's expected output.

    Uses parse_dsl_response from resolver.py to extract structured operations
    from both outputs and compares them field-by-field.

    Returns:
        (is_correct: bool, reason: str)
          - is_correct: True if operations match exactly
          - reason: human-readable explanation of the verdict
    """
    # Add resolver to path
    resolver_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    if resolver_dir not in sys.path:
        sys.path.insert(0, resolver_dir)

    try:
        from resolver import parse_dsl_response

        ai_parsed       = parse_dsl_response(ai_output)
        expected_parsed = parse_dsl_response(expected_output)

        ai_ops       = ai_parsed.get("operations", [])
        expected_ops = expected_parsed.get("operations", [])

        # ── No DSL commands in either output ──────────────────────────────────
        if not ai_ops and not expected_ops:
            match = ai_output.strip() == expected_output.strip()
            reason = "Raw text match" if match else "Raw text mismatch (no DSL commands found in either output)"
            return match, reason

        # ── Operation count mismatch ──────────────────────────────────────────
        if len(ai_ops) != len(expected_ops):
            reason = (
                f"Operation count mismatch: "
                f"Hornet produced {len(ai_ops)} op(s), expected {len(expected_ops)}."
            )
            return False, reason

        # ── Field-level comparison for each operation ─────────────────────────
        for idx, (ai_op, exp_op) in enumerate(zip(ai_ops, expected_ops), start=1):
            COMPARE_KEYS = ["operation", "variation"]

            for key in COMPARE_KEYS:
                if ai_op.get(key) != exp_op.get(key):
                    reason = (
                        f"Op {idx} field '{key}' mismatch: "
                        f"got {ai_op.get(key)!r}, expected {exp_op.get(key)!r}"
                    )
                    return False, reason

            var = exp_op.get("variation")

            if var == "range":
                # Compare start/end raw strings (resolver echoes user's exact text)
                for field in ("start", "end"):
                    if ai_op.get(field) != exp_op.get(field):
                        reason = (
                            f"Op {idx} range field '{field}' mismatch: "
                            f"got {ai_op.get(field)!r}, expected {exp_op.get(field)!r}"
                        )
                        return False, reason
            elif var in ("first", "last", "before_playhead", "after_playhead"):
                # Compare numeric value and unit
                if ai_op.get("value") != exp_op.get("value"):
                    reason = (
                        f"Op {idx} duration value mismatch: "
                        f"got {ai_op.get('value')}, expected {exp_op.get('value')}"
                    )
                    return False, reason
                if ai_op.get("unit") != exp_op.get("unit"):
                    reason = (
                        f"Op {idx} duration unit mismatch: "
                        f"got {ai_op.get('unit')!r}, expected {exp_op.get('unit')!r}"
                    )
                    return False, reason

            # Track comparison for ADD_AUDIO_OVERLAY
            if exp_op.get("operation") == "add_audio_overlay":
                if ai_op.get("track") != exp_op.get("track"):
                    reason = (
                        f"Op {idx} audio track mismatch: "
                        f"got {ai_op.get('track')!r}, expected {exp_op.get('track')!r}"
                    )
                    return False, reason

        return True, f"All {len(expected_ops)} operation(s) match exactly."

    except Exception as e:
        # Fallback: raw text equality
        match = ai_output.strip() == expected_output.strip()
        reason = f"Parse error ({e}); fallback to raw text {'match' if match else 'mismatch'}."
        return match, reason


# ─── Supabase store ───────────────────────────────────────────────────────────

def store_result(
    supabase,
    user_input,
    ai_output,
    expected_output,
    is_correct,
    reason,
    input_id,
    model_name_tag,
):
    """
    Inserts a fully-scored row into the Supabase ai_logs table.

    Args:
        supabase:        Supabase client instance
        user_input:      The original user prompt (with video context)
        ai_output:       Raw text Hornet produced
        expected_output: Raw text GLM produced as reference
        is_correct:      Whether the validation passed
        reason:          Human-readable validation verdict from compare_outputs
        input_id:        Test input identifier (e.g. "1-3")
        model_name_tag:  Model variant being evaluated

    Returns:
        True on successful insert, False on error.
    """
    try:
        supabase.table("ai_logs").insert({
            "user_input":      user_input,
            "ai_output":       ai_output,
            "expected_output": expected_output,
            "score":           100 if is_correct else 0,
            "is_correct":      is_correct,
            "model_name":      model_name_tag,
            "notes":           reason,
        }).execute()
        return True
    except Exception as e:
        print(f"  ⚠️  [Supabase Error for {input_id}]: {e}")
        return False


# ─── JSONL append ─────────────────────────────────────────────────────────────

def append_to_jsonl(user_input, ai_output):
    """
    Formats a PASS row as ChatML and appends it to auto_training_data.jsonl.

    Called only for rows where is_correct=True so that only verified
    high-quality examples feed back into the training loop.
    """
    text  = f"<|im_start|>system\n{CHATML_SYSTEM}<|im_end|>\n"
    text += f"<|im_start|>user\n{user_input}<|im_end|>\n"
    text += f"<|im_start|>assistant\n{ai_output}<|im_end|>\n"
    record = {"text": text}
    with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


# ─── Self-test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("── Validator Self-Test ──")

    cases = [
        # (label, ai_output, expected_output, should_pass)
        (
            "PASS: exact match",
            "SAY: Done.\nCUT FIRST 10 SEC",
            "SAY: Removed first 10 seconds.\nCUT first 10s",
            True,
        ),
        (
            "FAIL: wrong value",
            "SAY: Done.\nCUT FIRST 5 SEC",
            "SAY: Removed first 10 seconds.\nCUT first 10s",
            False,
        ),
        (
            "PASS: range match",
            "SAY: Muted.\nMUTE RANGE 1:00 1:30",
            "SAY: Muted audio.\nMUTE range 1:00 1:30",
            True,
        ),
        (
            "FAIL: operation mismatch",
            "SAY: Done.\nCUT RANGE 1:00 2:00",
            "SAY: Muted.\nMUTE RANGE 1:00 2:00",
            False,
        ),
        (
            "PASS: full_video overlay",
            "SAY: Added music.\nADD_AUDIO_OVERLAY FULL_VIDEO lofi.mp3",
            "SAY: Added track.\nADD_AUDIO_OVERLAY full_video lofi.mp3",
            True,
        ),
    ]

    all_ok = True
    for label, ai, exp, expected_pass in cases:
        ok, reason = compare_outputs(ai, exp)
        icon = "✅" if ok == expected_pass else "❌ UNEXPECTED"
        if ok != expected_pass:
            all_ok = False
        print(f"  {icon}  {label}")
        print(f"       -> {reason}")

    print()
    print("All tests passed ✅" if all_ok else "Some tests FAILED ❌")
