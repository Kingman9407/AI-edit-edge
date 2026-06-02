# Fine-Tuned SmolLM2-135M (INT8 ONNX)

This directory contains the highly optimized, dynamically quantized INT8 ONNX version of the fine-tuned SmolLM2-135M model.

## What is this model for?
This model was trained to act as a local LLM assistant for the video editor / web application. 

### Model Goal & Capabilities
The primary goal of the model is to function as a natural language processing (NLP) assistant that analyzes a user's video editing request and translates it into actionable timeline operations. 

It specifically outputs a **raw JSON object** with the following structure:
- `message`: A natural language response explaining the action taken.
- `operations`: A list of video editing actions (e.g., `"cut"`, `"mute"`, `"add_audio_overlay"`) along with their respective start and end timestamps.

### Expected Input Structure
The model is fine-tuned to accept the standard **ChatML format**. A typical input prompt includes:
1. **System Instruction**: Defining the assistant's role ("Hornet") and enforcing strict JSON-only output without markdown fencing.
2. **Context**: Video metadata, current timeline state (cuts, mutes, etc.), recent edits, and the last action taken.
3. **User Request**: The natural language instruction from the user (e.g., "Mute the video from 0 to 5 seconds").

By converting the PyTorch weights into INT8 ONNX format, this model achieves:
- **Reduced Memory Footprint**: INT8 quantization drastically reduces the model's size, allowing it to run smoothly on consumer hardware, edge devices, or directly within a web browser.
- **Increased Inference Speed**: Optimized for fast CPU, Apple Silicon (MPS), or WebAssembly/WebGPU execution, making it perfect for real-time edge AI tasks without server latency.
- **KV Cache Support**: Exported with `past_key_values` for highly efficient, streaming text generation.

## Usage in Python (Optimum)
If you want to test or run this model in a local Python environment, you can use the `optimum` library:

```python
from optimum.onnxruntime import ORTModelForCausalLM
from transformers import AutoTokenizer

# Load the optimized ONNX model
model_dir = './fine_tuned_smollm_onnx'
model = ORTModelForCausalLM.from_pretrained(model_dir, provider='CPUExecutionProvider')
tokenizer = AutoTokenizer.from_pretrained(model_dir)

# Run inference
inputs = tokenizer("Hello, I need help editing a video.", return_tensors="pt")
outputs = model.generate(**inputs, max_length=50)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))
```

## Usage in Web Apps (Transformers.js)
Because this model is in standard ONNX format, it is ready to be loaded in a Next.js, React, or Vanilla JS frontend using [Transformers.js](https://huggingface.co/docs/transformers.js/index). 

This allows you to run the LLM entirely in the user's browser via WebAssembly or WebGPU, providing a 100% private, zero-latency inference experience.
