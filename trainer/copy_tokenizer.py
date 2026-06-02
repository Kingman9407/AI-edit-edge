import os
import shutil
import sys

def main():
    src_dir = "trainer/fine_tuned_smollm"
    if not os.path.exists(src_dir):
        src_dir = "fine_tuned_smollm"
        if not os.path.exists(src_dir):
            print("❌ Cannot find fine_tuned_smollm directory.")
            sys.exit(1)
            
    base_dir = "trainer/SmolLM2-135M-Instruct"
    if not os.path.exists(base_dir):
        base_dir = "SmolLM2-135M-Instruct"
        if not os.path.exists(base_dir):
            print("❌ Cannot find base model directory.")
            sys.exit(1)

    dest_dir = "trainer/fine_tuned_smollm_onnx"
    if not os.path.exists(dest_dir):
        dest_dir = "fine_tuned_smollm_onnx"

    print(f"📦 Copying tokenizer files to {dest_dir}...")

    files_to_copy = [
        (src_dir, "tokenizer.json"),
        (src_dir, "tokenizer_config.json"),
        (base_dir, "special_tokens_map.json")
    ]

    for src, filename in files_to_copy:
        source_file = os.path.join(src, filename)
        dest_file = os.path.join(dest_dir, filename)
        if os.path.exists(source_file):
            shutil.copy2(source_file, dest_file)
            print(f"✅ Copied {filename}")
        else:
            print(f"⚠️ Warning: Could not find {filename} in {src}")

    print("\n🎉 Tokenizer files successfully added to your ONNX folder!")
    print("Now run 'python trainer/push_to_hf.py' to upload them to your Hugging Face repo.")

if __name__ == "__main__":
    main()
