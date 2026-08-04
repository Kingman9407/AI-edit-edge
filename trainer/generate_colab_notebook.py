"""
Generates colab_pipeline.ipynb — the complete self-supervised training notebook.
Run: python3.11 generate_colab_notebook.py
"""
import json, os

cells = []

def md(source): cells.append({"cell_type":"markdown","metadata":{},"source":[source]})
def code(source): cells.append({"cell_type":"code","execution_count":None,"metadata":{},"outputs":[],"source":[source]})

# ── Title ─────────────────────────────────────────────────────────────────────
md("""# 🐝 Hornet AI — Fully Automated Self-Supervised Training Pipeline

**Before running, add these secrets in the left sidebar (🔑 Secrets tab):**

| Secret | Value |
|---|---|
| `HF_TOKEN` | Hugging Face write token |
| `GITHUB_TOKEN` | GitHub personal access token |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Your Supabase anon key |
| `NVIDIA_API_KEY` | `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` |

> **Runtime:** Go to Runtime → Change runtime type → **T4 GPU**

---
The pipeline runs 10 steps automatically:
1. Install deps → 2. Clone repo → 3. Download model → 4. Run test inputs → 5. Store to Supabase → 6. Score logs → 7. Extract dataset → 8. Fine-tune → 9. Export ONNX → 10. Push to HF""")

# ── Cell 1: GPU + Install ─────────────────────────────────────────────────────
md("## Cell 1 — GPU Check & Install Dependencies")
code("""\
import subprocess, sys

r = subprocess.run(['nvidia-smi'], capture_output=True, text=True)
print('✅ GPU detected!' if r.returncode == 0 else '⚠️  No GPU! Go to Runtime → Change runtime type → T4 GPU')
if r.returncode == 0: print(r.stdout[:500])

!pip install -q transformers datasets accelerate huggingface_hub optimum onnxruntime supabase python-dotenv sentence-transformers requests numpy openai
print('\\n✅ All packages installed!')\
""")

# ── Cell 2: Secrets + Clone ───────────────────────────────────────────────────
md("## Cell 2 — Load Secrets & Clone Repo")
code("""\
import os, subprocess
from google.colab import userdata

HF_TOKEN       = userdata.get('HF_TOKEN')
GITHUB_TOKEN   = userdata.get('GITHUB_TOKEN')
SUPABASE_URL   = userdata.get('SUPABASE_URL')
SUPABASE_KEY   = userdata.get('SUPABASE_KEY')
NVIDIA_API_KEY = userdata.get('NVIDIA_API_KEY')

os.environ['HF_TOKEN']                      = HF_TOKEN
os.environ['NEXT_PUBLIC_SUPABASE_URL']      = SUPABASE_URL
os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = SUPABASE_KEY
os.environ['NVIDIA_API_KEY']                = NVIDIA_API_KEY
print('✅ Secrets loaded!')

# ⚠️ Change this to YOUR GitHub repo
GITHUB_REPO = 'Kingman9407/AI-edit-edge'
CLONE_URL   = f'https://{GITHUB_TOKEN}@github.com/{GITHUB_REPO}.git'

if not os.path.exists('/content/repo'):
    r = subprocess.run(['git', 'clone', CLONE_URL, '/content/repo'], capture_output=True, text=True)
    print('✅ Cloned!' if r.returncode == 0 else f'❌ Clone failed:\\n{r.stderr}')
else:
    !cd /content/repo && git pull
    print('✅ Pulled latest.')

TRAINER_DIR = '/content/repo/trainer'
SUPABASE_DIR = f'{TRAINER_DIR}/training_data/supabase_data'
os.chdir(TRAINER_DIR)
print(f'📂 Working dir: {TRAINER_DIR}')\
""")

# ── Cell 3: Download Base Model ───────────────────────────────────────────────
md("## Cell 3 — Download Base Model (SmolLM2-135M-Instruct)")
code("""\
from huggingface_hub import snapshot_download

local_dir = './SmolLM2-135M-Instruct'
if not os.path.exists(local_dir):
    print('📥 Downloading SmolLM2-135M-Instruct from Hugging Face...')
    snapshot_download(
        repo_id='HuggingFaceTB/SmolLM2-135M-Instruct',
        local_dir=local_dir,
        local_dir_use_symlinks=False,
        ignore_patterns=['onnx/*','runs/*','*.bin','*results.json','trainer_state.json','README.md','.gitattributes'],
        token=HF_TOKEN
    )
    print('✅ Base model downloaded!')
else:
    print('✅ Base model already exists, skipping download.')\
""")

# ── Cell 4: Load Model ────────────────────────────────────────────────────────
md("## Cell 4 — Load SmolLM2 Model into Memory")
code("""\
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline as hf_pipeline

# Use fine-tuned model if it exists, otherwise base model
MODEL_PATH = './fine_tuned_smollm'
BASE_PATH  = './SmolLM2-135M-Instruct'
ACTIVE_MODEL = MODEL_PATH if os.path.exists(MODEL_PATH) else BASE_PATH
MODEL_TAG    = 'fine_tuned' if os.path.exists(MODEL_PATH) else 'smollm2-base'

DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f'🚀 Loading {MODEL_TAG} model on {DEVICE.upper()}...')

tokenizer = AutoTokenizer.from_pretrained(ACTIVE_MODEL, local_files_only=True)
tokenizer.pad_token = '<|endoftext|>'
model = AutoModelForCausalLM.from_pretrained(ACTIVE_MODEL, torch_dtype=torch.float32, local_files_only=True).to(DEVICE)
pipe = hf_pipeline('text-generation', model=model, tokenizer=tokenizer, device=DEVICE)

print(f'✅ Model loaded! ({MODEL_TAG})')

SYSTEM_INSTRUCTION = (
    "You are Hornet, a video editing AI. Return JSON with 'message' and 'operations' (cut, mute, add_audio_overlay). "
    "If the user mentions time expressions requiring calculation, output a <tool_call> block first. "
    "Otherwise, output the final JSON directly."
)\
""")

# ── Cell 5: Run Test Inputs + Store ──────────────────────────────────────────
md("## Cell 5 — Run Test Inputs Through Model & Store to Supabase")
code("""\
import sys, time, json
from supabase import create_client

sys.path.insert(0, SUPABASE_DIR)
from test_inputs import ALL_TEST_SETS

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def run_input(user_input):
    prompt = (
        f'<|im_start|>system\\n{SYSTEM_INSTRUCTION}<|im_end|>\\n'
        f'<|im_start|>user\\n{user_input}<|im_end|>\\n'
        f'<|im_start|>assistant\\n'
    )
    out = pipe(prompt, max_new_tokens=256, do_sample=False, pad_token_id=tokenizer.eos_token_id)
    full = out[0]['generated_text']
    reply = full.split('<|im_start|>assistant')[-1] if '<|im_start|>assistant' in full else full[len(prompt):]
    return reply.replace('<|im_end|>', '').strip()

stored = 0
failed = 0

for test_set in ALL_TEST_SETS:
    print(f'\\n📋 {test_set[\"name\"]}')
    print('-' * 50)
    for item in test_set['inputs']:
        try:
            t0 = time.time()
            ai_output = run_input(item['user_input'])
            ms = round((time.time() - t0) * 1000)
            print(f'  ✓ {item[\"id\"]} ({ms}ms): {ai_output[:80]}...')
            supabase.table('ai_logs').insert({
                'user_input': item['user_input'],
                'ai_output':  ai_output,
                'model_name': MODEL_TAG,
            }).execute()
            stored += 1
        except Exception as e:
            print(f'  ✗ {item[\"id\"]} ERROR: {e}')
            failed += 1

print(f'\\n✅ Stored: {stored} | ❌ Failed: {failed}')
print('Next: Cell 6 will score these results.')\
""")

# ── Cell 6: Score Logs ────────────────────────────────────────────────────────
md("## Cell 6 — Score All Unscored Logs (BGE Embedding Model)")
code("""\
import numpy as np
from sentence_transformers import SentenceTransformer

print('Loading scoring model (BAAI/bge-small-en-v1.5)...')
embed_model = SentenceTransformer('BAAI/bge-small-en-v1.5')

unscored = supabase.table('ai_logs').select('*').is_('score', 'null').execute().data
print(f'Found {len(unscored)} unscored logs.')

PASS_THRESHOLD = 55.0
scored = 0
for log in unscored:
    ui, ao = log.get('user_input',''), log.get('ai_output','')
    if not ui or not ao: continue
    embs = embed_model.encode([ui, ao])
    pct  = round(float(np.dot(embs[0],embs[1]) / (np.linalg.norm(embs[0])*np.linalg.norm(embs[1]))) * 100, 2)
    supabase.table('ai_logs').update({'score': pct, 'is_correct': pct >= PASS_THRESHOLD}).eq('id', log['id']).execute()
    status = 'PASS ✅' if pct >= PASS_THRESHOLD else 'FAIL ❌'
    print(f'  {log[\"id\"][:8]}: {pct}% → {status}')
    scored += 1

print(f'\\n✅ Scored {scored} logs with threshold {PASS_THRESHOLD}%')\
""")

# ── Cell 7: Extract Dataset ───────────────────────────────────────────────────
md("## Cell 7 — Extract Passing Logs → Training Dataset")
code("""\
SYSTEM_INSTRUCTION_FULL = (
    "You are Hornet, a video editing AI. Return JSON with 'message' and 'operations' (cut, mute, add_audio_overlay). "
    "If the user mentions time expressions requiring calculation, output a <tool_call> block first. "
    "Otherwise, output the final JSON directly."
)

passing = supabase.table('ai_logs').select('*').eq('is_correct', True).execute().data
print(f'✅ {len(passing)} passing logs found.')

OUTPUT_FILE = os.path.join(TRAINER_DIR, 'auto_training_data.jsonl')
count = 0
with open(OUTPUT_FILE, 'w') as f:
    for log in passing:
        ui, ao = log.get('user_input',''), log.get('ai_output','')
        if not ui or not ao: continue
        text = f'<|im_start|>system\\n{SYSTEM_INSTRUCTION_FULL}<|im_end|>\\n<|im_start|>user\\n{ui}<|im_end|>\\n<|im_start|>assistant\\n{ao}<|im_end|>\\n'
        f.write(json.dumps({'text': text}, ensure_ascii=False) + '\\n')
        count += 1

print(f'💾 Saved {count} training examples → {OUTPUT_FILE}')\
""")

# ── Cell 8: Fine-Tune ─────────────────────────────────────────────────────────
md("## Cell 8 — Fine-Tune SmolLM2 on New Dataset")
code("""\
from datasets import load_dataset
from transformers import TrainingArguments, Trainer, DataCollatorForLanguageModeling

OUTPUT_DIR = os.path.join(TRAINER_DIR, 'fine_tuned_smollm')
print(f'🎬 Fine-tuning on {count} examples... Saving to {OUTPUT_DIR}')

dataset   = load_dataset('json', data_files=OUTPUT_FILE, split='train')
tokenized = dataset.map(
    lambda ex: tokenizer(ex['text'], truncation=True, max_length=512, padding=True),
    batched=True, remove_columns=dataset.column_names
)
print(f'✅ Tokenized {len(tokenized)} examples.')

trainer = Trainer(
    model=model,
    args=TrainingArguments(
        output_dir=OUTPUT_DIR, num_train_epochs=5,
        per_device_train_batch_size=8, gradient_accumulation_steps=2,
        learning_rate=5e-5, weight_decay=0.01, logging_steps=10,
        save_strategy='no', fp16=(DEVICE=='cuda'), report_to='none'
    ),
    train_dataset=tokenized,
    data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
)
trainer.train()
trainer.save_model(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)
print(f'\\n🎉 Training complete! Model saved to {OUTPUT_DIR}')\
""")

# ── Cell 9: ONNX Export ───────────────────────────────────────────────────────
md("## Cell 9 — Convert to ONNX (INT8 + FP16 + FP32)")
code("""\
import subprocess as sp

os.environ['FORMAT_NAME'] = 'all'
print('🔁 Converting to all ONNX formats...')
r = sp.run([sys.executable, os.path.join(TRAINER_DIR,'convert_to_onnx.py'), '--format', 'all'])
if r.returncode != 0:
    raise Exception('❌ ONNX conversion failed!')
print('✅ ONNX export complete!')\
""")

# ── Cell 10: Push to HF ───────────────────────────────────────────────────────
md("## Cell 10 — Push New Model to Hugging Face 🚀")
code("""\
print('🚀 Pushing to Hugging Face Hub...')
r = sp.run(
    [sys.executable, os.path.join(TRAINER_DIR,'push_to_hf.py')],
    env={**os.environ, 'FORMAT_NAME':'all', 'SKIP_NORMAL_MODEL':'0'}
)
if r.returncode != 0:
    raise Exception('❌ HF push failed!')
print('\\n✅ Model pushed to https://huggingface.co/Kingman9407/hornet')
print('\\n🎉 PIPELINE COMPLETE! Your Next.js app will load the new model on next visit.')\
""")

# ── Assemble notebook ─────────────────────────────────────────────────────────
notebook = {
    "cells": cells,
    "metadata": {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3.10.0"},
        "accelerator": "GPU"
    },
    "nbformat": 4,
    "nbformat_minor": 5
}

out = os.path.join(os.path.dirname(__file__), "colab_pipeline.ipynb")
with open(out, "w", encoding="utf-8") as f:
    json.dump(notebook, f, indent=1, ensure_ascii=False)

print(f"✅ Notebook written to: {out}")
print(f"   Total cells: {len(cells)}")
