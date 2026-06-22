import os
import json
import re

data_filename       = "training_data.jsonl"
clean_data_filename = "training_data_clean.jsonl"

# ---------------------------------------------------------------------------
# System instruction — must match EdgeChatRunner.ts at inference time exactly.
# ---------------------------------------------------------------------------
SYSTEM_INSTRUCTION = (
    "You are Hornet, a video editing AI. Return JSON with 'message' and 'operations' (cut, mute, add_audio_overlay). "
    "If the user mentions time expressions requiring calculation, output a <tool_call> block first. "
    "Otherwise, output the final JSON directly."
)

from training_data import ALL_EXAMPLES as TRAINING_EXAMPLES


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

def format_chatml(
    user_content: str,
    assistant_output: str,
    history: list = None,
    tool_call: str = None,   # raw JSON string
    tool_result: str = None, # raw JSON string
    reasoning: str = None,   # legacy reasoning trace
) -> dict:
    """
    Builds a ChatML training record for SmolLM2 SFT.

    Tool-use path (tool_call + tool_result provided):
      system → [history] → user
        → assistant(<tool_call>…</tool_call>)
        → tool_result(…)
        → assistant(final JSON)

    Legacy reasoning path (reasoning provided, no tool_call):
      system → [history] → user
        → assistant(<thought>…</thought> final JSON)

    Standard path:
      system → [history] → user → assistant(final JSON)
    """
    text = f"<|im_start|>system\n{SYSTEM_INSTRUCTION}<|im_end|>\n"

    if history:
        for msg in history:
            text += f"<|im_start|>{msg['role']}\n{msg['content']}<|im_end|>\n"

    text += f"<|im_start|>user\n{user_content}<|im_end|>\n"

    if tool_call and tool_result:
        # Turn 1 — model emits structured tool call
        text += f"<|im_start|>assistant\n<tool_call>\n{tool_call}\n</tool_call>\n<|im_end|>\n"
        # Tool result turn — system-injected, masked with -100 during training
        text += f"<|im_start|>tool_result\n{tool_result}\n<|im_end|>\n"
        # Turn 2 — model emits final JSON using the resolved values
        text += f"<|im_start|>assistant\n{assistant_output}<|im_end|>\n"
    elif reasoning:
        # Legacy: reasoning trace wrapped in <thought> block
        text += f"<|im_start|>assistant\n<thought>\n{reasoning}\n</thought>\n{assistant_output}<|im_end|>\n"
    else:
        # Standard single-turn
        text += f"<|im_start|>assistant\n{assistant_output}<|im_end|>\n"

    return {"text": text}


def format_clean_training(request: str, response_text: str, actions: list) -> dict:
    """
    Produces a clean, framework-agnostic {instruction, input, output} record.
    """
    return {
        "instruction": "Generate video edit actions",
        "input": request,
        "output": actions
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 70)
    print("     VIDEO EDITOR AI - TRAINING DATA PREPARATION")
    print("=" * 70)

    # ── 1. ChatML SFT format ─────────────────────────────────────────────
    print(f"\n[1/2] Generating ChatML SFT dataset: '{data_filename}'...")
    tool_use_count = 0
    standard_count = 0

    with open(data_filename, "w", encoding="utf-8") as f:
        for ex in TRAINING_EXAMPLES:
            tool_call   = ex.get("tool_call")    # raw JSON string or None
            tool_result = ex.get("tool_result")  # raw JSON string or None
            reasoning   = ex.get("reasoning")    # legacy string or None

            record = format_chatml(
                user_content=ex["input"],
                assistant_output=ex["output"],
                history=ex.get("history"),
                tool_call=tool_call,
                tool_result=tool_result,
                reasoning=reasoning,
            )
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

            if tool_call and tool_result:
                tool_use_count += 1
            else:
                standard_count += 1

    print(f"  ✅ Tool-use examples : {tool_use_count}")
    print(f"  ✅ Standard examples : {standard_count}")
    print("✅ ChatML SFT dataset created!")

    # ── 2. Clean training format ─────────────────────────────────────────
    print(f"\n[2/2] Generating clean training dataset: '{clean_data_filename}'...")
    with open(clean_data_filename, "w", encoding="utf-8") as f:
        for ex in TRAINING_EXAMPLES:
            req_match = re.search(r'\[USER REQUEST\]\n(.*)$', ex["input"], re.DOTALL)
            request = req_match.group(1).strip() if req_match else ""

            try:
                parsed_out = json.loads(ex["output"])
                response_text = parsed_out.get("message", "")
                actions = parsed_out.get("operations", [])
            except:
                response_text = ""
                actions = []

            record = format_clean_training(
                request=request,
                response_text=response_text,
                actions=actions
            )
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    print("✅ Clean training dataset created!")

    # ── Summary ───────────────────────────────────────────────────────────
    chatml_count = sum(1 for _ in open(data_filename,       encoding="utf-8"))
    clean_count  = sum(1 for _ in open(clean_data_filename, encoding="utf-8"))

    print("\n" + "=" * 70)
    print("Dataset preparation complete!")
    print(f"  ChatML SFT  → {chatml_count:>3} samples  |  {os.path.abspath(data_filename)}")
    print(f"  Clean JSON  → {clean_count:>3} samples  |  {os.path.abspath(clean_data_filename)}")
    print("=" * 70)


if __name__ == "__main__":
    main()
