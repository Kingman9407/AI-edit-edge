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

def format_chatml(user_content: str, response_text: str, actions: list) -> dict:
    """
    Builds a ChatML training record for SmolLM2 SFT.

    Rules enforced here:
    - Output exactly one raw JSON object.
    - No worker-specific fields (type, payload, reqId).
    """
    if not response_text.strip():
        if len(actions) == 0:
            response_text = "I'm sorry, I couldn't find any video edits in your request, but I am a video editor AI and I'm happy to help!"
        else:
            response_text = "I have applied the requested edits to the timeline."
            
    combined_output = {
        "message": response_text.strip(),
        "operations": actions
    }
    
    assistant_output = json.dumps(combined_output, indent=2)

    return {
        "text": (
            f"<|im_start|>system\n{SYSTEM_INSTRUCTION}<|im_end|>\n"
            f"<|im_start|>user\n{user_content}<|im_end|>\n"
            f"<|im_start|>assistant\n{assistant_output}<|endoftext|>"
        )
    }


def format_clean_training(request: str, response_text: str, actions: list) -> dict:
    """
    Produces a clean, framework-agnostic {instruction, input, output} record.

    Rules enforced here:
    - No markdown fences.
    - No duplicate JSON blocks.
    - No worker-specific fields (type, payload, reqId).
    - output is a structured object containing just the actions list.
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
    with open(data_filename, "w", encoding="utf-8") as f:
        for ex in TRAINING_EXAMPLES:
            user_content = (
                f"[VIDEO METADATA]\n{ex['metadata']}\n\n"
                f"[TIMELINE STATE]\n{ex['timeline']}\n\n"
                f"[USER REQUEST]\n{ex['request']}"
            )
            record = format_chatml(
                user_content=user_content,
                response_text=ex["response"],
                actions=ex["actions"]
            )
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    print("✅ ChatML SFT dataset created!")

    # ── 2. Clean training format ─────────────────────────────────────────
    print(f"\n[2/2] Generating clean training dataset: '{clean_data_filename}'...")
    with open(clean_data_filename, "w", encoding="utf-8") as f:
        for ex in TRAINING_EXAMPLES:
            record = format_clean_training(
                request=ex["request"],
                response_text=ex["response"],
                actions=ex["actions"]
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
