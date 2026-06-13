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

    def tokenize_function(examples):
        result = tokenizer(
            examples["text"], 
            truncation=True, 
            max_length=512,
            padding=True
        )
        
        # Build labels
        labels = []
        assistant_start_tokens = tokenizer.encode("<|im_start|>assistant\n", add_special_tokens=False)
        n_tokens = len(assistant_start_tokens)

        for input_ids in result["input_ids"]:
            label = [-100] * len(input_ids)
            
            # Find the start of the final assistant response
            found_idx = -1
            for i in range(len(input_ids) - n_tokens + 1):
                if input_ids[i : i + n_tokens] == assistant_start_tokens:
                    found_idx = i
            
            if found_idx != -1:
                # Mask prompt tokens, keep assistant response tokens
                start_label_idx = found_idx + n_tokens
                for j in range(start_label_idx, len(input_ids)):
                    if input_ids[j] == tokenizer.pad_token_id:
                        label[j] = -100
                    else:
                        label[j] = input_ids[j]
            else:
                # Fallback to standard labels if tokenizer splits tags unexpectedly
                for j in range(len(input_ids)):
                    if input_ids[j] == tokenizer.pad_token_id:
                        label[j] = -100
                    else:
                        label[j] = input_ids[j]
                
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
