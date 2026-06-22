import os
import torch
from datasets import load_dataset
from transformers import (
    AutoTokenizer, 
    AutoModelForCausalLM, 
    TrainingArguments, 
    Trainer,
    DataCollatorForLanguageModeling
)

def main():
    print("=" * 60)
    print("        LOCAL LLM FINE-TUNER (SmolLM2-135M - GPU ACCELERATED)")
    print("=" * 60)
    
    # 1. Determine active hardware accelerator (Apple Silicon GPU 'mps' on Mac)
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"🚀 Active Accelerator Device: {device.upper()}")
    
    # 2. Check for dataset existence
    dataset_file = "training_data.jsonl"
    if not os.path.exists(dataset_file):
        print(f"❌ Error: Dataset file '{dataset_file}' not found!")
        print("Please run 'python3.11 prepare_data.py' first to create your training data.")
        return

    # 3. Load the Local Model & Tokenizer
    model_path = "./SmolLM2-135M-Instruct"
    if not os.path.exists(model_path):
        print(f"❌ Error: Base model directory '{model_path}' not found!")
        print("Please run 'python3.11 download_model.py' first.")
        return
        
    print(f"\n📥 Loading tokenizer strictly from local folder: {model_path} ...")
    tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
    # Use unk_token <|endoftext|> as pad token instead of eos_token to prevent masking out EOS loss
    tokenizer.pad_token = "<|endoftext|>"

    print(f"📥 Loading model weights strictly from local folder: {model_path} ...")
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        torch_dtype=torch.float32,  # Optimized format for Apple Silicon MPS
        local_files_only=True
    )
    model = model.to(device)
    print("✅ Base model loaded successfully!")

    # 4. Load & Tokenize Custom Training Data
    print(f"\n📖 Loading dataset: {dataset_file} ...")
    dataset = load_dataset("json", data_files=dataset_file, split="train")

    # Pre-tokenize the special role headers we need to find
    # - assistant turns: we want loss on ALL assistant turns (both tool_call turn and final JSON turn)
    # - tool_result turns: we want NO loss (masked -100) — the model reads them but doesn't generate them
    assistant_start_tokens = tokenizer.encode("<|im_start|>assistant\n", add_special_tokens=False)
    tool_result_start_tokens = tokenizer.encode("<|im_start|>tool_result\n", add_special_tokens=False)
    im_end_tokens = tokenizer.encode("<|im_end|>", add_special_tokens=False)

    n_assistant = len(assistant_start_tokens)
    n_tool_result = len(tool_result_start_tokens)
    n_im_end = len(im_end_tokens)

    def find_all_occurrences(seq: list, pattern: list) -> list[int]:
        """Return start indices of all occurrences of `pattern` inside `seq`."""
        indices = []
        pattern_len = len(pattern)
        for i in range(len(seq) - pattern_len + 1):
            if seq[i : i + pattern_len] == pattern:
                indices.append(i)
        return indices

    def tokenize_function(examples):
        result = tokenizer(
            examples["text"], 
            truncation=True, 
            max_length=512,
            padding=True
        )
        
        labels = []

        for input_ids in result["input_ids"]:
            # Start with everything masked
            label = [-100] * len(input_ids)

            # ── Find all assistant turn starts ────────────────────────────
            assistant_starts = find_all_occurrences(input_ids, assistant_start_tokens)

            # ── Find all tool_result turn starts (to keep them masked) ────
            tool_result_starts = find_all_occurrences(input_ids, tool_result_start_tokens)
            tool_result_start_set = set(tool_result_starts)

            if not assistant_starts:
                # Fallback: no assistant token found — use standard full-sequence labels
                for j in range(len(input_ids)):
                    if input_ids[j] != tokenizer.pad_token_id:
                        label[j] = input_ids[j]
                labels.append(label)
                continue

            # ── Unmask every assistant turn (skip those inside tool_result) ─
            for a_start in assistant_starts:
                content_start = a_start + n_assistant
                # Walk forward to find the closing <|im_end|>
                content_end = len(input_ids)
                for k in range(content_start, len(input_ids) - n_im_end + 1):
                    if input_ids[k : k + n_im_end] == im_end_tokens:
                        content_end = k + n_im_end  # include the <|im_end|> token in the loss
                        break

                # Unmask this assistant block
                for j in range(content_start, content_end):
                    if input_ids[j] == tokenizer.pad_token_id:
                        label[j] = -100
                    else:
                        label[j] = input_ids[j]

            # ── Re-mask any tool_result turns (the model must not generate these) ─
            for tr_start in tool_result_starts:
                content_start = tr_start  # mask from the role header itself
                content_end = len(input_ids)
                for k in range(content_start, len(input_ids) - n_im_end + 1):
                    if input_ids[k : k + n_im_end] == im_end_tokens:
                        content_end = k + n_im_end
                        break
                for j in range(content_start, content_end):
                    label[j] = -100

            labels.append(label)
            
        result["labels"] = labels
        return result

    print("⚡ Tokenizing training examples...")
    tokenized_dataset = dataset.map(
        tokenize_function, 
        batched=True, 
        remove_columns=dataset.column_names
    )
    print(f"✅ Tokenization complete. Loaded {len(tokenized_dataset)} items.")

    # 5. Configure Training Arguments
    output_dir = "./fine_tuned_smollm"
    print(f"\n⚙️ Configuring SFT training settings (saving to {output_dir})...")
    
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=5,                 # Train for 5 epochs
        per_device_train_batch_size=2,      # Small batch size to optimize memory
        gradient_accumulation_steps=2,      # Accumulate gradients for stable steps
        learning_rate=5e-5,                 # Standard learning rate for SFT
        weight_decay=0.01,
        logging_steps=1,
        save_strategy="no",                 # Only save final weights
        use_cpu=False if device == "mps" else True,
        report_to="none"
    )

    data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

    # 6. Initialize Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset,
        data_collator=data_collator,
    )

    # 7. Execute Fine-Tuning
    print("\n🎬 Starting Fine-Tuning on your MacBook GPU...")
    print("-" * 60)
    trainer.train()
    print("-" * 60)
    print("🎉 Training finished successfully!")

    # 8. Save the Fine-Tuned Weights
    print(f"\n💾 Saving fine-tuned model and tokenizer to: {output_dir}")
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)
    
    print("\n" + "=" * 60)
    print("✅ Local LLM Fine-Tuning Complete!")
    print(f"Model saved at: {os.path.abspath(output_dir)}")
    print("You can now run 'python3.11 run_local_llm.py' to compare base vs trained LLM!")
    print("=" * 60)

if __name__ == "__main__":
    main()
