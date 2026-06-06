import os
import sys
import json
import shutil
import tempfile
from huggingface_hub import HfApi

REPO_ID = "Kingman9407/hornet"

# Tokenizer files to upload (patched for JS compatibility)
TOKENIZER_FILES = [
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "chat_template.jinja",
]

def get_folder(name):
    if os.path.exists(name):
        return name
    alt = f"trainer/{name}"
    if os.path.exists(alt):
        return alt
    print(f"❌ Error: Cannot find '{name}' directory.")
    sys.exit(1)

def push_onnx_variant(api, target_dir, format_name):
    folder_path = get_folder(target_dir)
    print(f"\n📦 Uploading {format_name.upper()} ONNX model from '{folder_path}' to 'onnx/{format_name}'...")
    uploaded = False
    for item in os.listdir(folder_path):
        if item.endswith(".onnx"):
            api.upload_file(
                path_or_fileobj=os.path.join(folder_path, item),
                path_in_repo=f"onnx/{format_name}/{item}",
                repo_id=REPO_ID,
                repo_type="model",
            )
            uploaded = True
    if uploaded:
        print(f"✅ {format_name.upper()} ONNX model uploaded.")
    else:
        print(f"⚠️  No .onnx files found in {folder_path}!")

def push_onnx(api):
    format_name = os.environ.get("FORMAT_NAME", "int8")
    
    if format_name == "all":
        push_onnx_variant(api, "fine_tuned_smollm_onnx", "int8")
        push_onnx_variant(api, "fine_tuned_smollm_onnx_fp16", "fp16")
        push_onnx_variant(api, "fine_tuned_smollm_onnx_fp32", "fp32")
    else:
        target_dir = os.environ.get("ONNX_MODEL_DIR", "fine_tuned_smollm_onnx")
        push_onnx_variant(api, target_dir, format_name)

def push_tokenizer(api):
    source_dir = get_folder("fine_tuned_smollm")
    print(f"\n📦 Uploading tokenizer files from '{source_dir}' ...")

    with tempfile.TemporaryDirectory() as tmpdir:
        copied = []
        for fname in TOKENIZER_FILES:
            src = os.path.join(source_dir, fname)
            if os.path.exists(src):
                dst = os.path.join(tmpdir, fname)
                shutil.copy2(src, dst)
                copied.append(fname)
            else:
                print(f"  ⚠️  Skipping {fname} (not found locally)")

        # Patch tokenizer_config.json for @huggingface/transformers JS compatibility
        tc_path = os.path.join(tmpdir, "tokenizer_config.json")
        if os.path.exists(tc_path):
            with open(tc_path) as f:
                tc = json.load(f)

            # JS library requires PreTrainedTokenizerFast, not GPT2Tokenizer
            tc["tokenizer_class"] = "PreTrainedTokenizerFast"

            # extra_special_tokens must be a list of token strings for JS
            # (dict with arbitrary keys causes errors in @huggingface/transformers)
            est = tc.get("extra_special_tokens", {})
            if isinstance(est, dict):
                tc["extra_special_tokens"] = list(est.values())
            elif not isinstance(est, list):
                tc["extra_special_tokens"] = []

            # Remove Python-only / local-only fields
            for key in ["is_local", "local_files_only", "backend", "errors"]:
                tc.pop(key, None)

            with open(tc_path, "w") as f:
                json.dump(tc, f, indent=2)
            print("  ✓ Patched tokenizer_config.json for JS compatibility")

        for fname in copied:
            api.upload_file(
                path_or_fileobj=os.path.join(tmpdir, fname),
                path_in_repo=fname,
                repo_id=REPO_ID,
                repo_type="model",
            )
            print(f"  ↑ {fname}")

    print("✅ Tokenizer uploaded.")

def main():
    token = os.environ.get("HF_TOKEN")
    api = HfApi(token=token)

    print(f"🚀 Pushing to https://huggingface.co/{REPO_ID}")
    api.create_repo(repo_id=REPO_ID, repo_type="model", exist_ok=True)

    try:
        push_onnx(api)
        push_tokenizer(api)
        print(f"\n✅ All done! https://huggingface.co/{REPO_ID}")
    except Exception as e:
        print(f"\n❌ Upload failed: {e}")
        print("Run 'huggingface-cli login' or set HF_TOKEN env var.")

if __name__ == "__main__":
    main()
