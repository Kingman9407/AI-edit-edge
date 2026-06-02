import os
import sys
import requests

# Ensure the user has provided the token
token = os.environ.get("BLOB_READ_WRITE_TOKEN")
if not token:
    print("❌ Error: Missing BLOB_READ_WRITE_TOKEN environment variable.")
    print("Please set it in your terminal before running this script.")
    print("Example: export BLOB_READ_WRITE_TOKEN='your-token-here'")
    sys.exit(1)

model_path = "trainer/fine_tuned_smollm_onnx/model.onnx"
# If running from inside the trainer folder:
if not os.path.exists(model_path):
    model_path = "fine_tuned_smollm_onnx/model.onnx"
    if not os.path.exists(model_path):
        print(f"❌ Error: Cannot find model.onnx")
        sys.exit(1)

print(f"Starting upload of {model_path} to Vercel Blob...")
print("This is a large file (166MB), so it might take a minute or two...")

url = "https://blob.vercel-storage.com/models/model.onnx"
headers = {
    "Authorization": f"Bearer {token}",
    "x-api-version": "7",
    "x-add-random-suffix": "false",
    "x-vercel-blob-access": "private"
}

with open(model_path, "rb") as f:
    response = requests.put(url, headers=headers, data=f)

if response.status_code == 200:
    data = response.json()
    print("\n✅ Upload successful!")
    print("🎉 Your public Vercel Blob URL is:")
    print(data.get("url"))
    print("\nYou can now copy this URL and update MODEL_URL in app/ui/hooks/useEdgeLLM.ts")
else:
    print(f"\n❌ Upload failed: {response.status_code}")
    print(response.text)
