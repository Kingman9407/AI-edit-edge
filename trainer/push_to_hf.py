import os
import sys
from huggingface_hub import HfApi

def main():
    token = os.environ.get("HF_TOKEN")
    api = HfApi(token=token)
    
    repo_id = "Kingman9407/hornet"
    folder_path = "fine_tuned_smollm_onnx"

    # Check paths depending on where the script is run from
    if not os.path.exists(folder_path):
        folder_path = "trainer/fine_tuned_smollm_onnx"
        if not os.path.exists(folder_path):
            print(f"❌ Error: Cannot find the '{folder_path}' directory.")
            sys.exit(1)

    print(f"🚀 Preparing to push to Hugging Face...")
    print(f"📦 Repository: https://huggingface.co/{repo_id}")
    print("⏳ Uploading files. This might take a moment...")
    
    try:
        # Ensure the repository exists
        api.create_repo(repo_id=repo_id, repo_type="model", exist_ok=True)
        
        # Upload the directory
        api.upload_folder(
            folder_path=folder_path,
            repo_id=repo_id,
            repo_type="model"
        )
        print(f"\n✅ Successfully uploaded to https://huggingface.co/{repo_id}")
        
    except Exception as e:
        print(f"\n❌ Upload failed: {e}")
        print("\nMake sure you are logged in to Hugging Face. You can login by running:")
        print("huggingface-cli login")

if __name__ == "__main__":
    main()
