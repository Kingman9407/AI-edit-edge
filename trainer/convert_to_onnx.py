#!/usr/bin/env python3
"""
ONNX Model Converter for SmolLM2 Video Editor Model
This script converts PyTorch/Safetensors weights of the fine-tuned SmolLM2 model
(or the base SmolLM2-135M-Instruct model) to a highly optimized INT8 ONNX format.
It exports with past key values (KV Cache) and applies dynamic INT8 quantization,
leaving exactly ONE clean output directory.
"""

import os
import sys
import argparse
import subprocess
import shutil

# Highlight terminal colors
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'

def check_dependencies():
    """Checks if required Optimum & ONNX Runtime dependencies are installed."""
    print(f"{Colors.BLUE}🔍 Checking required libraries...{Colors.END}")
    
    missing_libs = []
    
    try:
        import optimum
    except ImportError:
        missing_libs.append("optimum")
        
    try:
        import onnxruntime
    except ImportError:
        missing_libs.append("onnxruntime")
        
    try:
        import onnx
    except ImportError:
        missing_libs.append("onnx")

    if missing_libs:
        print(f"\n{Colors.WARNING}⚠️  Missing required packages for ONNX conversion: {', '.join(missing_libs)}{Colors.END}")
        print(f"To export model successfully, we need the Hugging Face 'optimum' exporter and 'onnxruntime'.")
        
        # Ask user for permission to install or display command
        install_cmd = "pip install \"optimum[onnxruntime]\" onnx"
        print(f"\n👉 Please run the following command to install the required packages:")
        print(f"   {Colors.BOLD}{Colors.GREEN}{install_cmd}{Colors.END}\n")
        
        choice = input("Would you like to attempt automated installation now? (y/n): ").strip().lower()
        if choice == 'y':
            try:
                print(f"⚡ Running: {install_cmd}...")
                subprocess.check_call([sys.executable, "-m", "pip", "install", "optimum[onnxruntime]", "onnx"])
                print(f"✅ {Colors.GREEN}Dependencies successfully installed!{Colors.END}\n")
                return True
            except subprocess.CalledProcessError as e:
                print(f"\n{Colors.WARNING}⚠️  Automated installation failed.{Colors.END}")
                print(f"This environment appears to be externally managed (PEP 668), standard pip installation is blocked.")
                print(f"\nYou have two options to resolve this:")
                print(f" 1. Use a virtual environment (Recommended):")
                print(f"    python3 -m venv .venv")
                print(f"    source .venv/bin/activate")
                print(f"    pip install \"optimum[onnxruntime]\" onnx")
                print(f" 2. Bypass this environment check by adding '--break-system-packages':")
                print(f"    python3 -m pip install \"optimum[onnxruntime]\" onnx --break-system-packages")
                
                choice2 = input("\nWould you like to install using '--break-system-packages' now? (y/n): ").strip().lower()
                if choice2 == 'y':
                    try:
                        print(f"⚡ Running pip with --break-system-packages...")
                        subprocess.check_call([sys.executable, "-m", "pip", "install", "optimum[onnxruntime]", "onnx", "--break-system-packages"])
                        print(f"✅ {Colors.GREEN}Dependencies successfully installed!{Colors.END}\n")
                        return True
                    except Exception as e2:
                        print(f"❌ {Colors.FAIL}Failed to install dependencies with --break-system-packages: {e2}{Colors.END}")
                        sys.exit(1)
                else:
                    print("Export aborted. Please set up a virtual environment or install dependencies manually.")
                    sys.exit(1)
            except Exception as e:
                print(f"❌ {Colors.FAIL}Failed to install dependencies automatically: {e}{Colors.END}")
                sys.exit(1)
        else:
            print("Export aborted. Please install dependencies and run the script again.")
            sys.exit(1)
    else:
        print(f"✅ {Colors.GREEN}All required libraries are installed!{Colors.END}\n")
        return True

def convert_and_quantize(model_path, final_output_dir):
    """
    Performs standard ONNX export to a temporary folder, executes dynamic INT8 quantization,
    copies config/tokenizer files, and saves everything in ONE clean output directory.
    """
    from optimum.exporters.onnx import main_export
    from optimum.onnxruntime import ORTQuantizer
    from optimum.onnxruntime.configuration import AutoQuantizationConfig
    
    abs_model_path = os.path.abspath(model_path)
    abs_final_output_dir = os.path.abspath(final_output_dir)
    
    # Establish a clean temporary workspace
    temp_export_dir = abs_final_output_dir + "_temp_raw"
    
    print(f"{Colors.HEADER}============================================================{Colors.END}")
    print(f"🚀 {Colors.BOLD}STARTING OPTIMIZED INT8 ONNX PIPELINE{Colors.END}")
    print(f"   Source Model Path: {Colors.GREEN}{abs_model_path}{Colors.END}")
    print(f"   Final ONNX Folder: {Colors.GREEN}{abs_final_output_dir}{Colors.END}")
    print(f"{Colors.HEADER}============================================================{Colors.END}\n")
    
    # Clear previous folder structures if they exist
    for path in [temp_export_dir, abs_final_output_dir]:
        if os.path.exists(path):
            print(f"🧹 Clearing existing folder at {path}...")
            shutil.rmtree(path)
            
    os.makedirs(temp_export_dir, exist_ok=True)
    os.makedirs(abs_final_output_dir, exist_ok=True)
    
    # Step 1: Export to standard ONNX in a temp folder
    print("\n⚡ [1/3] Exporting PyTorch weights to ONNX format...")
    try:
        main_export(
            model_name_or_path=abs_model_path,
            output=temp_export_dir,
            task="causal-lm-with-past",
            no_post_process=False
        )
        print(f"✅ Full-precision ONNX models successfully exported to temporary folder.")
    except Exception as e:
        print(f"\n❌ {Colors.FAIL}Export failed: {e}{Colors.END}")
        if os.path.exists(temp_export_dir):
            shutil.rmtree(temp_export_dir)
        sys.exit(1)
        
    # Step 2: Quantize raw exported ONNX directly
    print("\n⚙️  [2/3] Performing Dynamic INT8 Quantization...")
    try:
        onnx_files = [f for f in os.listdir(temp_export_dir) if f.endswith(".onnx")]
        
        for onnx_file in onnx_files:
            print(f"   ⚡ Quantizing {onnx_file}...")
            quantizer = ORTQuantizer.from_pretrained(temp_export_dir, file_name=onnx_file)
            
            # Select CPU quantization configuration based on system platform
            if sys.platform == "darwin":
                # Apple Silicon optimized
                qconfig = AutoQuantizationConfig.arm64(is_static=False, per_channel=True)
            else:
                # Intel/AMD x86 optimized fusions
                qconfig = AutoQuantizationConfig.avx512_vnni(is_static=False, per_channel=True)
                
            quantizer.quantize(
                save_dir=abs_final_output_dir,
                quantization_config=qconfig,
                file_suffix="quant"
            )
            
        # Rename output files to standard names in final directory (removing "_quant" suffix)
        for item in os.listdir(abs_final_output_dir):
            if item.endswith("quant.onnx"):
                standard_name = item.replace("_quant.onnx", ".onnx")
                shutil.move(
                    os.path.join(abs_final_output_dir, item),
                    os.path.join(abs_final_output_dir, standard_name)
                )
                
        print(f"✅ Quantization complete. 8-bit weights successfully compiled.")
    except Exception as e:
        print(f"\n❌ {Colors.FAIL}Quantization failed: {e}{Colors.END}")
        print("Cleaning up workspace...")
        shutil.rmtree(temp_export_dir)
        shutil.rmtree(abs_final_output_dir)
        sys.exit(1)
        
    # Step 3: Copy config, tokenizer, and JSON files to final directory, then clean up
    print("\n📦 [3/3] Finalizing file system and cleaning workspace...")
    try:
        # Copy configuration/tokenizer assets from temporary folder
        for item in os.listdir(temp_export_dir):
            src_path = os.path.join(temp_export_dir, item)
            dst_path = os.path.join(abs_final_output_dir, item)
            
            # Copy all files except non-quantized raw ONNX models
            if os.path.isfile(src_path) and not item.endswith(".onnx"):
                shutil.copy2(src_path, dst_path)
                
        # Remove the temporary export folder completely
        shutil.rmtree(temp_export_dir)
        print(f"✅ Temporary workspace cleared successfully.")
    except Exception as e:
        print(f"⚠️  Warning during workspace cleanup: {e}")

def main():
    parser = argparse.ArgumentParser(description="Convert local SmolLM2 weights to a single optimized INT8 ONNX directory.")
    parser.add_argument("--model", type=str, default=None, help="Path to PyTorch model directory (default: auto-detect)")
    parser.add_argument("--output", type=str, default=None, help="Output directory for final INT8 ONNX model")
    args = parser.parse_args()
    
    # 1. Enforce/Check Dependencies
    check_dependencies()
    
    # 2. Auto-detect models if not provided
    model_path = args.model
    if not model_path:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Check potential candidate locations for fine-tuned and base models
        finetuned_candidates = [
            "./fine_tuned_smollm",
            os.path.join(script_dir, "fine_tuned_smollm")
        ]
        base_candidates = [
            "./SmolLM2-135M-Instruct",
            os.path.join(script_dir, "SmolLM2-135M-Instruct")
        ]
        
        # Resolve fine-tuned path
        for cand in finetuned_candidates:
            if os.path.exists(cand) and (
                any(f.endswith(".safetensors") for f in os.listdir(cand)) or 
                any(f.endswith(".bin") for f in os.listdir(cand))
            ):
                model_path = os.path.abspath(cand)
                print(f"✨ {Colors.GREEN}Detected Fine-Tuned Model at {model_path}!{Colors.END}")
                break
                
        # Fallback to base model path if fine-tuned is not found
        if not model_path:
            for cand in base_candidates:
                if os.path.exists(cand) and os.path.isdir(cand):
                    model_path = os.path.abspath(cand)
                    print(f"💡 {Colors.BLUE}Detected Base Model at {model_path} (Fine-tuned model weights not found).{Colors.END}")
                    break
                    
        if not model_path:
            print(f"❌ {Colors.FAIL}Error: No local model weights found!{Colors.END}")
            print(f"Please run model downloader or training script first to populate weights:")
            print("  - To download base model:  python3 trainer/download_model.py")
            print("  - To train model:          python3 trainer/train.py")
            sys.exit(1)
            
    # Determine final output path (exactly one output folder)
    output_dir = args.output
    if not output_dir:
        output_dir = model_path.rstrip("/") + "_onnx"
        
    # 3. Perform conversion and quantization in one clean pipeline
    convert_and_quantize(model_path, output_dir)
    
    print("\n" + "=" * 60)
    print(f"🎉 {Colors.BOLD}{Colors.GREEN}CONVERSION PIPELINE COMPLETED!{Colors.END}")
    print(f"Your final highly optimized INT8 Turbo ONNX model is stored in:")
    print(f"   👉 {Colors.BOLD}{os.path.abspath(output_dir)}{Colors.END}")
    print("\nTo load and run your optimized model in Python:")
    print(f"   from optimum.onnxruntime import ORTModelForCausalLM")
    print(f"   from transformers import AutoTokenizer")
    print(f"   model = ORTModelForCausalLM.from_pretrained('{output_dir}', provider='CPUExecutionProvider')")
    print(f"   tokenizer = AutoTokenizer.from_pretrained('{output_dir}')")
    print("=" * 60)

if __name__ == "__main__":
    main()
