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

def format_chatml(user_content: str, response_text: str, actions: list, history: list = None) -> dict:
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

import re

def convert_to_compact_memory(user_content_str: str, recent_edits: list, last_action: str) -> str:
    # 1. Parse Metadata
    meta_match = re.search(r'\[VIDEO METADATA\]\n(.*?)(\n\n|$)', user_content_str, re.DOTALL)
    metadata_lines = meta_match.group(1).split('\n') if meta_match else []
    
    new_meta = []
    for line in metadata_lines:
        if line.startswith("Type:"): continue
        # optionally remove the "s" from Duration if needed, but keeping it is fine
        new_meta.append(line)
        
    # 2. Parse Timeline
    timeline_match = re.search(r'\[TIMELINE STATE\]\n(.*?)(\n\n|$)', user_content_str, re.DOTALL)
    timeline_lines = timeline_match.group(1).split('\n') if timeline_match else []
    
    cuts = []
    mutes = []
    music = []
    for line in timeline_lines:
        if line.startswith("Existing Cuts:"):
            cuts_json = line.replace("Existing Cuts:", "").strip()
            if cuts_json:
                try: cuts = json.loads(cuts_json)
                except: pass
        elif line.startswith("Silent Sections:"):
            mutes_json = line.replace("Silent Sections:", "").strip()
            if mutes_json:
                try: mutes = json.loads(mutes_json)
                except: pass
        elif line.startswith("Background Music:"):
            music_json = line.replace("Background Music:", "").strip()
            if music_json:
                try: music = json.loads(music_json)
                except: pass

    def format_list(items):
        if not items: return "- None"
        return "\n".join(f"- {i['start']} -> {i['end']}" for i in items)

    timeline_str = (
        "Cuts:\n" + format_list(cuts) + "\n\n"
        "Muted Sections:\n" + format_list(mutes) + "\n\n"
        "Subtitles:\n- None\n\n"
        "Background Music:\n" + format_list(music)
    )
    
    # 3. Format Recent Edits & Last Action
    recent_str = "None"
    if recent_edits:
        recent_str = "\n".join(f"{idx+1}. {edit}" for idx, edit in enumerate(recent_edits))
        
    last_action_str = last_action if last_action else "None"
    
    # 4. Extract User Request
    req_match = re.search(r'\[USER REQUEST\]\n(.*)$', user_content_str, re.DOTALL)
    user_req = req_match.group(1).strip() if req_match else ""
    
    return (
        f"[VIDEO METADATA]\n" + "\n".join(new_meta) + "\n\n"
        f"[TIMELINE STATE]\n" + timeline_str + "\n\n"
        f"[RECENT EDITS]\n{recent_str}\n\n"
        f"[LAST ACTION]\n{last_action_str}\n\n"
        f"[USER REQUEST]\n{user_req}"
    )

def main():
    print("=" * 70)
    print("     VIDEO EDITOR AI - TRAINING DATA PREPARATION")
    print("=" * 70)

    # ── 1. ChatML SFT format ─────────────────────────────────────────────
    print(f"\n[1/2] Generating ChatML SFT dataset: '{data_filename}'...")
    with open(data_filename, "w", encoding="utf-8") as f:
        for ex in TRAINING_EXAMPLES:
            raw_user_content = (
                f"[VIDEO METADATA]\n{ex['metadata']}\n\n"
                f"[TIMELINE STATE]\n{ex['timeline']}\n\n"
                f"[USER REQUEST]\n{ex['request']}"
            )
            
            recent_edits = []
            last_action = "None"
            history = ex.get("history")
            
            # Deep copy history so we don't mutate the imported source module
            import copy
            if history:
                history = copy.deepcopy(history)
                for msg in history:
                    if msg["role"] == "user":
                        msg["content"] = convert_to_compact_memory(msg["content"], recent_edits, last_action)
                        req_match = re.search(r'\[USER REQUEST\]\n(.*)$', msg["content"], re.DOTALL)
                        if req_match:
                            recent_edits.append(req_match.group(1).strip())
                    elif msg["role"] == "assistant":
                        try:
                            parsed_ast = json.loads(msg["content"])
                            last_action = parsed_ast.get("message", "None")
                        except:
                            last_action = "None"

            compact_user_content = convert_to_compact_memory(raw_user_content, recent_edits, last_action)
            
            record = format_chatml(
                user_content=compact_user_content,
                response_text=ex["response"],
                actions=ex["actions"],
                history=history
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
