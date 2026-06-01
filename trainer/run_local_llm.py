import os
import json
from transformers import pipeline
from transformers import AutoModelForCausalLM, AutoTokenizer
from resolver import resolve_intents

# Paths
base_model_path = "./SmolLM2-135M-Instruct"
finetuned_model_path = "./fine_tuned_smollm"

print("=" * 70)
print("✨ LOCAL LLM COMPARISON PAGE - UNTRAINED vs TRAINED (OFFLINE/LOCAL ONLY)")
print("=" * 70)

# Check base model existence
if not os.path.exists(base_model_path):
    print(f"❌ Error: Base model directory '{base_model_path}' not found!")
    print(f"Please run 'python3.11 download_model.py' first.")
    exit(1)

# Check fine-tuned model existence
has_finetuned = os.path.exists(os.path.join(finetuned_model_path, "model.safetensors")) or os.path.exists(os.path.join(finetuned_model_path, "pytorch_model.bin"))

# 1. Load Untrained Base Model
print(f"📥 Loading Untrained Base Model (strictly from folder: {base_model_path}) ...")
tokenizer_base = AutoTokenizer.from_pretrained(base_model_path, local_files_only=True)
model_base = AutoModelForCausalLM.from_pretrained(base_model_path, local_files_only=True).to("mps")
pipe_base = pipeline(
    "text-generation", 
    model=model_base, 
    tokenizer=tokenizer_base,
    device="mps"
)

# 2. Load Fine-Tuned Model (if trained)
pipe_finetuned = None
if has_finetuned:
    print(f"📥 Loading Fine-Tuned Model (strictly from folder: {finetuned_model_path}) ...")
    try:
        tokenizer_ft = AutoTokenizer.from_pretrained(finetuned_model_path, local_files_only=True)
        model_ft = AutoModelForCausalLM.from_pretrained(finetuned_model_path, local_files_only=True).to("mps")
        pipe_finetuned = pipeline(
            "text-generation", 
            model=model_ft, 
            tokenizer=tokenizer_ft,
            device="mps"
        )
        print("✅ Fine-Tuned model loaded successfully!")
    except Exception as e:
        print(f"⚠️ Could not load fine-tuned model (e.g., training might be incomplete): {e}")
else:
    print("\n💡 Tip: Your fine-tuned model has not been trained yet!")
    print("   Select training mode in the main menu to train your custom model.")

print("\n" + "=" * 70)
print("Ready to compare outputs! Type your prompt below (type 'exit' to quit).")
print("=" * 70)

def clean_chatml_response(text):
    """Utility to extract clean assistant answers from ChatML tokens."""
    if "<|im_start|>assistant" in text:
        return text.split("<|im_start|>assistant")[-1].replace("<|im_end|>", "").strip()
    return text.strip()

# Video Editor System Instruction (Base Model)
system_instruction = (
    "You are an intelligent video editor AI agent. Your sole task is to analyze the user's video editing "
    "request and return a raw JSON list of structured intents representing their instruction. "
    "Do not write any conversation, conversational greeting, or explanations. "
    "Output ONLY the raw valid JSON list."
)

# Video Editor System Instruction (Fine-Tuned Hornet Model)
system_instruction_ft = (
    "You are Hornet, a natural language processing (NLP) assistant. "
    "You analyze the user's video editing requests and return a structured JSON object "
    "containing two fields: 'message' (a natural response) and 'operations' (a list of video edit actions "
    "like 'cut', 'mute', 'add_audio_overlay' with start and end timestamps in seconds). "
    "Output ONLY a raw JSON object. Do NOT use markdown formatting, backticks, or extra text outside the JSON."
)

# Simulated Video Workspace Context
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

def run_comparison(user_text):
    print("\n" + "=" * 70)
    print("🎬 SIMULATED VIDEO PLAYER WORKSPACE STATE:")
    print(mock_video_context)
    print(f"\n💬 USER REQUEST: \"{user_text}\"")
    print("=" * 70)
    
    # Formulate prompt using SmolLM2 ChatML template with system instruction
    full_user_content = f"{mock_video_context}\n\n[USER MESSAGE]\n{user_text}"
    messages_base = [
        {"role": "system", "content": system_instruction},
        {"role": "user", "content": full_user_content}
    ]
    
    prompt_base = pipe_base.tokenizer.apply_chat_template(messages_base, tokenize=False, add_generation_prompt=True)
    
    # 1. Query Untrained Base Model
    print("⏳ Querying Untrained Base Model...")
    out_base = pipe_base(
        prompt_base, 
        max_new_tokens=256, 
        do_sample=True, 
        temperature=0.7, 
        clean_up_tokenization_spaces=False,
        eos_token_id=tokenizer_base.eos_token_id,
        pad_token_id=tokenizer_base.eos_token_id
    )
    ans_base = clean_chatml_response(out_base[0]["generated_text"])
    
    # 2. Query Fine-Tuned Model
    ans_finetuned = None
    if pipe_finetuned:
        print("⏳ Querying Fine-Tuned Model...")
        messages_ft = [
            {"role": "system", "content": system_instruction_ft},
            {"role": "user", "content": full_user_content}
        ]
        prompt_ft = pipe_finetuned.tokenizer.apply_chat_template(messages_ft, tokenize=False, add_generation_prompt=True)
        out_ft = pipe_finetuned(
            prompt_ft, 
            max_new_tokens=256, 
            do_sample=True, 
            temperature=0.7, 
            clean_up_tokenization_spaces=False,
            eos_token_id=tokenizer_ft.eos_token_id,
            pad_token_id=tokenizer_ft.eos_token_id
        )
        ans_finetuned = clean_chatml_response(out_ft[0]["generated_text"])
    
    # Display comparison and resolve intents deterministically
    print("\n" + "─" * 30 + " UNTRAINED BASE MODEL " + "─" * 30)
    print(f"RAW OUTPUT:\n{ans_base}\n")
    try:
        parsed_base = json.loads(ans_base)
        resolved_base = resolve_intents(parsed_base, mock_workspace_state)
        print(f"✅ DETECTED INTENTS:\n{json.dumps(parsed_base, indent=2)}")
        print(f"🎬 RESOLVED OPERATIONS:\n{json.dumps(resolved_base, indent=2)}")
    except Exception as e:
        print(f"⚠️ Base model output is not valid JSON intent: {e}")
    
    if ans_finetuned:
        print("\n" + "─" * 30 + " FINE-TUNED MODEL " + "─" * 30)
        print(f"RAW OUTPUT:\n{ans_finetuned}\n")
        try:
            parsed_ft = json.loads(ans_finetuned)
            if isinstance(parsed_ft, dict) and "operations" in parsed_ft:
                # Direct operations returned by Hornet SFT
                print(f"🗣️  AGENT MESSAGE: {parsed_ft.get('message', '')}")
                print(f"✅ DETECTED OPERATIONS:\n{json.dumps(parsed_ft['operations'], indent=2)}")
            else:
                # Fallback to resolver if it returned standard intents format
                resolved_ft = resolve_intents(parsed_ft, mock_workspace_state)
                print(f"✅ DETECTED INTENTS:\n{json.dumps(parsed_ft, indent=2)}")
                print(f"🎬 RESOLVED OPERATIONS:\n{json.dumps(resolved_ft, indent=2)}")
        except Exception as e:
            print(f"⚠️ Fine-tuned model output is not valid JSON intent: {e}")
    else:
        print("\n" + "─" * 30 + " FINE-TUNED MODEL " + "─" * 30)
        print("[No fine-tuned model active yet. Wait for training script to complete!]")
        
    print("=" * 70)

# Main interactive loop
if __name__ == "__main__":
    # Test sample prompt representing a realistic video editing command
    run_comparison("cut out the silent gap in the timeline")
    
    while True:
        try:
            user_input = input("\nYou > ").strip()
            if not user_input:
                continue
            if user_input.lower() in ["exit", "quit"]:
                print("Goodbye!")
                break
            run_comparison(user_input)
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye!")
            break
