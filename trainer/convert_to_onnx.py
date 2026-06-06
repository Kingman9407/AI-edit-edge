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

    try:
        import onnxconverter_common
    except ImportError:
        missing_libs.append("onnxconverter-common")

    if missing_libs:
        print(f"\n{Colors.WARNING}⚠️  Missing required packages for ONNX conversion: {', '.join(missing_libs)}{Colors.END}")
        print(f"To export model successfully, we need the Hugging Face 'optimum' exporter and 'onnxruntime'.")
        
        # Ask user for permission to install or display command
        install_cmd = "pip install \"optimum[onnxruntime]\" onnx onnxconverter-common"
        print(f"\n👉 Please run the following command to install the required packages:")
        print(f"   {Colors.BOLD}{Colors.GREEN}{install_cmd}{Colors.END}\n")
        
        choice = input("Would you like to attempt automated installation now? (y/n): ").strip().lower()
        if choice == 'y':
            try:
                print(f"⚡ Running: {install_cmd}...")
                subprocess.check_call([sys.executable, "-m", "pip", "install", "optimum[onnxruntime]", "onnx", "onnxconverter-common"])
                print(f"✅ {Colors.GREEN}Dependencies successfully installed!{Colors.END}\n")
                return True
            except subprocess.CalledProcessError as e:
                print(f"\n{Colors.WARNING}⚠️  Automated installation failed.{Colors.END}")
                print(f"This environment appears to be externally managed (PEP 668), standard pip installation is blocked.")
                print(f"\nYou have two options to resolve this:")
                print(f" 1. Use a virtual environment (Recommended):")
                print(f"    python3 -m venv .venv")
                print(f"    source .venv/bin/activate")
                print(f"    pip install \"optimum[onnxruntime]\" onnx onnxconverter-common")
                print(f" 2. Bypass this environment check by adding '--break-system-packages':")
                print(f"    python3 -m pip install \"optimum[onnxruntime]\" onnx onnxconverter-common --break-system-packages")
                
                choice2 = input("\nWould you like to install using '--break-system-packages' now? (y/n): ").strip().lower()
                if choice2 == 'y':
                    try:
                        print(f"⚡ Running pip with --break-system-packages...")
                        subprocess.check_call([sys.executable, "-m", "pip", "install", "optimum[onnxruntime]", "onnx", "onnxconverter-common", "--break-system-packages"])
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

def convert_fp32(model_path, final_output_dir):
    """
    Exports a pure float32 ONNX model — NO quantization.
    Larger file but identical precision to the original PyTorch model.
    """
    from optimum.exporters.onnx import main_export

    abs_model_path     = os.path.abspath(model_path)
    abs_final_output_dir = os.path.abspath(final_output_dir)

    print(f"{Colors.HEADER}============================================================{Colors.END}")
    print(f"🚀 {Colors.BOLD}STARTING FLOAT32 ONNX EXPORT{Colors.END}")
    print(f"   Source Model Path : {Colors.GREEN}{abs_model_path}{Colors.END}")
    print(f"   Output Folder     : {Colors.GREEN}{abs_final_output_dir}{Colors.END}")
    print(f"{Colors.HEADER}============================================================{Colors.END}\n")

    if os.path.exists(abs_final_output_dir):
        print(f"🧹 Clearing existing folder at {abs_final_output_dir}...")
        shutil.rmtree(abs_final_output_dir)
    os.makedirs(abs_final_output_dir, exist_ok=True)

    print("⚡ [1/1] Exporting PyTorch weights to float32 ONNX (no quantization)...")
    try:
        main_export(
            model_name_or_path=abs_model_path,
            output=abs_final_output_dir,
            task="causal-lm-with-past",
            no_post_process=False,
        )
        print(f"✅ Float32 ONNX exported successfully to {abs_final_output_dir}")
    except Exception as e:
        print(f"\n❌ {Colors.FAIL}Float32 export failed: {e}{Colors.END}")
        shutil.rmtree(abs_final_output_dir)
        sys.exit(1)

def convert_fp16(model_path, final_output_dir):
    """
    Exports a float16 ONNX model by first exporting to FP32 and then 
    converting to FP16 using onnxconverter_common.
    """
    from optimum.exporters.onnx import main_export
    import onnx
    from onnxconverter_common import float16

    abs_model_path     = os.path.abspath(model_path)
    abs_final_output_dir = os.path.abspath(final_output_dir)
    temp_dir = abs_final_output_dir + "_temp_fp32"

    print(f"{Colors.HEADER}============================================================{Colors.END}")
    print(f"🚀 {Colors.BOLD}STARTING FLOAT16 ONNX EXPORT{Colors.END}")
    print(f"   Source Model Path : {Colors.GREEN}{abs_model_path}{Colors.END}")
    print(f"   Output Folder     : {Colors.GREEN}{abs_final_output_dir}{Colors.END}")
    print(f"{Colors.HEADER}============================================================{Colors.END}\n")

    for path in [temp_dir, abs_final_output_dir]:
        if os.path.exists(path):
            print(f"🧹 Clearing existing folder at {path}...")
            shutil.rmtree(path)
    os.makedirs(temp_dir, exist_ok=True)
    os.makedirs(abs_final_output_dir, exist_ok=True)

    print("⚡ [1/2] Exporting PyTorch weights to FP32 ONNX...")
    try:
        main_export(
            model_name_or_path=abs_model_path,
            output=temp_dir,
            task="causal-lm-with-past",
            no_post_process=False,
        )
    except Exception as e:
        print(f"\n❌ {Colors.FAIL}FP32 export failed: {e}{Colors.END}")
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        sys.exit(1)

    print("\n⚡ [2/2] Converting ONNX model to Float16...")
    try:
        # Copy configuration files
        for item in os.listdir(temp_dir):
            src_path = os.path.join(temp_dir, item)
            dst_path = os.path.join(abs_final_output_dir, item)
            if os.path.isfile(src_path) and not item.endswith(".onnx"):
                shutil.copy2(src_path, dst_path)

        # Convert ONNX files to FP16
        for item in os.listdir(temp_dir):
            if item.endswith(".onnx"):
                src_onnx = os.path.join(temp_dir, item)
                dst_onnx = os.path.join(abs_final_output_dir, item)
                print(f"   ⚙️  Converting {item} to FP16...")
                model = onnx.load(src_onnx)
                model_fp16 = float16.convert_float_to_float16(model, keep_io_types=True)
                onnx.save(model_fp16, dst_onnx)
                
        # Clean up temporary FP32 directory
        shutil.rmtree(temp_dir)
        print(f"✅ Float16 ONNX exported successfully to {abs_final_output_dir}")
    except Exception as e:
        print(f"\n❌ {Colors.FAIL}Float16 conversion failed: {e}{Colors.END}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(
        description="Convert local SmolLM2 weights to ONNX (INT8 quantized or float32)."
    )
    parser.add_argument("--model",  type=str, default=None,
                        help="Path to PyTorch model directory (default: auto-detect)")
    parser.add_argument("--output", type=str, default=None,
                        help="Base output directory name (suffixes _onnx / _onnx_fp16 / _onnx_fp32 added)")
    parser.add_argument("--format", type=str, default=None,
                        choices=["int8", "fp16", "fp32", "all"],
                        help="Export format: int8, fp16, fp32, or all (default: prompt user)")
    args = parser.parse_args()

    # 1. Check dependencies
    check_dependencies()

    # 2. Auto-detect model
    model_path = args.model
    if not model_path:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        finetuned_candidates = [
            "./fine_tuned_smollm",
            os.path.join(script_dir, "fine_tuned_smollm"),
        ]
        base_candidates = [
            "./SmolLM2-135M-Instruct",
            os.path.join(script_dir, "SmolLM2-135M-Instruct"),
        ]
        for cand in finetuned_candidates:
            if os.path.exists(cand) and (
                any(f.endswith(".safetensors") for f in os.listdir(cand)) or
                any(f.endswith(".bin") for f in os.listdir(cand))
            ):
                model_path = os.path.abspath(cand)
                print(f"✨ {Colors.GREEN}Detected Fine-Tuned Model at {model_path}!{Colors.END}")
                break
        if not model_path:
            for cand in base_candidates:
                if os.path.exists(cand) and os.path.isdir(cand):
                    model_path = os.path.abspath(cand)
                    print(f"💡 {Colors.BLUE}Detected Base Model at {model_path}.{Colors.END}")
                    break
        if not model_path:
            print(f"❌ {Colors.FAIL}No local model weights found!{Colors.END}")
            print("Run download_model.py or train.py first.")
            sys.exit(1)

    # 3. Ask which format if not provided via CLI
    fmt = args.format
    if not fmt:
        print("\n" + "=" * 60)
        print("  Select ONNX export format:")
        print("  [1]  INT8 quantized  — smaller (~137 MB), used by web worker")
        print("  [2]  Float16         — medium  (~270 MB), good precision/size balance")
        print("  [3]  Float32         — larger  (~500 MB), full precision")
        print("  [4]  All three       — exports INT8, FP16, and FP32 side-by-side")
        print("=" * 60)
        choice = input("Choice (1/2/3/4): ").strip()
        fmt = {"1": "int8", "2": "fp16", "3": "fp32", "4": "all"}.get(choice, "int8")
        print(f"Selected: {fmt.upper()}\n")

    # Determine output paths
    base_out = args.output or (model_path.rstrip("/") + "_onnx")
    fp16_out = base_out + "_fp16"
    fp32_out = base_out + "_fp32"

    # 4. Run selected export(s)
    if fmt in ("int8", "all"):
        convert_and_quantize(model_path, base_out)
        print("\n" + "=" * 60)
        print(f"🎉 {Colors.BOLD}{Colors.GREEN}INT8 ONNX → {os.path.abspath(base_out)}{Colors.END}")
        print("=" * 60)

    if fmt in ("fp16", "all"):
        convert_fp16(model_path, fp16_out)
        print("\n" + "=" * 60)
        print(f"🎉 {Colors.BOLD}{Colors.GREEN}FP16 ONNX → {os.path.abspath(fp16_out)}{Colors.END}")
        print("=" * 60)

    if fmt in ("fp32", "all"):
        convert_fp32(model_path, fp32_out)
        print("\n" + "=" * 60)
        print(f"🎉 {Colors.BOLD}{Colors.GREEN}FP32 ONNX → {os.path.abspath(fp32_out)}{Colors.END}")
        print("=" * 60)


if __name__ == "__main__":
    main()

