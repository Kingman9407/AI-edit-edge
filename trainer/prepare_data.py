import os
import json

data_filename       = "training_data.jsonl"
clean_data_filename = "training_data_clean.jsonl"

# ---------------------------------------------------------------------------
# System instruction — must match server.py at inference time exactly.
# The assistant returns:
#   1. A raw JSON list containing the actions list.
# Operations allowed: "cut", "mute", "add_audio_overlay"
# ---------------------------------------------------------------------------
SYSTEM_INSTRUCTION = (
    "You are Hornet, a natural language processing (NLP) assistant. "
    "You analyze the user's video editing requests and return a structured JSON object "
    "containing two fields: 'message' (a natural response) and 'operations' (a list of video edit actions "
    "like 'cut', 'mute', 'add_audio_overlay' with start and end timestamps in seconds). "
    "Output ONLY a raw JSON object. Do NOT use markdown formatting, backticks, or extra text outside the JSON."
)

from training_data import ALL_EXAMPLES as TRAINING_EXAMPLES


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

def format_chatml(user_content: str, assistant_output: str, history: list = None) -> dict:
    """
    Builds a ChatML training record for SmolLM2 SFT.
    """
    text = f"<|im_start|>system\n{SYSTEM_INSTRUCTION}<|im_end|>\n"
    if history:
        for msg in history:
            text += f"<|im_start|>{msg['role']}\n{msg['content']}<|im_end|>\n"
    text += f"<|im_start|>user\n{user_content}<|im_end|>\n"
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

import re

def main():
    print("=" * 70)
    print("     VIDEO EDITOR AI - TRAINING DATA PREPARATION")
    print("=" * 70)

    # ── 1. ChatML SFT format ─────────────────────────────────────────────
    print(f"\n[1/2] Generating ChatML SFT dataset: '{data_filename}'...")
    with open(data_filename, "w", encoding="utf-8") as f:
        for ex in TRAINING_EXAMPLES:
            record = format_chatml(
                user_content=ex["input"],
                assistant_output=ex["output"],
                history=ex.get("history")
            )
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    print("✅ ChatML SFT dataset created!")

    # ── 2. Clean training format ─────────────────────────────────────────
    print(f"\n[2/2] Generating clean training dataset: '{clean_data_filename}'...")
    with open(clean_data_filename, "w", encoding="utf-8") as f:
        for ex in TRAINING_EXAMPLES:
            # Parse request and actions from input/output
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
