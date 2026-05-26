import os
from huggingface_hub import snapshot_download

# Define destination directory inside your current workspace folder
local_dir = "./SmolLM2-135M-Instruct"

print(f"📥 Starting download of 'HuggingFaceTB/SmolLM2-135M-Instruct' into your project folder: {os.path.abspath(local_dir)}")

# Download the complete model repository locally
snapshot_download(
    repo_id="HuggingFaceTB/SmolLM2-135M-Instruct",
    local_dir=local_dir,
    local_dir_use_symlinks=False
)

print(f"\n✅ Success! All model files are downloaded and saved in: {os.path.abspath(local_dir)}")
print("\nTo load this local model in Python, you can now run:")
print(f"  pipe = pipeline('text-generation', model='{local_dir}', device='mps')")
