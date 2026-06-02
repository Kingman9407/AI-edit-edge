# Hornet: AI-Powered Video Editor Assistant 🎬

Hornet is an intelligent, natural-language video editing assistant that runs entirely in your browser. It uses a custom fine-tuned Small Language Model (SLM) based on `SmolLM2-135M-Instruct` to translate natural language requests (like "mute the next 5 seconds" or "cut the intro") into structured JSON operations that control a web-based video timeline.

## Features ✨

* **100% Client-Side Inference:** The AI runs completely inside the browser using WebAssembly (WASM) and ONNX Runtime Web. No backend servers are required, resulting in fast execution and complete data privacy.
* **Stateless ChatML Architecture:** The AI receives the entire context of the video (metadata, current playhead, timeline cuts, muted sections, and history) on every turn, preventing hallucination and state drift.
* **Custom Fine-Tuned Model:** The underlying `SmolLM2-135M` model has been rigorously fine-tuned on a custom curriculum of video editing instructions to output precise, deterministic JSON structures.

## System Architecture 🏗️

### 1. Web Application (Next.js)
The frontend is a Next.js application that provides the video player and chat interface.
* **Frontend:** React, TailwindCSS, TypeScript.
* **Inference Engine:** `edge-llm.worker.ts` leverages `@xenova/transformers` to run the `.onnx` exported model in a background Web Worker so the main UI thread never blocks.
* **Prompt Construction:** `EdgeChatRunner.ts` builds the ChatML prompt dynamically based on the current state of the video timeline.

### 2. Training Pipeline (Local / Python)
The `trainer/` directory contains the complete PyTorch/Hugging Face pipeline to generate data, fine-tune the model, and export it for the web.

* `prepare_data.py`: Generates the ChatML JSONL dataset from the curriculum modules found in `trainer/training_data/`.
* `train.py`: Fine-tunes the base model using Supervised Fine-Tuning (SFT) with completion-only label masking to ensure it only learns to generate responses, not prompts.
* `convert_to_onnx.py`: Quantizes and exports the PyTorch model into ONNX format for web deployment.
* `chat_agent.py`: A local CLI chat environment to test the fine-tuned PyTorch model directly on your GPU (MPS/CUDA) before exporting.
* `main.py`: Interactive CLI workspace manager for running the above scripts easily.

## Getting Started 🚀

### Running the Web App
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Fine-Tuning the Model Locally (Optional)
If you want to modify the AI's behavior or add to the curriculum, you can re-train the model on your local machine.

1. Navigate to the trainer directory:
   ```bash
   cd trainer
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Open the interactive workspace manager:
   ```bash
   python main.py
   ```
From the interactive menu, you can generate new data, trigger a fine-tuning run, test the agent in your terminal, or export it to ONNX for the web application.

## Troubleshooting 🔧
* **Tokenizer Error on Web:** Ensure that `tokenizer_config.json` is present alongside `model.onnx` in the web application's model directory, and that it contains `{"tokenizer_class": "PreTrainedTokenizerFast"}`.
* **Training Hallucinations/Infinite Generation:** If retraining, ensure your `pad_token_id` is distinctly separated and properly masked (`-100`) in the labels, and that the ChatML template includes a trailing newline after `<|im_end|>`.
