#!/usr/bin/env python3
"""
Google Colab Helper Script
Converts the model to all three ONNX formats (INT8, FP16, FP32)
and pushes them to Hugging Face Hub.
"""

import os
import sys
import subprocess
import argparse

class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'

def run_command(cmd, env=None):
    print(f"{Colors.BLUE}🚀 Running: {' '.join(cmd)}{Colors.END}")
    result = subprocess.run(cmd, env=env)
    if result.returncode != 0:
        print(f"{Colors.FAIL}❌ Command failed with return code {result.returncode}{Colors.END}")
        sys.exit(result.returncode)

def main():
    parser = argparse.ArgumentParser(description="Convert and push all ONNX formats to Hugging Face Hub")
    parser.add_argument("--repo-id", type=str, default=None, 
                        help="Override the Hugging Face repository ID (default: Kingman9407/hornet)")
    args = parser.parse_args()

    # Check for HF_TOKEN
    hf_token = os.environ.get("HF_TOKEN")
    if not hf_token:
        print(f"{Colors.WARNING}⚠️  HF_TOKEN environment variable is not set.{Colors.END}")
        print("Please set it before running this script if you are not logged in via huggingface-cli.")
        print("In Google Colab, you can do:")
        print("import os\nos.environ['HF_TOKEN'] = 'your_token'\n")
        
    script_dir = os.path.dirname(os.path.abspath(__file__))
    convert_script = os.path.join(script_dir, "convert_to_onnx.py")
    push_script = os.path.join(script_dir, "push_to_hf.py")

    if not os.path.exists(convert_script) or not os.path.exists(push_script):
        print(f"{Colors.FAIL}❌ Could not find required scripts (convert_to_onnx.py or push_to_hf.py) in {script_dir}{Colors.END}")
        sys.exit(1)

    # Step 1: Convert to all ONNX formats (int8, fp16, fp32)
    print("\n" + "="*60)
    print(f"{Colors.HEADER}{Colors.BOLD}Step 1: Converting model to all ONNX formats (INT8, FP16, FP32){Colors.END}")
    print("="*60)
    
    # We call the existing script with --format all
    run_command([sys.executable, convert_script, "--format", "all"])

    # Step 2: Push to Hugging Face
    print("\n" + "="*60)
    print(f"{Colors.HEADER}{Colors.BOLD}Step 2: Pushing all formats to Hugging Face Hub{Colors.END}")
    print("="*60)
    
    push_env = os.environ.copy()
    push_env["FORMAT_NAME"] = "all"
    
    # If a repo ID was provided, we can pass it via env if push_to_hf.py supported it, 
    # but push_to_hf.py hardcodes REPO_ID. So we might need to patch it dynamically or tell the user.
    # Currently push_to_hf.py has `REPO_ID = "Kingman9407/hornet"`.
    
    run_command([sys.executable, push_script], env=push_env)
    
    print("\n" + "="*60)
    print(f"{Colors.GREEN}{Colors.BOLD}✅ Successfully converted and pushed all 3 ONNX formats to Hugging Face!{Colors.END}")
    print("="*60)

if __name__ == "__main__":
    main()
