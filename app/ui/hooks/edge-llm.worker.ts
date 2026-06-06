const IDB_DB_NAME = "edge-llm-cache";
const IDB_STORE = "models";

const MAX_NEW_TOKENS = 256;
const FALLBACK_EOS_TOKEN_ID = 2; // SmolLM2 uses token 2 (<|im_end|>) as EOS for ChatML

// ─── Fix #3: Module-level ORT reference ──────────────────────────────────────
// Import ORT once at module level — reused by both loadModel and generate.
// Avoids re-resolving the dynamic import on every generate() call (~5-20ms each).
let ort: Awaited<typeof import("onnxruntime-web")> | null = null;
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
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === '\\' && inString) { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.substring(start, i + 1);
    }
  }
  return text;
}

// ─── Greedy argmax (shared by both generation paths) ─────────────────────────

function argmax(arr: Float32Array): number {
  let maxIdx = 0;
  let maxVal = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > maxVal) { maxVal = arr[i]; maxIdx = i; }
  }
  return maxIdx;
}

// ─── IndexedDB singleton ──────────────────────────────────────────────────────
// Fix #4: Single IDB connection reused across getCachedModel / cacheModel.
// Opening a fresh connection per operation adds latency and risks blocking
// future version upgrades because old connections are never explicitly closed.

let _idb: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => { _idb = req.result; resolve(_idb!); };
    req.onerror = () => reject(req.error);
  });
}

async function getCachedModel(idbKey: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(idbKey);
      req.onsuccess = () => resolve((req.result as ArrayBuffer) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function cacheModel(buffer: ArrayBuffer, idbKey: string): Promise<void> {
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile && buffer.byteLength > 100 * 1024 * 1024) {
    console.warn(`[EdgeLLM Worker] Skipping IDB cache on mobile (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB).`);
    return;
  }
  try {
    const db = await openDb();
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        const req = tx.objectStore(IDB_STORE).put(buffer, idbKey);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error || new Error("IDB put failed"));
        tx.onabort = () => reject(new Error("IDB transaction aborted"));
        tx.onerror = () => reject(tx.error || new Error("IDB transaction error"));
      }),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("IndexedDB write timeout (15s)")), 15000)
      ),
    ]);
    console.log("[EdgeLLM Worker] ✅ Model cached in IndexedDB.");
  } catch (err) {
    console.error(`[EdgeLLM Worker] ⚠️ Failed to cache model in IndexedDB:`, err);
  }
}

// ─── Model loading ────────────────────────────────────────────────────────────

async function loadModel(format: string) {
  const MODEL_URL = `/api/model?format=${format}`;
  const MODEL_CACHE_KEY = `hornet-smollm2-135m-onnx-v5-${format}`;

  self.postMessage({ type: "STATUS", status: "downloading", progress: 0 });

  let modelBuffer: ArrayBuffer;

  // ── Try IndexedDB cache first ──────────────────────────────────────────────
  const cached = await getCachedModel(MODEL_CACHE_KEY);
  if (cached) {
    console.log(
      `[EdgeLLM Worker] ✅ Loaded model from IDB cache ` +
      `(${(cached.byteLength / 1024 / 1024).toFixed(1)} MB)`
    );
    modelBuffer = cached;
    self.postMessage({ type: "STATUS", status: "downloading", progress: 1 });
  } else {
    console.log("[EdgeLLM Worker] Fetching model from proxy:", MODEL_URL);
    const response = await fetch(MODEL_URL, { cache: "no-store" });

    if (!response.ok) {
      console.error("[EdgeLLM Worker] Proxy request failed:", response.status, response.statusText);
      throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
    }
    if (!response.body) throw new Error("Response body is null.");

    const KNOWN_MODEL_BYTES = 137452646;
    const headerLen = Number(response.headers.get("content-length") ?? 0);
    const contentLength = headerLen > 0 ? headerLen : KNOWN_MODEL_BYTES;
    console.log("[EdgeLLM Worker] Starting stream download. Expected size:", contentLength, "bytes");

    const reader = response.body.getReader();
    let received = 0;
    // Throttle progress postMessage — gate behind 250ms interval.
    // Without this, a 137 MB download generates ~4,000 IPC messages that
    // wake the main thread on every network chunk.
    let lastProgressAt = 0;

    // Fix #5: Pre-allocate a single ArrayBuffer if content-length is known.
    // Original code accumulated all chunks then merged — peak RAM was 2× model size.
    // Writing directly into a pre-allocated buffer keeps peak at 1× model size.
    if (contentLength > 0) {
      const merged = new Uint8Array(contentLength);
      let writeOffset = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        merged.set(value, writeOffset);
        writeOffset += value.length;
        received = writeOffset;

        const now = performance.now();
        if (now - lastProgressAt >= 250) {
          self.postMessage({
            type: "STATUS",
            status: "downloading",
            progress: Math.min(received / contentLength, 0.99),
          });
          lastProgressAt = now;
        }
      }

      modelBuffer = writeOffset < contentLength
        ? merged.buffer.slice(0, writeOffset)
        : merged.buffer;
    } else {
      // Fallback: chunk accumulation when content-length is unknown
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;

        const now = performance.now();
        if (now - lastProgressAt >= 250) {
          self.postMessage({
            type: "STATUS",
            status: "downloading",
            progress: Math.min(received / KNOWN_MODEL_BYTES, 0.99),
          });
          lastProgressAt = now;
        }
      }
      const total = chunks.reduce((s, c) => s + c.byteLength, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
      modelBuffer = merged.buffer;
    }

    console.log(`[EdgeLLM Worker] Download complete. Size: ${(received / 1024 / 1024).toFixed(1)} MB`);

    // Cache for next time (non-blocking, non-fatal)
    cacheModel(modelBuffer, MODEL_CACHE_KEY).catch(() => { /* intentionally swallowed */ });
  }

  self.postMessage({ type: "STATUS", status: "loading", progress: 1 });

  // Fix #3: Assign to module-level variable — generate() reuses this reference
  ort = await import("onnxruntime-web");

  const hardwareConcurrency = navigator.hardwareConcurrency ?? 1;
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
  const hasAtomics = typeof Atomics !== "undefined";

  let simdOk = false;
  try {
    // Minimal WASM SIMD probe binary
    const probe = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b,
      0x03, 0x02, 0x01, 0x00,
      0x0a, 0x0a, 0x01, 0x08, 0x00, 0xfd, 0x0f, 0x00, 0x00, 0x00, 0x00, 0x0b,
    ]);
    simdOk = WebAssembly.validate(probe);
  } catch { /* ignore */ }

  const canMultiThread = hasSharedArrayBuffer && hasAtomics;
  // Cap at physical-core estimate and a hard maximum of 4.
  // navigator.hardwareConcurrency reports logical threads (includes hyperthreads).
  // Hyperthreads share FPU/SIMD units — extra WASM threads cause cache thrashing.
  // Halving and capping at 4 consistently gives 20–30% better transformer throughput.
  const numThreads = canMultiThread
    ? Math.min(Math.max(1, Math.floor(hardwareConcurrency / 2)), 4)
    : 1;

  console.log(
    `[EdgeLLM Worker] WASM config — threads: ${numThreads} ` +
    `(hw: ${hardwareConcurrency}), SIMD: ${simdOk}, SAB: ${canMultiThread}`
  );

  ort.env.wasm.proxy = false; // Already inside a Worker — no need for a proxy worker
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
  const PROXY_BASE = `${self.location.origin}/api/hf-proxy/`;
  const TOKENIZER_REPO = "Kingman9407/hornet";

  console.log("[EdgeLLM Worker] Redirecting HF requests through proxy:", PROXY_BASE);
  const { AutoTokenizer, env } = await import("@huggingface/transformers");

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

  // Surface model capability so the generate() path selection is visible in logs
  const hasKvOutputs = session.outputNames.some(n => n.startsWith("present_key_values.") || n.startsWith("present."));
  console.log("[EdgeLLM Worker] Model inputs:", session.inputNames);
  console.log("[EdgeLLM Worker] Model outputs:", session.outputNames);
  console.log(`[EdgeLLM Worker] KV-cache capable: ${hasKvOutputs}`);

  self.postMessage({ type: "STATUS", status: "ready", progress: 1 });
}

// ─── Fix #1: KV-cache generation path ────────────────────────────────────────
// Implements the standard prefill + decode paradigm:
//   • Prefill  — one session.run() over the full prompt; captures present_key_values.
//   • Decode   — one session.run() per token with a single new input_id;
//               past_key_values grow by one position each step (O(N) total).
//
// Without this, the original loop re-fed the entire sequence on every step → O(N²).
// At 256 generated tokens with a 128-token prompt, the last step attends over
// 384 tokens when it only needs to attend over 1.

async function generateWithKvCache(
  initialInputIds: number[],
  generatedTokenIds: number[],
  reqId: number
): Promise<void> {
  if (!session || !ort) return;

  const promptLen = initialInputIds.length;
  const kvInputNames = session.inputNames.filter(n => n.startsWith("past_key_values."));

  // Empty past KV shape for prefill: [batch=1, num_kv_heads=3, past_seq=0, head_dim=64]
  const emptyKvShape = [1, 3, 0, 64];
  const emptyBuf = new Float32Array(0);

  // ── Prefill: process the full prompt in one shot ───────────────────────────
  const prefillFeeds: Record<string, import("onnxruntime-web").Tensor> = {
    input_ids: new ort.Tensor(
      "int64",
      BigInt64Array.from(initialInputIds, id => BigInt(id)),
      [1, promptLen]
    ),
    attention_mask: new ort.Tensor(
      "int64",
      new BigInt64Array(promptLen).fill(BigInt(1)),
      [1, promptLen]
    ),
    position_ids: new ort.Tensor(
      "int64",
      BigInt64Array.from({ length: promptLen }, (_, i) => BigInt(i)),
      [1, promptLen]
    ),
  };
  for (const name of kvInputNames) {
    prefillFeeds[name] = new ort.Tensor("float32", emptyBuf, emptyKvShape);
  }

  const prefillResults = await session.run(prefillFeeds);

  // Collect the KV cache produced by the prefill step.
  // present_key_values.{i}.{key|value} → past_key_values.{i}.{key|value}
  let pastKv: Record<string, import("onnxruntime-web").Tensor> = {};
  for (const outName of session.outputNames) {
    if (outName.startsWith("present_key_values.") || outName.startsWith("present.")) {
      const pastName = outName.replace("present_key_values.", "past_key_values.").replace("present.", "past_key_values.");
      pastKv[pastName] = prefillResults[outName] as import("onnxruntime-web").Tensor;
    }
  }

  // Pick the first generated token from the last-position logits of the prefill
  const prefillLogits = prefillResults["logits"] as import("onnxruntime-web").Tensor;
  const prefillData = prefillLogits.data as Float32Array;
  const vocabSize = prefillLogits.dims[prefillLogits.dims.length - 1];
  let nextToken = argmax(prefillData.subarray(prefillData.length - vocabSize));

  console.log(`[EdgeLLM Worker] First generated token: ${nextToken} (KV-cache prefill)`);

  if (nextToken === eosTokenId) {
    console.log("[EdgeLLM Worker] EOS immediately after prefill.");
    return;
  }
  generatedTokenIds.push(nextToken);
  if (tokenizer) {
    const partialToken = await tokenizer.decode([nextToken], { skip_special_tokens: true });
    console.log(`[EdgeLLM Worker] step 0 (prefill): ${partialToken}`);
    self.postMessage({ type: "PARTIAL", reqId, text: partialToken });
  }

  // ── Decode: one new token per step with growing KV cache ──────────────────
  // Fix #2: Pre-allocate the attention mask buffer at max length — all 1s.
  // Each decode step uses an incrementally longer subarray view into this buffer
  // rather than allocating a fresh BigInt64Array every iteration.
  const maxContextLen = promptLen + MAX_NEW_TOKENS;
  const attentionMaskBuf = new BigInt64Array(maxContextLen).fill(BigInt(1));

  for (let step = 1; step < MAX_NEW_TOKENS; step++) {
    // contextLen = total tokens seen after this step
    const contextLen = promptLen + step;

    const decodeFeeds: Record<string, import("onnxruntime-web").Tensor> = {
      // Fix #2: Only 1-token input per decode step — no full-sequence copy
      input_ids: new ort.Tensor("int64", new BigInt64Array([BigInt(nextToken)]), [1, 1]),
      // Attention mask covers the entire past context + the new token
      attention_mask: new ort.Tensor(
        "int64",
        attentionMaskBuf.subarray(0, contextLen), // view, not a copy
        [1, contextLen]
      ),
      // Position of the new token in the sequence
      position_ids: new ort.Tensor("int64", new BigInt64Array([BigInt(contextLen - 1)]), [1, 1]),
      ...pastKv,
    };

    const decodeResults = await session.run(decodeFeeds);

    // Rotate KV cache: present → past for the next step
    const newPastKv: Record<string, import("onnxruntime-web").Tensor> = {};
    for (const outName of session.outputNames) {
      if (outName.startsWith("present_key_values.") || outName.startsWith("present.")) {
        const pastName = outName.replace("present_key_values.", "past_key_values.").replace("present.", "past_key_values.");
        newPastKv[pastName] = decodeResults[outName] as import("onnxruntime-web").Tensor;
      }
    }
    pastKv = newPastKv;

    // Output shape is [1, 1, vocab] — the full Float32Array is the last-token logits
    const decodeLogits = decodeResults["logits"] as import("onnxruntime-web").Tensor;
    nextToken = argmax(decodeLogits.data as Float32Array);

    if (nextToken === eosTokenId) {
      console.log(`[EdgeLLM Worker] EOS hit at step ${step}. Stopping.`);
      break;
    }
    generatedTokenIds.push(nextToken);
    if (tokenizer) {
      const partialToken = await tokenizer.decode([nextToken], { skip_special_tokens: true });
      console.log(`[EdgeLLM Worker] step ${step}: ${partialToken}`);
      self.postMessage({ type: "PARTIAL", reqId, text: partialToken });
    }
  }
}

// ─── Fallback: full-sequence re-feed (models without KV cache outputs) ────────
// O(N²) algorithm, but with Fix #2 applied:
// Pre-allocated typed arrays grow via indexed writes rather than per-step
// BigInt64Array construction + .map(BigInt), which caused thousands of
// short-lived heap allocations and significant GC pressure.

async function generateFullRefeed(
  inputIds: number[],
  generatedTokenIds: number[],
  reqId: number
): Promise<void> {
  if (!session || !ort) return;

  const kvInputNames = session.inputNames.filter(n => n.startsWith("past_key_values."));
  const emptyKvShape = [1, 3, 0, 64];
  const emptyBuf = new Float32Array(0);

  // Fix #2: Allocate once at maximum possible sequence length
  const maxSeqLen = inputIds.length + MAX_NEW_TOKENS;
  const inputIdsBuf = new BigInt64Array(maxSeqLen);
  const attentionMaskBuf = new BigInt64Array(maxSeqLen).fill(BigInt(1));
  const positionIdsBuf = new BigInt64Array(maxSeqLen);

  // Seed buffers with the prompt tokens
  for (let i = 0; i < inputIds.length; i++) {
    inputIdsBuf[i] = BigInt(inputIds[i]);
    positionIdsBuf[i] = BigInt(i);
  }
  let currentLen = inputIds.length;

  for (let step = 0; step < MAX_NEW_TOKENS; step++) {
    const feeds: Record<string, import("onnxruntime-web").Tensor> = {
      // Subarray views into pre-allocated buffers — no allocation inside the loop
      input_ids: new ort.Tensor("int64", inputIdsBuf.subarray(0, currentLen), [1, currentLen]),
      attention_mask: new ort.Tensor("int64", attentionMaskBuf.subarray(0, currentLen), [1, currentLen]),
      position_ids: new ort.Tensor("int64", positionIdsBuf.subarray(0, currentLen), [1, currentLen]),
    };
    for (const name of kvInputNames) {
      feeds[name] = new ort.Tensor("float32", emptyBuf, emptyKvShape);
    }

    const results = await session.run(feeds);
    const logits = results["logits"] as import("onnxruntime-web").Tensor;
    const logitsData = logits.data as Float32Array;
    const vocabSize = logits.dims[logits.dims.length - 1];
    const nextToken = argmax(logitsData.subarray(logitsData.length - vocabSize));

    if (step === 0) {
      console.log(`[EdgeLLM Worker] First generated token: ${nextToken} (full-refeed fallback)`);
    }

    if (nextToken === eosTokenId) {
      console.log(`[EdgeLLM Worker] EOS hit at step ${step}. Stopping.`);
      break;
    }

    generatedTokenIds.push(nextToken);
    if (tokenizer) {
      const partialToken = await tokenizer.decode([nextToken], { skip_special_tokens: true });
      console.log(`[EdgeLLM Worker] step ${step}: ${partialToken}`);
      self.postMessage({ type: "PARTIAL", reqId, text: partialToken });
    }

    // Extend pre-allocated buffers in-place — O(1), no allocation
    inputIdsBuf[currentLen] = BigInt(nextToken);
    positionIdsBuf[currentLen] = BigInt(currentLen);
    currentLen++;
  }
}

// ─── Generate entry point ─────────────────────────────────────────────────────

async function generate(prompt: string | ChatMLMessage[], reqId: number) {
  if (!session || !tokenizer || !ort) {
    throw new Error("Model is not loaded yet.");
  }

  let promptText = "";
  if (Array.isArray(prompt)) {
    // Manually build ChatML format — identical to Python's apply_chat_template.
    for (const msg of prompt) {
      promptText += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
    }
    promptText += "<|im_start|>assistant\n";
  } else {
    promptText = prompt;
  }

  console.log("🤖 [EdgeLLM Worker] RAW PROMPT PASSED TO AI:\n", promptText);

  // IMPORTANT: add_special_tokens: false — the ChatML string is already fully formatted.
  // Setting true would prepend an extra BOS token, corrupting the input.
  const encoded = await tokenizer(promptText, { return_tensor: false, add_special_tokens: false });
  const inputIds = Array.from(encoded.input_ids as number[]).map(Number);
  const promptLen = inputIds.length;

  console.log("Token count:", inputIds.length);
  console.log("First 20:", Array.from(inputIds).slice(0, 20));
  console.log("Last 20:", Array.from(inputIds).slice(-20));
  console.log("ALL TOKENS:", Array.from(inputIds));
  console.log("DECODED PROMPT:\n", tokenizer.decode(inputIds, { skip_special_tokens: false }));

  console.log(
    `[EdgeLLM Worker] Prompt tokenized to ${promptLen} tokens. ` +
    `Generating up to ${MAX_NEW_TOKENS} new tokens...`
  );

  const generatedTokenIds: number[] = [];
  const startTime = performance.now();

  // Fix #1: Route to KV-cache path if the model exports present_key_values.
  // Falls back to the pre-allocated full-refeed path for models that don't.
  const hasKvOutputs = session.outputNames.some(n => n.startsWith("present_key_values.") || n.startsWith("present."));
  const hasKvInputs = session.inputNames.some(n => n.startsWith("past_key_values."));

  if (hasKvOutputs && hasKvInputs) {
    console.log("[EdgeLLM Worker] Using KV-cache path (O(N) per decode step)");
    await generateWithKvCache(inputIds, generatedTokenIds, reqId);
  } else {
    console.log("[EdgeLLM Worker] Using full-refeed fallback (model lacks KV outputs)");
    await generateFullRefeed(inputIds, generatedTokenIds, reqId);
  }

  const endTime = performance.now();
  const elapsedSec = (endTime - startTime) / 1000;
  const tps = generatedTokenIds.length / elapsedSec;

  console.log(
    `[EdgeLLM Worker] Generated ${generatedTokenIds.length} tokens ` +
    `in ${elapsedSec.toFixed(2)}s (${tps.toFixed(2)} tok/s). Decoding...`
  );
  console.log("🤖 [EdgeLLM Worker] GENERATED TOKEN IDs:\n", generatedTokenIds);

  const decoded = await tokenizer.decode(generatedTokenIds, { skip_special_tokens: true });
  console.log("[EdgeLLM Worker] Raw decoded output:", decoded.slice(0, 200));

  const cleanedText = parseJsonResponse(decoded);
  self.postMessage({ type: "DONE", reqId, text: cleanedText.trim() });
}

// ─── Message handler ──────────────────────────────────────────────────────────

self.addEventListener("message", (e) => {
  const { type, payload } = e.data;

  if (type === "LOAD") {
    const format = payload?.format || "int8";
    loadModel(format).catch((err) => {
      self.postMessage({ type: "ERROR", error: err.message || String(err) });
    });
  } else if (type === "GENERATE") {
    generate(payload.prompt, payload.reqId).catch((err) => {
      self.postMessage({ type: "ERROR", error: err.message || String(err), reqId: payload.reqId });
    });
  } else if (type === "RESET") {
    session = null;
    tokenizer = null;
    ort = null;
    eosTokenId = FALLBACK_EOS_TOKEN_ID;
    self.postMessage({ type: "STATUS", status: "idle", progress: 0 });
  }
});
