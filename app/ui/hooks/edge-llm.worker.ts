const MODEL_URL = "/api/model";

const IDB_DB_NAME = "edge-llm-cache";
const IDB_STORE = "models";
const IDB_KEY = "smollm2-135m-onnx-v3";

const MAX_NEW_TOKENS = 256;
const FALLBACK_EOS_TOKEN_ID = 2; // SmolLM2 uses token 2 (<|im_end|>) as EOS for ChatML

let session: import("onnxruntime-web").InferenceSession | null = null;
let tokenizer: import("@huggingface/transformers").PreTrainedTokenizer | null = null;
let eosTokenId = FALLBACK_EOS_TOKEN_ID;

interface ChatMLMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ─── JSON Parser ──────────────────────────────────────────────────────────────

function parseJsonResponse(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) return text;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.substring(start, i + 1);
      }
    }
  }
  return text;
}

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedModel(): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as ArrayBuffer) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function cacheModel(buffer: ArrayBuffer): Promise<void> {
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile && buffer.byteLength > 100 * 1024 * 1024) {
    console.warn(`[EdgeLLM Worker] Skipping IndexedDB cache on mobile for large model (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB).`);
    return;
  }

  try {
    const db = await openDb();
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        const req = tx.objectStore(IDB_STORE).put(buffer, IDB_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error || new Error("IDB put failed"));
        tx.onabort = () => reject(new Error("IDB transaction aborted"));
        tx.onerror = () => reject(tx.error || new Error("IDB transaction error"));
      }),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("IndexedDB write timeout (15s)")), 15000)
      )
    ]);
  } catch (err) {
    console.error(`[EdgeLLM Worker] ⚠️ Failed to cache model in IndexedDB:`, err);
  }
}

// ─── Worker logic ─────────────────────────────────────────────────────────────

async function loadModel() {
  self.postMessage({ type: "STATUS", status: "downloading", progress: 0 });

  // Caching is temporarily disabled to prevent loading outdated weights.
  let modelBuffer: ArrayBuffer;

  {
    console.log("[EdgeLLM Worker] Fetching model from proxy:", MODEL_URL);
    const response = await fetch(MODEL_URL, { cache: "no-store" });

    if (!response.ok) {
      console.error("[EdgeLLM Worker] Proxy request failed with status:", response.status, response.statusText);
      throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
    }
    if (!response.body) {
      console.error("[EdgeLLM Worker] Proxy response body is null");
      throw new Error("Response body is null.");
    }

    const KNOWN_MODEL_BYTES = 137452646;
    const headerLen = Number(response.headers.get("content-length") ?? 0);
    const contentLength = headerLen > 0 ? headerLen : KNOWN_MODEL_BYTES;
    console.log("[EdgeLLM Worker] Starting stream download. Total expected size:", contentLength, "bytes");

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      self.postMessage({
        type: "STATUS",
        status: "downloading",
        progress: Math.min(received / contentLength, 0.99)
      });
    }

    const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    console.log("[EdgeLLM Worker] Stream download complete. Merging chunks, total size:", total, "bytes");
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    modelBuffer = merged.buffer;

    // Caching is temporarily disabled; skipping saving to IndexedDB.
    console.log("[EdgeLLM Worker] Caching is disabled; skipping save to IndexedDB.");
  }

  self.postMessage({ type: "STATUS", status: "loading", progress: 1 });

  const ort = await import("onnxruntime-web");

  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 1;
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
  const hasAtomics = typeof Atomics !== "undefined";

  let simdOk = false;
  try {
    const probe = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b,
      0x03, 0x02, 0x01, 0x00,
      0x0a, 0x0a, 0x01, 0x08, 0x00, 0xfd, 0x0f, 0x00, 0x00, 0x00, 0x00, 0x0b,
    ]);
    simdOk = WebAssembly.validate(probe);
  } catch { /* ignore */ }

  const canMultiThread = hasSharedArrayBuffer && hasAtomics;
  const numThreads = (isMobile || !canMultiThread) ? 1 : Math.min(4, hardwareConcurrency);

  ort.env.wasm.proxy = false; // We are already in a worker
  ort.env.wasm.numThreads = numThreads;
  ort.env.wasm.simd = simdOk;
  ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/";

  try {
    console.log("[EdgeLLM Worker] Creating ONNX session (attempt 1)");
    session = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
  } catch (err) {
    console.error("[EdgeLLM Worker] Session attempt 1 failed, retrying with fallback settings:", err);
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = false;
    session = await ort.InferenceSession.create(modelBuffer, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "basic",
    });
  }

  // ── Tokenizer loading ──────────────────────────────────────────────────────
  // The server-side /api/hf-proxy/ route forwards all HF requests with HF_TOKEN,
  // and patches tokenizer_config.json (GPT2Tokenizer → PreTrainedTokenizerFast).
  // self.location.origin is the real deployed domain on the web (not localhost).
  const PROXY_BASE = `${self.location.origin}/api/hf-proxy/`;
  const TOKENIZER_REPO = "Kingman9407/hornet"; // fine-tuned tokenizer with EOS = <|im_end|>

  console.log("[EdgeLLM Worker] Redirecting HF requests through proxy:", PROXY_BASE);
  const { AutoTokenizer, env } = await import("@huggingface/transformers");

  // env.remoteHost replaces "https://huggingface.co/" so every file fetch
  // goes to our server proxy instead of directly to HuggingFace.
  env.remoteHost = PROXY_BASE;
  env.allowRemoteModels = true;

  console.log("[EdgeLLM Worker] Loading tokenizer:", TOKENIZER_REPO);
  try {
    tokenizer = await AutoTokenizer.from_pretrained(TOKENIZER_REPO);
    eosTokenId = Number(tokenizer.eos_token_id ?? FALLBACK_EOS_TOKEN_ID);
    console.log("[EdgeLLM Worker] ✅ Tokenizer loaded! EOS token id:", eosTokenId);
  } catch (tokenizerErr) {
    console.error("[EdgeLLM Worker] ❌ Tokenizer failed:", tokenizerErr);
    throw tokenizerErr;
  }

  self.postMessage({ type: "STATUS", status: "ready", progress: 1 });
}

async function generate(prompt: string | ChatMLMessage[], reqId: number) {
  if (!session || !tokenizer) {
    throw new Error("Model is not loaded yet.");
  }

  const ort = await import("onnxruntime-web");
  let promptText = "";
  if (Array.isArray(prompt)) {
    // Manually build ChatML format — identical to Python's apply_chat_template.
    // This avoids any JS/Python template differences and works regardless of
    // which tokenizer repo is loaded.
    for (const msg of prompt) {
      promptText += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
    }
    promptText += "<|im_start|>assistant\n";
  } else {
    promptText = prompt;
  }

  console.log("🤖 [EdgeLLM Worker] RAW PROMPT PASSED TO AI:\n", promptText);

  // IMPORTANT: add_special_tokens: false — the ChatML string is already fully formatted
  // with <|im_start|> and <|im_end|> tokens. Setting true would prepend an extra BOS
  // token, corrupting the input and causing wrong generation (mismatches Python pipeline).
  const encoded = await tokenizer(promptText, { return_tensor: false, add_special_tokens: false });
  const inputIds = Array.from(encoded.input_ids as number[]).map(Number);

  const promptLen = inputIds.length;
  console.log(`[EdgeLLM Worker] Prompt tokenized to ${promptLen} tokens. Generating up to ${MAX_NEW_TOKENS} new tokens...`);

  const generatedTokenIds: number[] = [];

  // Generation loop — no KV cache: feed the full sequence each step.
  // This is simpler and guaranteed to work regardless of ONNX export key names.
  for (let step = 0; step < MAX_NEW_TOKENS; step++) {
    const seqLen = inputIds.length;
    const inputTensor = new ort.Tensor("int64", new BigInt64Array(inputIds.map(BigInt)), [1, seqLen]);
    const attentionMask = new ort.Tensor("int64", new BigInt64Array(seqLen).fill(BigInt(1)), [1, seqLen]);
    const positionIds = new ort.Tensor("int64", new BigInt64Array(Array.from({ length: seqLen }, (_, i) => BigInt(i))), [1, seqLen]);

    // Build feeds — inject empty past_key_values for every layer if model expects them
    const feeds: Record<string, import("onnxruntime-web").Tensor> = {
      input_ids: inputTensor,
      attention_mask: attentionMask,
      position_ids: positionIds,
    };

    // Inject empty past_key_values for each expected input
    const emptyKvShape = [1, 3, 0, 64]; // [batch, num_kv_heads, seq=0, head_dim]
    const emptyBuf = new Float32Array(0);
    for (const name of session.inputNames) {
      if (name.startsWith("past_key_values.") && !(name in feeds)) {
        feeds[name] = new ort.Tensor("float32", emptyBuf, emptyKvShape);
      }
    }

    const results = await session.run(feeds);
    const logits = results["logits"] as import("onnxruntime-web").Tensor;
    const logitsData = logits.data as Float32Array;
    const vocabSize = logits.dims[logits.dims.length - 1];

    // Greedy: pick the argmax of the LAST token's logits
    const lastLogits = logitsData.slice(logitsData.length - vocabSize);
    let maxIdx = 0;
    let maxVal = lastLogits[0];
    for (let i = 1; i < lastLogits.length; i++) {
      if (lastLogits[i] > maxVal) { maxVal = lastLogits[i]; maxIdx = i; }
    }

    const nextToken = maxIdx;
    if (step === 0) {
      console.log(`[EdgeLLM Worker] First generated token: ${nextToken}`);
    }

    if (nextToken === eosTokenId) {
      console.log(`[EdgeLLM Worker] EOS hit at step ${step}. Stopping.`);
      break;
    }

    generatedTokenIds.push(nextToken);
    inputIds.push(nextToken);
  }

  console.log(`[EdgeLLM Worker] Generated ${generatedTokenIds.length} new tokens. Decoding...`);
  const decoded = await tokenizer.decode(generatedTokenIds, { skip_special_tokens: true });
  console.log("[EdgeLLM Worker] Raw decoded output:", decoded.slice(0, 200));

  const cleanedText = parseJsonResponse(decoded);
  self.postMessage({ type: "DONE", reqId, text: cleanedText.trim() });
}

self.addEventListener("message", (e) => {
  const { type, payload } = e.data;

  if (type === "LOAD") {
    loadModel().catch((err) => {
      self.postMessage({ type: "ERROR", error: err.message || String(err) });
    });
  } else if (type === "GENERATE") {
    generate(payload.prompt, payload.reqId).catch((err) => {
      self.postMessage({ type: "ERROR", error: err.message || String(err), reqId: payload.reqId });
    });
  } else if (type === "RESET") {
    session = null;
    tokenizer = null;
    eosTokenId = FALLBACK_EOS_TOKEN_ID;
    self.postMessage({ type: "STATUS", status: "idle", progress: 0 });
  }
});
