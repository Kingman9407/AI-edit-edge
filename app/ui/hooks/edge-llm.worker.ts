const MODEL_URL = "/api/model";
const TOKENIZER_MODEL_ID = "HuggingFaceTB/SmolLM2-135M-Instruct";

const IDB_DB_NAME = "edge-llm-cache";
const IDB_STORE = "models";
const IDB_KEY = "smollm2-135m-onnx";

const MAX_NEW_TOKENS = 256;
const EOS_TOKEN_ID = 2; // SmolLM2 uses token 2 (<|im_end|>) as EOS for ChatML

let session: import("onnxruntime-web").InferenceSession | null = null;
let tokenizer: import("@huggingface/transformers").PreTrainedTokenizer | null = null;

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

  let modelBuffer = await getCachedModel();

  if (!modelBuffer) {
    console.log("[EdgeLLM Worker] Fetching model from proxy:", MODEL_URL);
    const response = await fetch(MODEL_URL);

    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
    }
    if (!response.body) {
      throw new Error("Response body is null.");
    }

    const KNOWN_MODEL_BYTES = 166009881;
    const headerLen = Number(response.headers.get("content-length") ?? 0);
    const contentLength = headerLen > 0 ? headerLen : KNOWN_MODEL_BYTES;

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
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    modelBuffer = merged.buffer;
    await cacheModel(modelBuffer);
  } else {
    self.postMessage({ type: "STATUS", status: "downloading", progress: 1 });
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
      0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00,
      0x01,0x05,0x01,0x60,0x00,0x01,0x7b,
      0x03,0x02,0x01,0x00,
      0x0a,0x0a,0x01,0x08,0x00,0xfd,0x0f,0x00,0x00,0x00,0x00,0x0b,
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

  console.log("[EdgeLLM Worker] Loading tokenizer:", TOKENIZER_MODEL_ID);
  const { AutoTokenizer } = await import("@huggingface/transformers");
  tokenizer = await AutoTokenizer.from_pretrained(TOKENIZER_MODEL_ID);

  self.postMessage({ type: "STATUS", status: "ready", progress: 1 });
}

async function generate(prompt: string, reqId: number) {
  if (!session || !tokenizer) {
    throw new Error("Model is not loaded yet.");
  }

  const ort = await import("onnxruntime-web");
  const encoded = await tokenizer(prompt, { return_tensor: false, add_special_tokens: true });
  let inputIds = Array.from(encoded.input_ids as number[]).map(Number);

  const generatedTokenIds: bigint[] = [];
  let pastKeyValues: Record<string, import("onnxruntime-web").Tensor> = {};
  let firstStep = true;

  for (let step = 0; step < MAX_NEW_TOKENS; step++) {
    const currentIds = firstStep ? inputIds : [inputIds[inputIds.length - 1]];

    const inputTensor = new ort.Tensor("int64", new BigInt64Array(currentIds.map(BigInt)), [1, currentIds.length]);
    const attentionMask = new ort.Tensor("int64", new BigInt64Array(inputIds.length).fill(BigInt(1)), [1, inputIds.length]);
    const positionIds = firstStep
      ? new ort.Tensor("int64", new BigInt64Array(Array.from({ length: inputIds.length }, (_, i) => BigInt(i))), [1, inputIds.length])
      : new ort.Tensor("int64", new BigInt64Array([BigInt(inputIds.length - 1)]), [1, 1]);

    const feeds: Record<string, import("onnxruntime-web").Tensor> = {
      input_ids: inputTensor,
      attention_mask: attentionMask,
      position_ids: positionIds,
      ...pastKeyValues,
    };

    if (firstStep) {
      const emptyKvShape = [1, 3, 0, 64];
      const emptyBuffer = new Float32Array(0);
      for (const inputName of session.inputNames) {
        if (inputName.startsWith("past_key_values.") && !feeds[inputName]) {
          feeds[inputName] = new ort.Tensor("float32", emptyBuffer, emptyKvShape);
        }
      }
    }

    const results = await session.run(feeds);
    const logits = results["logits"] as import("onnxruntime-web").Tensor;
    const logitsData = logits.data as Float32Array;
    const vocabSize = logits.dims[logits.dims.length - 1];
    const lastTokenLogits = logitsData.slice(logitsData.length - vocabSize, logitsData.length);

    let maxIdx = 0;
    let maxVal = lastTokenLogits[0];
    for (let i = 1; i < lastTokenLogits.length; i++) {
      if (lastTokenLogits[i] > maxVal) {
        maxVal = lastTokenLogits[i];
        maxIdx = i;
      }
    }

    const nextToken = BigInt(maxIdx);
    generatedTokenIds.push(nextToken);

    if (Number(nextToken) === EOS_TOKEN_ID) {
      break;
    }

    pastKeyValues = {};
    for (const key of Object.keys(results)) {
      if (key !== "logits") {
        pastKeyValues[key.replace(/^present/, "past_key_values")] = results[key] as import("onnxruntime-web").Tensor;
      }
    }

    inputIds.push(Number(nextToken));
    firstStep = false;
  }

  const decoded = await tokenizer.decode(generatedTokenIds.map(Number), { skip_special_tokens: true });
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
    self.postMessage({ type: "STATUS", status: "idle", progress: 0 });
  }
});
