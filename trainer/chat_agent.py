import os
import sys
import time
import json
import torch
import random
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
from resolver import resolve_intents

# Paths
finetuned_model_path = "./fine_tuned_smollm"

# Video Editor System Instruction
system_instruction = (
    "You are an intelligent video editor AI agent. Your sole task is to analyze the user's video editing "
    "request and return a raw JSON list of structured intents representing their instruction. "
    "Do not write any conversation, conversational greeting, or explanations. "
    "Output ONLY the raw valid JSON list."
)

def generate_random_8min_video():
    """Generates a random 8-minute video context and workspace state."""
    # Duration is exactly 8 minutes = 480 seconds
    duration = 480.0
    
    video_names = [
        "vlog_park_walk.mp4",
        "lecture_deep_learning.mp4",
        "cooking_tutorial_lasagna.mp4",
        "family_gathering.mov",
        "gaming_highlights.mp4",
        "podcast_episode_42.mp4",
        "unboxing_latest_tech.mov"
    ]
    name = random.choice(video_names)
    
    video_types = {
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".mkv": "video/x-matroska"
    }
    ext = os.path.splitext(name)[1]
    video_type = video_types.get(ext, "video/mp4")
    
    resolutions = ["1920x1080", "1280x720", "3840x2160"]
    resolution = random.choice(resolutions)
    
    playhead = round(random.uniform(0.0, duration), 1)
    
    # Generate 1 to 3 random silent sections
    silent_sections = []
    num_sections = random.randint(1, 3)
    
    # Simple algorithm to generate non-overlapping silent sections spaced out
    ranges = []
    if num_sections >= 1:
        ranges.append((10.0, 120.0))
    if num_sections >= 2:
        ranges.append((150.0, 280.0))
    if num_sections >= 3:
        ranges.append((310.0, 440.0))
        
    for r_start, r_end in ranges:
        start = round(random.uniform(r_start, r_end - 30.0), 1)
        end = round(start + random.uniform(5.0, 25.0), 1)
        silent_sections.append({"start": start, "end": end})
        
    existing_cuts = []
    if random.random() < 0.3:
        cut_start = round(random.uniform(5.0, 50.0), 1)
        cut_end = round(cut_start + random.uniform(5.0, 15.0), 1)
        existing_cuts.append({"start": cut_start, "end": cut_end})
        
    bg_music = []
    if random.random() < 0.4:
        music_tracks = ["lofi_beat.mp3", "acoustic_guitar.mp3", "upbeat_track.mp3"]
        bg_music.append({
            "track": random.choice(music_tracks),
            "start": 0.0,
            "end": duration
        })
        
    workspace_state = {
        "duration": duration,
        "playhead": playhead,
        "silent_sections": silent_sections,
        "existing_cuts": existing_cuts
    }
    
    video_context = (
        f"[VIDEO METADATA]\n"
        f"Name: {name}\n"
        f"Type: {video_type}\n"
        f"Duration: {duration}s\n"
        f"Resolution: {resolution}\n"
        f"Playhead: {playhead}s\n\n"
        f"[TIMELINE STATE]\n"
        f"Existing Cuts: {json.dumps(existing_cuts)}\n"
        f"Silent Sections: {json.dumps(silent_sections)}\n"
        f"Background Music: {json.dumps(bg_music)}"
    )
    
    return workspace_state, video_context

# Simulated Video Player Context
mock_workspace_state = {
    "duration": 180.0,
    "playhead": 0.0,
    "silent_sections": [{"start": 25.0, "end": 32.5}]
}

mock_video_context = (
    "[VIDEO METADATA]\n"
    "Name: zoom_meeting.mp4\n"
    "Type: video/mp4\n"
    "Duration: 180.0s\n"
    "Resolution: 1280x720\n"
    "Playhead: 0.0s\n\n"
    "[TIMELINE STATE]\n"
    "Existing Cuts: []\n"
    "Silent Sections: [{\"start\": 25.0, \"end\": 32.5}]\n"
    "Background Music: []"
)

def clean_chatml_response(text):
    """Extract the clean assistant response from ChatML formatting."""
    if "<|im_start|>assistant" in text:
        return text.split("<|im_start|>assistant")[-1].replace("<|im_end|>", "").strip()
    return text.strip()

def main():
    global mock_workspace_state, mock_video_context
    mock_workspace_state, mock_video_context = generate_random_8min_video()
    print("=" * 70)
    print("        🎬 CHAT MODE: INTERACTIVE VIDEO EDITOR AGENT 🎬")
    print("=" * 70)

    # 1. Check if model exists
    has_finetuned = os.path.exists(os.path.join(finetuned_model_path, "model.safetensors")) or os.path.exists(os.path.join(finetuned_model_path, "pytorch_model.bin"))
    if not has_finetuned:
        print("\n❌ Error: No fine-tuned model found!")
        print("Please run training mode first (Option 1 in main.py) to train your agent.")
        return

    # 2. Determine acceleration
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"🚀 Device Accelerator: {device.upper()}")
    
    # 3. Load Model
    print("📥 Loading your custom Video Editor Agent weights...")
    try:
        tokenizer = AutoTokenizer.from_pretrained(finetuned_model_path, local_files_only=True)
        model = AutoModelForCausalLM.from_pretrained(
            finetuned_model_path, 
            torch_dtype=torch.float32, 
            local_files_only=True
        ).to(device)
        
        pipe = pipeline(
            "text-generation", 
            model=model, 
            tokenizer=tokenizer,
            device=device
        )
        print("✅ Fine-tuned agent loaded successfully and ready to edit!")
    except Exception as e:
        print(f"⚠️ Error loading model: {e}")
        return

    print("\n" + "=" * 70)
    print("💡 INSTRUCTIONS: Talk to the agent in plain English.")
    print("   Type 'exit' or 'quit' to end the chat.")
    print("=" * 70)

    # Simulated chat loop
    while True:
        try:
            print("\n🎬 CURRENT TIMELINE STATE:")
            print("-" * 35)
            print(mock_video_context)
            print("-" * 35)
            
            user_input = input("\nYou (Ask Agent to Edit) > ").strip()
            if not user_input:
                continue
            if user_input.lower() in ["exit", "quit"]:
                print("\nGoodbye! Happy editing!")
                break
                
            print("\n⏳ Processing your edit request...")
            
            # Format using standard ChatML format matching the SFT training dataset
            full_user_content = f"{mock_video_context}\n\n[USER MESSAGE]\n{user_input}"
            messages = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": full_user_content}
            ]
            
            prompt = pipe.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
            
            # Run generation and measure performance
            start_time = time.perf_counter()
            outputs = pipe(
                prompt, 
                max_new_tokens=256, 
                do_sample=True, 
                temperature=0.7,
                clean_up_tokenization_spaces=False,
                eos_token_id=tokenizer.eos_token_id,
                pad_token_id=tokenizer.eos_token_id
            )
            end_time = time.perf_counter()
            elapsed_time = end_time - start_time
            
            # Calculate token generation metrics
            prompt_token_count = len(pipe.tokenizer.encode(prompt))
            total_token_count = len(pipe.tokenizer.encode(outputs[0]["generated_text"]))
            new_tokens_count = max(1, total_token_count - prompt_token_count)
            tokens_per_sec = new_tokens_count / elapsed_time
            
            response = clean_chatml_response(outputs[0]["generated_text"])
            
            print("\n🤖 AGENT RESPONSE (RAW INTENT JSON):")
            print("-" * 50)
            print(response)
            print("-" * 50)
            
            # Resolve intents deterministically using python resolver
            try:
                parsed_intents = json.loads(response)
                resolved_ops = resolve_intents(parsed_intents, mock_workspace_state)
                print("\n🎬 RESOLVED TIMELINE OPERATIONS:")
                print(json.dumps(resolved_ops, indent=2))
            except Exception as e:
                print(f"\n⚠️ Warning: Agent output is not a valid JSON list of intents: {e}")
                
            print("-" * 50)
            print(f"⏱️  Latency: {elapsed_time:.2f}s | ⚡ Speed: {tokens_per_sec:.1f} tokens/sec | 🎟️  Tokens generated: {new_tokens_count}")
            print("-" * 50)

        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye!")
            break

if __name__ == "__main__":
    main()
