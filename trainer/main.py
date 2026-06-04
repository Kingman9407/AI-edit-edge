import sys
import subprocess
import os

def run_script(script_name, env_vars: dict = None):
    """Run a python script using the active interpreter."""
    print(f"\n⚡ Launching {script_name}...")
    print("=" * 70)
    env = os.environ.copy()
    if env_vars:
        env.update(env_vars)
    try:
        result = subprocess.run([sys.executable, script_name], check=True, env=env)
        return result.returncode == 0
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error: Failed to execute {script_name} ({e})")
        return False
    except KeyboardInterrupt:
        print("\n\n⚠️ Process cancelled by user.")
        return False


# ──────────────────────────────────────────────────────────────────────────────
# Sub-menu: CHAT
# ──────────────────────────────────────────────────────────────────────────────

def chat_menu():
    int8_exists  = os.path.exists("./fine_tuned_smollm_onnx/model.onnx")
    fp32_exists  = os.path.exists("./fine_tuned_smollm_onnx_fp32/model.onnx")

    while True:
        print("\n" + "=" * 70)
        print("  💬  CHAT MODE  — pick your model")
        print("=" * 70)
        print(f"  [A]  PyTorch float32    (MPS/CPU)  — ground truth")
        print(f"  [B]  ONNX INT8          {'✅' if int8_exists else '❌ missing'}  — web worker exact replica")
        print(f"  [C]  ONNX FP32          {'✅' if fp32_exists else '❌ missing'}  — full precision ONNX")
        print(f"  [0]  ← Back")
        print("=" * 70)
        choice = input("Choice: ").strip().upper()

        if choice == "A":
            run_script("chat_agent.py")
        elif choice == "B":
            if not int8_exists:
                print("❌ ONNX INT8 model not found. Run Convert → INT8 first.")
            else:
                run_script("chat_onnx.py", {"ONNX_MODEL_OVERRIDE": "./fine_tuned_smollm_onnx"})
        elif choice == "C":
            if not fp32_exists:
                print("❌ ONNX FP32 model not found. Run Convert → FP32 first.")
            else:
                run_script("chat_onnx.py", {"ONNX_MODEL_OVERRIDE": "./fine_tuned_smollm_onnx_fp32"})
        elif choice == "0":
            break
        else:
            print("⚠️ Invalid choice.")


# ──────────────────────────────────────────────────────────────────────────────
# Sub-menu: COMPARE & ANALYSE
# ──────────────────────────────────────────────────────────────────────────────

def compare_menu():
    int8_exists  = os.path.exists("./fine_tuned_smollm_onnx/model.onnx")
    fp32_exists  = os.path.exists("./fine_tuned_smollm_onnx_fp32/model.onnx")
    base_exists  = os.path.exists("./SmolLM2-135M-Instruct")

    while True:
        print("\n" + "=" * 70)
        print("  🔬  COMPARE & ANALYSE  — side-by-side model comparisons")
        print("=" * 70)
        print(f"  [A]  Untrained base vs Fine-tuned PyTorch   {'✅' if base_exists else '❌ missing base'}")
        print(f"  [B]  PyTorch (float32) vs ONNX INT8         {'✅' if int8_exists else '❌ INT8 missing'}")
        print(f"  [C]  PyTorch (float32) vs ONNX FP32         {'✅' if fp32_exists else '❌ FP32 missing'}")
        print(f"  [D]  ONNX INT8 vs ONNX FP32                 {'✅' if int8_exists and fp32_exists else '❌ one or both missing'}")
        print(f"  [E]  All three: PyTorch + ONNX INT8 + FP32  {'✅' if int8_exists and fp32_exists else '❌ ONNX models missing'}")
        print(f"  [0]  ← Back")
        print("=" * 70)
        choice = input("Choice: ").strip().upper()

        if choice == "A":
            if not base_exists:
                print("❌ Base model not found. Run download_model.py first.")
            else:
                run_script("run_local_llm.py")

        elif choice == "B":
            if not int8_exists:
                print("❌ ONNX INT8 not found.")
            else:
                run_script("test_onnx_model.py",
                           {"COMPARE_MODE": "pytorch_vs_int8"})

        elif choice == "C":
            if not fp32_exists:
                print("❌ ONNX FP32 not found.")
            else:
                run_script("test_onnx_model.py",
                           {"COMPARE_MODE": "pytorch_vs_fp32"})

        elif choice == "D":
            if not (int8_exists and fp32_exists):
                print("❌ Both ONNX models required. Run Convert → Both first.")
            else:
                run_script("test_onnx_model.py",
                           {"COMPARE_MODE": "int8_vs_fp32"})

        elif choice == "E":
            if not (int8_exists and fp32_exists):
                print("❌ Both ONNX models required. Run Convert → Both first.")
            else:
                run_script("test_onnx_model.py",
                           {"COMPARE_MODE": "all_three"})

        elif choice == "0":
            break
        else:
            print("⚠️ Invalid choice.")


# ──────────────────────────────────────────────────────────────────────────────
# Main menu
# ──────────────────────────────────────────────────────────────────────────────

def show_menu():
    int8_exists = os.path.exists("./fine_tuned_smollm_onnx/model.onnx")
    fp32_exists = os.path.exists("./fine_tuned_smollm_onnx_fp32/model.onnx")

    print("\n" + "=" * 70)
    print("      🎬 LOCAL SMOL-LLM VIDEO EDITOR WORKSPACE MANAGER 🎬")
    print("=" * 70)
    print("  [1]  ⚙️   TRAINING     — overwrite data & retrain model (GPU)")
    print("  [2]  💬  CHAT         — talk to any model variant")
    print(f"  [3]  🔬  COMPARE      — side-by-side analysis (INT8={'✅' if int8_exists else '❌'} FP32={'✅' if fp32_exists else '❌'})")
    print("  [4]  📦  CONVERT      — export PyTorch → ONNX (INT8 / FP32 / Both)")
    print("  [5]  ❌  EXIT")
    print("=" * 70)


def main():
    base_model_path = "./SmolLM2-135M-Instruct"
    if not os.path.exists(base_model_path):
        print("📥 Base model not found. Downloading first...")
        run_script("download_model.py")

    while True:
        show_menu()
        try:
            choice = input("Enter choice (1-5): ").strip()
            if choice == "1":
                print("\n⚙️  Overwriting training data with video editor samples...")
                run_script("prepare_data.py")
                print("\n🚀 Starting GPU-accelerated Fine-Tuning...")
                run_script("train.py")
                print("\n✅ Training pipeline completed!")
            elif choice == "2":
                chat_menu()
            elif choice == "3":
                compare_menu()
            elif choice == "4":
                print("\n📦 Launching ONNX converter...")
                run_script("convert_to_onnx.py")
            elif choice == "5" or choice.lower() in ["exit", "quit"]:
                print("\nGoodbye! Happy editing! 🎬")
                sys.exit(0)
            else:
                print("\n⚠️  Invalid selection. Please enter 1-5.")
            print()
        except (KeyboardInterrupt, EOFError):
            print("\n\nGoodbye!")
            break


if __name__ == "__main__":
    main()
