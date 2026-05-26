import sys
import subprocess
import os

def run_script(script_name):
    """Utility to run a python script in the current process using the active python interpreter."""
    print(f"\n⚡ Launching {script_name}...")
    print("=" * 70)
    try:
        # Run using the same python interpreter running this main script
        result = subprocess.run([sys.executable, script_name], check=True)
        return result.returncode == 0
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error: Failed to execute {script_name} ({e})")
        return False
    except KeyboardInterrupt:
        print("\n\n⚠️ Process cancelled by user.")
        return False

def show_menu():
    print("=" * 70)
    print("      🎬 LOCAL SMOL-LLM VIDEO EDITOR WORKSPACE MANAGER 🎬")
    print("=" * 70)
    print("Please select an operating mode:")
    print("  [1] ⚙️  TRAINING MODE: Overwrite data & retrain Video Editor Model (GPU)")
    print("  [2] 💬  CHAT MODE: Start clean, normal chat with your Trained Agent")
    print("  [3] 📊  COMPARISON: Compare original untrained vs. trained LLM")
    print("  [4] ❌  EXIT")
    print("=" * 70)

def main():
    # Verify that the base model has been downloaded first
    base_model_path = "./SmolLM2-135M-Instruct"
    if not os.path.exists(base_model_path):
        print("📥 Local base model directory not found. Initiating model download first...")
        run_script("download_model.py")
    
    while True:
        show_menu()
        try:
            choice = input("Enter choice (1-4): ").strip()
            if choice == "1":
                print("\n⚙️ Overwriting training data with video editor samples...")
                run_script("prepare_data.py")
                print("\n🚀 Starting GPU-accelerated Fine-Tuning...")
                run_script("train.py")
                print("\n✅ Training pipeline completed!")
            elif choice == "2":
                print("\n💬 Initializing Video Editor Agent Chat session...")
                run_script("chat_agent.py")
            elif choice == "3":
                print("\n📊 Launching model performance comparison...")
                run_script("run_local_llm.py")
            elif choice == "4" or choice.lower() in ["exit", "quit"]:
                print("\nGoodbye! Happy editing!")
                sys.exit(0)
            else:
                print("\n⚠️ Invalid selection. Please enter a number between 1 and 4.")
            
            print("\n")
        except (KeyboardInterrupt, EOFError):
            print("\n\nGoodbye!")
            break

if __name__ == "__main__":
    main()
