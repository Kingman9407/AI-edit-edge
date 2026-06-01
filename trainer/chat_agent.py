import os
import re
import time
import json
import torch
import random
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

# Paths
finetuned_model_path = "./fine_tuned_smollm"

# Unified System Instruction for single-stage architecture
SYSTEM_INSTRUCTION = (
    "You are Hornet, a natural language processing (NLP) assistant. "
    "You analyze the user's video editing requests and return a structured JSON object "
    "containing two fields: 'message' (a natural response) and 'operations' (a list of video edit actions "
    "like 'cut', 'mute', 'add_audio_overlay' with start and end timestamps in seconds). "
    "Output ONLY a raw JSON object. Do NOT use markdown formatting, backticks, or extra text outside the JSON."
)


# ==============================================================================
# Model inference helpers
# ==============================================================================

def run_model(pipe, tokenizer, system_prompt: str, user_content: str,
              history: list = None, max_new_tokens: int = 128) -> tuple[str, float, int]:
    """
    Runs the model pipeline with the given system prompt and user content.
    Returns (generated_text, elapsed_seconds, new_token_count).
    """
    messages = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_content})

    prompt = pipe.tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )

    start = time.perf_counter()
    outputs = pipe(
        prompt,
        max_length=None,
        max_new_tokens=max_new_tokens,
        do_sample=False,
        temperature=0.1,
        eos_token_id=tokenizer.eos_token_id,
        pad_token_id=tokenizer.eos_token_id,
    )
    elapsed = time.perf_counter() - start

    raw = outputs[0]["generated_text"]          # only new tokens (return_full_text=False)
    new_tokens = max(1, len(tokenizer.encode(raw)))
    return raw, elapsed, new_tokens


def parse_json_response(text: str) -> dict:
    """
    Finds and returns the FIRST complete JSON object from model output.
    Prevents markdown / trailing garbage parse errors.
    """
    start = text.find('{')
    if start == -1:
        return {}

    depth = 0
    in_string = False
    escape_next = False

    for i, ch in enumerate(text[start:], start=start):
        if escape_next:
            escape_next = False
            continue
        if ch == '\\' and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                candidate = text[start:i + 1]
                try:
                    parsed = json.loads(candidate)
                    return parsed if isinstance(parsed, dict) else {}
                except json.JSONDecodeError:
                    return {}
    return {}


# ==============================================================================
# Video context generator
# ==============================================================================

def format_video_context(state: dict) -> str:
    metadata = (
        f"Name: {state.get('name')}\n"
        f"Duration: {state.get('duration')}s\n"
        f"Resolution: {state.get('resolution')}\n"
        f"Playhead: {state.get('playhead')}s"
    )

    def format_list(items):
        if not items: return "- None"
        return "\n".join(f"- {i['start']} -> {i['end']}" for i in items)

    timeline = (
        "Cuts:\n" + format_list(state.get('existing_cuts', [])) + "\n\n"
        "Muted Sections:\n" + format_list(state.get('silent_sections', [])) + "\n\n"
        "Subtitles:\n- None\n\n"
        "Background Music:\n" + format_list(state.get('bg_music', []))
    )
    
    recent_edits = state.get('recent_edits', [])
    recent_str = "None"
    if recent_edits:
        recent_str = "\n".join(f"{idx+1}. {edit}" for idx, edit in enumerate(recent_edits))
        
    last_action = state.get('last_action', "None")

    return f"[VIDEO METADATA]\n{metadata}\n\n[TIMELINE STATE]\n{timeline}\n\n[RECENT EDITS]\n{recent_str}\n\n[LAST ACTION]\n{last_action}"


def generate_random_8min_video():
    """Generates a random 8-minute video context and workspace state."""
    duration = 480.0

    video_names = [
        "vlog_park_walk.mp4", "lecture_deep_learning.mp4",
        "cooking_tutorial_lasagna.mp4", "family_gathering.mov",
        "gaming_highlights.mp4", "podcast_episode_42.mp4",
        "unboxing_latest_tech.mov"
    ]
    name = random.choice(video_names)

    video_types = {".mp4": "video/mp4", ".mov": "video/quicktime", ".mkv": "video/x-matroska"}
    ext = os.path.splitext(name)[1]
    video_type = video_types.get(ext, "video/mp4")

    resolutions = ["1920x1080", "1280x720", "3840x2160"]
    resolution = random.choice(resolutions)
    playhead = round(random.uniform(0.0, duration), 1)

    silent_sections = []
    existing_cuts = []
    bg_music = []

    workspace_state = {
        "name": name,
        "video_type": video_type,
        "resolution": resolution,
        "duration": duration,
        "playhead": playhead,
        "silent_sections": silent_sections,
        "existing_cuts": existing_cuts,
        "bg_music": bg_music,
        "recent_edits": [],
        "last_action": "None"
    }

    video_context = format_video_context(workspace_state)

    return workspace_state, video_context


# ==============================================================================
# Main chat loop
# ==============================================================================

def main():
    workspace_state, video_context = generate_random_8min_video()

    print("=" * 70)
    print("        🎬 CHAT MODE: INTERACTIVE VIDEO EDITOR AGENT 🎬")
    print("=" * 70)
    print("  🤖 Single Stage: Unified text and JSON edit actions")
    print("=" * 70)

    # 1. Check model weights
    has_finetuned = (
        os.path.exists(os.path.join(finetuned_model_path, "model.safetensors")) or
        os.path.exists(os.path.join(finetuned_model_path, "pytorch_model.bin"))
    )
    if not has_finetuned:
        print("\n❌ Error: No fine-tuned model found!")
        print("Please run training mode first (Option 1 in main.py).")
        return

    # 2. Determine acceleration
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"🚀 Device Accelerator: {device.upper()}")

    # 3. Load model
    print("📥 Loading fine-tuned Video Editor Agent weights...")
    try:
        tokenizer = AutoTokenizer.from_pretrained(finetuned_model_path, local_files_only=True)
        model = AutoModelForCausalLM.from_pretrained(
            finetuned_model_path,
            dtype=torch.float32,
            local_files_only=True
        ).to(device)

        pipe = pipeline(
            "text-generation",
            model=model,
            tokenizer=tokenizer,
            device=device,
            return_full_text=False,     # only return newly generated tokens
        )
        print("✅ Agent loaded and ready!")
    except Exception as e:
        print(f"⚠️ Error loading model: {e}")
        return

    print("\n" + "=" * 70)
    print("💡 INSTRUCTIONS: Ask me to edit your video in plain English.")
    print("   Type 'exit' or 'quit' to end the session.")
    print("=" * 70)

    chat_history = []

    while True:
        try:
            print("\n🎬 CURRENT TIMELINE STATE:")
            print("-" * 35)
            print(video_context)
            print("-" * 35)

            user_input = input("\nYou (Ask Agent to Edit) > ").strip()
            if not user_input:
                continue
            if user_input.lower() in ["exit", "quit"]:
                print("\nGoodbye! Happy editing!")
                break

            # ── Single Stage Inference ──────────────────────────────
            print("⏳ Generating unified response...")
            full_user_content = f"{video_context}\n\n[USER MESSAGE]\n{user_input}"

            raw_text, elapsed, n_tok = run_model(
                pipe, tokenizer,
                system_prompt=SYSTEM_INSTRUCTION,
                user_content=full_user_content,
                history=chat_history,
                max_new_tokens=256,
            )
            
            chat_history.append({"role": "user", "content": full_user_content})
            chat_history.append({"role": "assistant", "content": raw_text.strip()})

            print("\n🤖 AGENT RAW OUTPUT:")
            print("-" * 50)
            print(raw_text.strip())
            print("-" * 50)

            try:
                parsed_response = parse_json_response(raw_text)
                
                print(f"\n🗣️  AGENT MESSAGE:\n{parsed_response.get('message', '')}")
                
                parsed_intents = parsed_response.get("operations", [])
                
                if not parsed_intents:
                    print("\n⚠️  No valid edit operations found (likely just conversation).")
                else:
                    print(f"\n✅ TIMELINE OPERATIONS ({len(parsed_intents)} op(s)):")
                    print(json.dumps(parsed_intents, indent=2))
                    
                    action_descs = []
                    for op in parsed_intents:
                        op_type = op.get("operation")
                        start_time = op.get("start")
                        end_time = op.get("end")
                        if op_type == "cut":
                            workspace_state["existing_cuts"].append({"start": start_time, "end": end_time})
                            action_descs.append(f"Cut section from {start_time}s -> {end_time}s")
                        elif op_type == "mute":
                            workspace_state["silent_sections"].append({"start": start_time, "end": end_time})
                            action_descs.append(f"Muted section from {start_time}s -> {end_time}s")
                        elif op_type in ["add_audio_overlay", "add_music"]:
                            workspace_state["bg_music"].append({"start": start_time, "end": end_time, "asset": op.get("asset", "unknown")})
                            action_descs.append(f"Added audio overlay from {start_time}s -> {end_time}s")
                    
                    if action_descs:
                        workspace_state["last_action"] = "; ".join(action_descs)
                    workspace_state["recent_edits"].append(user_input)
                    
                    video_context = format_video_context(workspace_state)
            except Exception as e:
                print(f"\n⚠️  Parse/resolve error: {e}")

            print("-" * 50)
            print(f"⏱️  Latency: {elapsed:.2f}s | ⚡ Speed: {n_tok / elapsed:.1f} tok/s | 🎟️  Tokens: {n_tok}")
            print("-" * 50)

        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye!")
            break


if __name__ == "__main__":
    main()
