"""
validator.py
────────────
All DSL output validation logic for the Hornet AI pipeline.

Responsibilities:
  1. validate_format  — Strict canonical-format check (uppercase, N SEC, no garbage/repetition)
  2. compare_outputs  — Semantic field-level match via parse_dsl_response
  3. store_result     — Persist both semantic + format scores into Supabase ai_logs
  4. append_to_jsonl  — Append a PASS row to auto_training_data.jsonl as ChatML

This module has NO dependency on the GLM judge or Hornet model.
Import it from run_and_store.py or pipeline.py.
"""

import os
import re
import sys
import json

# ─── Output JSONL path ───────────────────────────────────────────────────────
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "auto_training_data.jsonl")

# ─── ChatML system prompt (must match train.py SFT system instruction) ────────
CHATML_SYSTEM = (
    "You are Hornet, a video editing AI.\n\n"
    "Output format — exactly two parts, nothing else:\n"
    "SAY: <one sentence confirming what was done>\n"
    "<COMMAND> <VARIATION> [<N> SEC|MIN] [<start> <end>] [<track>]\n\n"
    "Commands: CUT | MUTE | ADD_AUDIO_OVERLAY\n"
    "Variations: FIRST | LAST | RANGE | BEFORE_PLAYHEAD | AFTER_PLAYHEAD | FULL_VIDEO\n\n"
    "Examples:\n"
    "SAY: Removed the first 10 seconds.\n"
    "CUT FIRST 10 SEC\n\n"
    "SAY: Cut from 1:00 to 2:30.\n"
    "CUT RANGE 1:00 2:30\n\n"
    "SAY: Removed everything before the playhead.\n"
    "CUT BEFORE_PLAYHEAD"
)

# ─── Canonical grammar constants ──────────────────────────────────────────────
_KNOWN_CMDS = {"CUT", "MUTE", "ADD_AUDIO_OVERLAY"}
_KNOWN_VARS = {"FIRST", "LAST", "RANGE", "BEFORE_PLAYHEAD", "AFTER_PLAYHEAD", "FULL_VIDEO"}
_UNIT_RE    = re.compile(r'^\d+(\.\d+)?\s+(SEC|MIN)$')
_AUDIO_EXT  = re.compile(r'\.(mp3|wav|ogg|aac|m4a|flac)$', re.IGNORECASE)

# Phrases that indicate the model echoed its own instructions
_SCAFFOLD_MARKERS = [
    "return only", "no markdown", "no code fences", "no json",
    "no explanation", "raw text", "[user request]", "[video metadata]",
    "[timeline state]", "muted sections:", "background music:",
]


# ─── 1. Strict Format Validator ───────────────────────────────────────────────

def validate_format(ai_output: str) -> tuple:
    """
    Strict canonical-format check against the Hornet DSL grammar.

    Catches what the semantic scorer misses:
      - Lowercase commands/variations  (CUT first 10s  → FAIL)
      - Short unit suffix              (10s, 2m         → FAIL; want 10 SEC, 2 MIN)
      - Repeated SAY/command blocks    (model loops)
      - Prompt scaffolding leaked      ("Return ONLY..." echoed in output)
      - Trailing garbage lines         (non-SAY, non-command content)
      - Empty ADD_AUDIO_OVERLAY        (command with no variation)

    Returns:
        (format_score: float 0.0–1.0, issues: list[str])
          - format_score: 1.0 = perfectly canonical; deducted per issue
          - issues: human-readable list of every format problem found
    """
    issues = []
    raw_lines = ai_output.strip().splitlines()
    lines = [l.strip() for l in raw_lines if l.strip()]

    # ── Detect prompt-scaffolding leakage ─────────────────────────────────────
    for line in lines:
        ll = line.lower()
        for marker in _SCAFFOLD_MARKERS:
            if marker in ll:
                issues.append(f"Prompt scaffolding echoed: {line[:70]!r}")
                break

    # ── Separate SAY lines from command lines and garbage ─────────────────────
    say_lines = []
    cmd_lines = []
    garbage   = []

    for line in lines:
        tok = line.split()[0] if line.split() else ""
        if line.startswith("SAY:"):
            say_lines.append(line)
        elif tok.upper() in _KNOWN_CMDS:
            cmd_lines.append(line)
        else:
            # Only flag as garbage if it's not already a scaffold-leak issue
            ll = line.lower()
            if not any(m in ll for m in _SCAFFOLD_MARKERS):
                garbage.append(line)

    # ── Repetition: more than one SAY: block ──────────────────────────────────
    if len(say_lines) > 1:
        issues.append(
            f"Repetition: {len(say_lines)} SAY: lines found "
            f"(model failed to stop after first response)"
        )
    if not say_lines:
        issues.append("Missing SAY: line entirely")

    # ── Trailing garbage lines ────────────────────────────────────────────────
    for g in garbage:
        issues.append(f"Trailing garbage: {g[:70]!r}")

    # ── Per-command format checks ─────────────────────────────────────────────
    seen_cmds = []
    for line in cmd_lines:
        parts = line.split()
        cmd   = parts[0]

        # Uppercase command
        if cmd != cmd.upper():
            issues.append(f"Command not uppercase: {cmd!r} (expected {cmd.upper()!r})")

        if len(parts) < 2:
            issues.append(f"Command missing variation: {line!r}")
            continue

        var = parts[1]

        # Uppercase variation
        if var != var.upper():
            issues.append(f"Variation not uppercase: {var!r} (expected {var.upper()!r})")

        var_up = var.upper()
        extra  = parts[2:]

        if var_up in ("FIRST", "LAST"):
            # Must have exactly "<N> SEC" or "<N> MIN"
            dur_str = " ".join(extra[:2]) if len(extra) >= 2 else " ".join(extra)
            if not _UNIT_RE.match(dur_str):
                issues.append(
                    f"Non-canonical duration for {cmd.upper()} {var_up}: "
                    f"got {dur_str!r} — expected '<N> SEC' or '<N> MIN'"
                )

        elif var_up in ("BEFORE_PLAYHEAD", "AFTER_PLAYHEAD"):
            if extra:
                # Optional bounded form — must be "<N> SEC|MIN"
                dur_str = " ".join(extra[:2]) if len(extra) >= 2 else " ".join(extra)
                if not _UNIT_RE.match(dur_str):
                    issues.append(
                        f"Non-canonical bounded duration for {cmd.upper()} {var_up}: "
                        f"got {dur_str!r} — expected '<N> SEC' or '<N> MIN'"
                    )

        elif var_up == "RANGE":
            if len(extra) < 2:
                issues.append(f"RANGE missing start/end tokens: {line!r}")

        elif var_up == "FULL_VIDEO":
            # ADD_AUDIO_OVERLAY FULL_VIDEO must have a track
            if cmd.upper() == "ADD_AUDIO_OVERLAY" and (not extra or not _AUDIO_EXT.search(extra[-1])):
                issues.append(f"ADD_AUDIO_OVERLAY FULL_VIDEO missing audio track: {line!r}")

        # Repetition: exact duplicate commands
        if line in seen_cmds:
            issues.append(f"Duplicate command line: {line!r}")
        seen_cmds.append(line)

    # ── Score: start at 1.0, deduct 0.20 per issue, floor at 0.0 ─────────────
    format_score = max(0.0, round(1.0 - len(issues) * 0.20, 2))
    return format_score, issues


# ─── 2. Semantic DSL Validator ────────────────────────────────────────────────

def compare_outputs(ai_output: str, expected_output: str) -> tuple:
    """
    Combines semantic field-level matching AND strict format validation.

    Returns:
        (is_correct: bool, semantic_reason: str, format_score: float, format_issues: list[str])

    is_correct is True only when the semantic intent is correct.
    format_score (0.0–1.0) is independent — the model can be semantically right
    but format-wrong (e.g. CUT first 10s instead of CUT FIRST 10 SEC).
    """
    resolver_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    if resolver_dir not in sys.path:
        sys.path.insert(0, resolver_dir)

    # ── Format check (always run, independent of semantic result) ─────────────
    format_score, format_issues = validate_format(ai_output)

    # ── Semantic check ─────────────────────────────────────────────────────────
    try:
        from resolver import parse_dsl_response

        ai_parsed       = parse_dsl_response(ai_output)
        expected_parsed = parse_dsl_response(expected_output)
        ai_ops          = ai_parsed.get("operations", [])
        expected_ops    = expected_parsed.get("operations", [])

        # No DSL commands in either output
        if not ai_ops and not expected_ops:
            match = ai_output.strip() == expected_output.strip()
            reason = "Raw text match" if match else "Raw text mismatch (no DSL commands in either output)"
            return match, reason, format_score, format_issues

        # Operation count mismatch
        if len(ai_ops) != len(expected_ops):
            reason = (
                f"Operation count mismatch: "
                f"Hornet produced {len(ai_ops)} op(s), expected {len(expected_ops)}."
            )
            return False, reason, format_score, format_issues

        # Field-level comparison
        for idx, (ai_op, exp_op) in enumerate(zip(ai_ops, expected_ops), start=1):
            for key in ("operation", "variation"):
                if ai_op.get(key) != exp_op.get(key):
                    reason = (
                        f"Op {idx} field '{key}' mismatch: "
                        f"got {ai_op.get(key)!r}, expected {exp_op.get(key)!r}"
                    )
                    return False, reason, format_score, format_issues

            var = exp_op.get("variation")

            if var == "range":
                for field in ("start", "end"):
                    if ai_op.get(field) != exp_op.get(field):
                        reason = (
                            f"Op {idx} range field '{field}' mismatch: "
                            f"got {ai_op.get(field)!r}, expected {exp_op.get(field)!r}"
                        )
                        return False, reason, format_score, format_issues

            elif var in ("first", "last", "before_playhead", "after_playhead"):
                exp_val = exp_op.get("value")
                ai_val  = ai_op.get("value")

                if (exp_val is None) != (ai_val is None):
                    reason = (
                        f"Op {idx} duration presence mismatch: "
                        f"got {'no-arg' if ai_val is None else ai_val}, "
                        f"expected {'no-arg' if exp_val is None else exp_val}"
                    )
                    return False, reason, format_score, format_issues

                if exp_val is not None and ai_val != exp_val:
                    reason = (
                        f"Op {idx} duration value mismatch: "
                        f"got {ai_val}, expected {exp_val}"
                    )
                    return False, reason, format_score, format_issues

                if exp_val is not None and ai_op.get("unit") != exp_op.get("unit"):
                    reason = (
                        f"Op {idx} duration unit mismatch: "
                        f"got {ai_op.get('unit')!r}, expected {exp_op.get('unit')!r}"
                    )
                    return False, reason, format_score, format_issues

            if exp_op.get("operation") == "add_audio_overlay":
                if ai_op.get("track") != exp_op.get("track"):
                    reason = (
                        f"Op {idx} audio track mismatch: "
                        f"got {ai_op.get('track')!r}, expected {exp_op.get('track')!r}"
                    )
                    return False, reason, format_score, format_issues

        semantic_reason = f"All {len(expected_ops)} operation(s) match exactly."
        return True, semantic_reason, format_score, format_issues

    except Exception as e:
        match = ai_output.strip() == expected_output.strip()
        reason = f"Parse error ({e}); fallback to raw text {'match' if match else 'mismatch'}."
        return match, reason, format_score, format_issues


# ─── 3. Supabase store ────────────────────────────────────────────────────────

def store_result(
    supabase,
    user_input,
    ai_output,
    expected_output,
    is_correct,
    reason,
    format_score,
    format_issues,
    input_id,
    model_name_tag,
):
    """
    Inserts a dual-scored row into the Supabase ai_logs table.

    score       = 100 if semantically correct, else 0
    format_score (stored in notes) = 0.0–1.0 canonical format adherence
    notes       = semantic verdict + format issues for full diagnostic visibility

    Returns True on successful insert, False on error.
    """
    try:
        issues_str = "; ".join(format_issues) if format_issues else "none"
        notes = (
            f"[SEMANTIC] {reason} | "
            f"[FORMAT {format_score:.0%}] {issues_str}"
        )
        supabase.table("ai_logs").insert({
            "user_input":      user_input,
            "ai_output":       ai_output,
            "expected_output": expected_output,
            "score":           100 if is_correct else 0,
            "is_correct":      is_correct,
            "model_name":      model_name_tag,
            "notes":           notes,
        }).execute()
        return True
    except Exception as e:
        print(f"  ⚠️  [Supabase Error for {input_id}]: {e}")
        return False


# ─── 4. JSONL append ──────────────────────────────────────────────────────────

def append_to_jsonl(user_input, ai_output, format_score=1.0):
    """
    Appends a PASS row as ChatML to auto_training_data.jsonl.

    Only called when is_correct=True (semantic match) AND format_score >= 0.8
    to ensure only clean, well-formatted examples feed back into training.
    """
    text  = f"<|im_start|>system\n{CHATML_SYSTEM}<|im_end|>\n"
    text += f"<|im_start|>user\n{user_input}<|im_end|>\n"
    text += f"<|im_start|>assistant\n{ai_output}<|im_end|>\n"
    record = {"text": text}
    with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


# ─── Self-test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("── Validator Self-Test ──\n")

    semantic_cases = [
        # (label, ai_output, expected_output, should_pass)
        ("PASS: canonical exact match",
         "SAY: Done.\nCUT FIRST 10 SEC",
         "SAY: Removed first 10 seconds.\nCUT first 10s", True),
        ("FAIL: wrong value",
         "SAY: Done.\nCUT FIRST 5 SEC",
         "SAY: Removed first 10 seconds.\nCUT first 10s", False),
        ("PASS: range match",
         "SAY: Muted.\nMUTE RANGE 1:00 1:30",
         "SAY: Muted audio.\nMUTE range 1:00 1:30", True),
        ("FAIL: operation mismatch",
         "SAY: Done.\nCUT RANGE 1:00 2:00",
         "SAY: Muted.\nMUTE RANGE 1:00 2:00", False),
        ("PASS: no-arg playhead",
         "SAY: Done.\nCUT BEFORE_PLAYHEAD",
         "SAY: Removed before playhead.\nCUT BEFORE_PLAYHEAD", True),
        ("FAIL: no-arg vs bounded mismatch",
         "SAY: Done.\nCUT BEFORE_PLAYHEAD",
         "SAY: Cut 30 sec before.\nCUT BEFORE_PLAYHEAD 30 SEC", False),
    ]

    print("── Semantic tests ──")
    sem_ok = True
    for label, ai, exp, expected_pass in semantic_cases:
        ok, reason, fmt, issues = compare_outputs(ai, exp)
        icon = "✅" if ok == expected_pass else "❌ UNEXPECTED"
        if ok != expected_pass:
            sem_ok = False
        print(f"  {icon}  {label}")
        print(f"       semantic → {reason}")
        print(f"       format   → {fmt:.0%}  issues: {issues or 'none'}")

    print()

    format_cases = [
        ("PASS: canonical",         "SAY: Done.\nCUT FIRST 10 SEC",               1.0),
        ("FAIL: lowercase cmd/var", "SAY: Done.\ncut first 10s",                  None),
        ("FAIL: short unit suffix", "SAY: Done.\nCUT FIRST 10s",                  None),
        ("FAIL: repetition",        "SAY: Done.\nCUT FIRST 10 SEC\nSAY: Done.\nCUT FIRST 10 SEC", None),
        ("FAIL: trailing garbage",  "SAY: Done.\nCUT FIRST 10 SEC\nMuted Sections:\n- None", None),
        ("FAIL: scaffold leaked",   "SAY: Done.\nCUT FIRST 10 SEC\nReturn ONLY the raw text.", None),
    ]

    print("── Format-only tests ──")
    for label, ai, expected_score in format_cases:
        score, issues = validate_format(ai)
        passed = (expected_score is None and score < 1.0) or (expected_score == score)
        icon = "✅" if passed else "❌"
        print(f"  {icon}  {label}  → {score:.0%}")
        for iss in issues:
            print(f"       • {iss}")

    print()
    print("Semantic tests passed ✅" if sem_ok else "Some semantic tests FAILED ❌")
