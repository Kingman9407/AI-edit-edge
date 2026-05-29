"use client";

import { useCallback, useRef, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL_URL = "/api/model";
const TOKENIZER_MODEL_ID = "HuggingFaceTB/SmolLM2-135M-Instruct";

const IDB_DB_NAME = "edge-llm-cache";
const IDB_STORE = "models";
const IDB_KEY = "smollm2-135m-onnx";

const MAX_NEW_TOKENS = 256;
const EOS_TOKEN_ID = 0; // SmolLM2 uses token 0 as EOS

// ─── Mobile Runtime Debugger ──────────────────────────────────────────────────

function mobileDebug() {
  if (typeof window === "undefined") return;

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string; downlink?: number; rtt?: number };
  };

  // ── Browser / device identity ─────────────────────────────────────────────
  const ua = nav.userAgent ?? "unknown";
  const platform = nav.platform ?? "unknown";
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  // ── Hardware caps ─────────────────────────────────────────────────────────
  const cores = nav.hardwareConcurrency ?? "unknown";
  const memoryGB = nav.deviceMemory ?? "unknown (API not supported)";

  // ── Network ───────────────────────────────────────────────────────────────
  const conn = nav.connection;
  const network = conn
    ? { effectiveType: conn.effectiveType, downlink: conn.downlink, rtt: conn.rtt }
    : "Network Information API not supported";

  // ── WASM support ──────────────────────────────────────────────────────────
  let wasmSupported = false;
  try {
    wasmSupported = typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function";
  } catch { /* ignore */ }

  // ── SharedArrayBuffer / Atomics (needed for multi-threaded ONNX) ──────────
  const sharedArrayBufferSupported = typeof SharedArrayBuffer !== "undefined";
  const atomicsSupported = typeof Atomics !== "undefined";

  // ── SIMD detection via WebAssembly feature probe ──────────────────────────
  let simdSupported = false;
  try {
    // Minimal WASM module using SIMD v128 instruction to probe support
    const simdProbe = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b,
      0x03, 0x02, 0x01, 0x00,
      0x0a, 0x0a, 0x01, 0x08, 0x00, 0xfd, 0x0f, 0x00, 0x00, 0x00, 0x00, 0x0b,
    ]);
    simdSupported = WebAssembly.validate(simdProbe);
  } catch { /* ignore */ }

  // ── IndexedDB availability ────────────────────────────────────────────────
  const idbSupported = typeof indexedDB !== "undefined";

  // ── Screen / viewport ────────────────────────────────────────────────────
  const screen = {
    width: window.screen?.width,
    height: window.screen?.height,
    pixelRatio: window.devicePixelRatio,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };

  // ── Estimated available JS heap (Chrome only) ─────────────────────────────
  const jsHeap = (performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  }).memory ?? null;

  console.group("[EdgeLLM] 📱 Mobile Runtime Diagnostics");
  console.log("Device:", { isMobile, isIOS, isAndroid, platform });
  console.log("UserAgent:", ua);
  console.log("Hardware:", { cores, memoryGB });
  console.log("Network:", network);
  console.log("WASM:", {
    wasmSupported,
    simdSupported,
    sharedArrayBufferSupported,
    atomicsSupported,
    note: !sharedArrayBufferSupported
      ? "⚠️ SharedArrayBuffer unavailable — multi-threaded ONNX will NOT work. Single-thread fallback will be used."
      : "✅ Multi-threading available",
  });
  console.log("Storage:", { idbSupported });
  console.log("Screen:", screen);
  if (jsHeap) {
    console.log("JS Heap:", {
      usedMB: (jsHeap.usedJSHeapSize / 1024 / 1024).toFixed(1),
      totalMB: (jsHeap.totalJSHeapSize / 1024 / 1024).toFixed(1),
      limitMB: (jsHeap.jsHeapSizeLimit / 1024 / 1024).toFixed(1),
    });
  } else {
    console.log("JS Heap: performance.memory not available (non-Chrome browser)");
  }
  console.groupEnd();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type EdgeLLMStatus =
  | "idle"
  | "downloading"
  | "loading"
  | "ready"
  | "error";

export interface EdgeLLMState {
  status: EdgeLLMStatus;
  progress: number; // 0–1 during download
  error: string | null;
  loadModel: () => Promise<void>;
  generate: (prompt: string) => Promise<string>;
  reset: () => void;
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
  // Safari / iOS Chrome often crash or hang indefinitely when trying to write
  // >100MB blobs to IndexedDB in a single transaction.
  const isMobile = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile && buffer.byteLength > 100 * 1024 * 1024) {
    console.warn(`[EdgeLLM] Skipping IndexedDB cache on mobile for large model (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB).`);
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
    console.error(`[EdgeLLM] ⚠️ Failed to cache model in IndexedDB:`, err);
    // We don't throw here. We just continue using the buffer in memory.
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEdgeLLM(): EdgeLLMState {
  const [status, setStatus] = useState<EdgeLLMStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // We store ort session and tokenizer in refs so they survive re-renders
  // and aren't part of React state (they can't be serialized).
  const sessionRef = useRef<import("onnxruntime-web").InferenceSession | null>(null);
  const tokenizerRef = useRef<import("@huggingface/transformers").PreTrainedTokenizer | null>(null);
  const loadingRef = useRef(false);

  const loadModel = useCallback(async () => {
    if (loadingRef.current || status === "ready") return;
    loadingRef.current = true;
    setError(null);

    // ── Run mobile diagnostics immediately on load ──────────────────────────
    mobileDebug();

    try {
      // ── Step 1: Fetch / load from cache ────────────────────────────────────
      setStatus("downloading");
      setProgress(0);

      const t_cacheStart = performance.now();
      let modelBuffer = await getCachedModel();
      const t_cacheEnd = performance.now();
      console.log(`[EdgeLLM] IndexedDB cache lookup: ${(t_cacheEnd - t_cacheStart).toFixed(0)}ms | hit: ${!!modelBuffer}`);

      if (!modelBuffer) {
        console.log("[HuggingFace] No cached model found — fetching from proxy:", MODEL_URL);

        let response: Response;
        try {
          response = await fetch(MODEL_URL);
        } catch (networkErr) {
          console.error(
            "[HuggingFace] ❌ Network error fetching model via proxy.",
            "URL:", MODEL_URL,
            "Error:", networkErr
          );
          throw networkErr;
        }

        if (response.status === 401) {
          console.error(
            "[HuggingFace] ❌ 401 Unauthorized — HF_TOKEN is missing, invalid, or expired.",
            "The server proxy returned a 401. Check HF_TOKEN in .env.local."
          );
          throw new Error("HuggingFace: Unauthorized (401) — check HF_TOKEN.");
        }

        if (response.status === 403) {
          console.error(
            "[HuggingFace] ❌ 403 Forbidden — token lacks access to the model repo.",
            "Check that HF_TOKEN has 'read' scope for the repo."
          );
          throw new Error("HuggingFace: Forbidden (403) — token lacks repo access.");
        }

        if (response.status === 404) {
          console.error(
            "[HuggingFace] ❌ 404 Not Found — model file missing at the proxy URL.",
            "URL:", MODEL_URL,
            "Verify MODEL_URL in .env.local points to a valid HuggingFace file."
          );
          throw new Error("HuggingFace: Model file not found (404).");
        }

        if (!response.ok) {
          console.error(
            `[HuggingFace] ❌ Unexpected HTTP ${response.status} ${response.statusText} from model proxy.`,
            "URL:", MODEL_URL
          );
          throw new Error(`HuggingFace proxy error: ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
          console.error(
            "[HuggingFace] ❌ Model response body is null — cannot read stream.",
            "Status:", response.status
          );
          throw new Error("HuggingFace: Response body is null.");
        }

        // Next.js proxy strips Content-Length on chunked transfers,
        // so we always fall back to the known exact model file size.
        const KNOWN_MODEL_BYTES = 166009881;
        const headerLen = Number(response.headers.get("content-length") ?? 0);
        const contentLength = headerLen > 0 ? headerLen : KNOWN_MODEL_BYTES;
        console.log(`[HuggingFace] Downloading model — expected size: ${contentLength} bytes (~${(contentLength / 1024 / 1024).toFixed(1)} MB).`);

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        const t_downloadStart = performance.now();
        let t_lastLog = t_downloadStart;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            // Clamp to [0, 1] in case bytes exceed expected size
            setProgress(Math.min(received / contentLength, 0.99));
            // Log progress every 10MB
            const now = performance.now();
            if (received % (10 * 1024 * 1024) < (value?.length ?? 0) || now - t_lastLog > 3000) {
              const mbReceived = (received / 1024 / 1024).toFixed(1);
              const mbTotal = (contentLength / 1024 / 1024).toFixed(1);
              const elapsed = ((now - t_downloadStart) / 1000).toFixed(1);
              const speedMBs = (received / 1024 / 1024 / ((now - t_downloadStart) / 1000)).toFixed(2);
              console.log(`[EdgeLLM] 📥 Download progress: ${mbReceived}/${mbTotal} MB | ${elapsed}s elapsed | ${speedMBs} MB/s`);
              t_lastLog = now;
            }
          }
        } catch (streamErr) {
          console.error(
            "[HuggingFace] ❌ Stream read error while downloading model.",
            "Bytes received before failure:", received,
            `(${(received / 1024 / 1024).toFixed(1)} MB of ${(contentLength / 1024 / 1024).toFixed(1)} MB)`,
            "Error:", streamErr
          );
          throw streamErr;
        }

        const t_downloadEnd = performance.now();
        const downloadMs = t_downloadEnd - t_downloadStart;
        console.log(
          `[HuggingFace] ✅ Model download complete — ${received} bytes (${(received / 1024 / 1024).toFixed(1)} MB)`,
          `| Time: ${(downloadMs / 1000).toFixed(2)}s`,
          `| Avg speed: ${(received / 1024 / 1024 / (downloadMs / 1000)).toFixed(2)} MB/s`
        );

        // Combine chunks into single ArrayBuffer
        const t_mergeStart = performance.now();
        const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.byteLength;
        }
        modelBuffer = merged.buffer;
        console.log(`[EdgeLLM] Chunk merge: ${(performance.now() - t_mergeStart).toFixed(0)}ms | buffer size: ${(modelBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`);

        const t_cacheWrite = performance.now();
        await cacheModel(modelBuffer);
        console.log(`[EdgeLLM] IndexedDB write: ${(performance.now() - t_cacheWrite).toFixed(0)}ms`);
      } else {
        console.log("[HuggingFace] ✅ Model loaded from IndexedDB cache — skipping download.");
        setProgress(1);
      }

      // ── Step 2: Create ONNX Runtime session ─────────────────────────────────
      setStatus("loading");

      const t_ortImport = performance.now();
      let ort: typeof import("onnxruntime-web");
      try {
        ort = await import("onnxruntime-web");
      } catch (ortImportErr) {
        console.error(
          "[HuggingFace] ❌ Failed to import onnxruntime-web.",
          "Error:", ortImportErr
        );
        throw ortImportErr;
      }
      console.log(`[EdgeLLM] onnxruntime-web import: ${(performance.now() - t_ortImport).toFixed(0)}ms`);

      // ── Detect device capabilities ─────────────────────────────────────────
      const isMobile = typeof navigator !== "undefined" &&
        /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const hardwareConcurrency = typeof navigator !== "undefined"
        ? navigator.hardwareConcurrency ?? 1
        : 1;
      const hasSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
      const hasAtomics = typeof Atomics !== "undefined";

      // SIMD probe
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

      // Heap snapshot (Chrome only)
      const heapBefore = (performance as Performance & {
        memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
      }).memory ?? null;

      // Force single thread on mobile or when SharedArrayBuffer is unavailable
      const canMultiThread = hasSharedArrayBuffer && hasAtomics;
      const numThreads = (isMobile || !canMultiThread) ? 1 : Math.min(4, hardwareConcurrency);

      console.group("[EdgeLLM] 🔧 ONNX Session Config");
      console.log("Device:", { isMobile, hardwareConcurrency, hasSharedArrayBuffer, hasAtomics, simdOk });
      console.log("Threads:", numThreads, canMultiThread ? "(multi-thread capable)" : "⚠️ (forced single-thread)");
      console.log("Model buffer:", `${(modelBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`);
      if (heapBefore) {
        console.log("Heap before session:", {
          usedMB: (heapBefore.usedJSHeapSize / 1024 / 1024).toFixed(1),
          limitMB: (heapBefore.jsHeapSizeLimit / 1024 / 1024).toFixed(1),
        });
      }
      console.groupEnd();

      ort.env.wasm.proxy = false;        // proxy mode can fail on mobile
      ort.env.wasm.numThreads = numThreads;
      ort.env.wasm.simd = simdOk;        // only enable SIMD if the probe passed

      let session: import("onnxruntime-web").InferenceSession;
      const t_sessionStart = performance.now();
      try {
        console.log("[EdgeLLM] Creating ONNX session — attempt 1 (threads:", numThreads, "simd:", simdOk, ")");
        session = await ort.InferenceSession.create(modelBuffer, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        });
        console.log(`[EdgeLLM] ✅ ONNX session (attempt 1): ${(performance.now() - t_sessionStart).toFixed(0)}ms`);
      } catch (ortSessionErr) {
        // On failure, retry with the most conservative settings (1 thread, no SIMD)
        console.error(
          `[HuggingFace] ❌ ONNX session attempt 1 failed after ${(performance.now() - t_sessionStart).toFixed(0)}ms.`,
          "Retrying with 1 thread / no SIMD...",
          "Error:", ortSessionErr
        );
        try {
          ort.env.wasm.numThreads = 1;
          ort.env.wasm.simd = false;
          const t_retry = performance.now();
          console.log("[EdgeLLM] Creating ONNX session — attempt 2 (threads: 1, simd: false)");
          session = await ort.InferenceSession.create(modelBuffer, {
            executionProviders: ["wasm"],
            graphOptimizationLevel: "basic",
          });
          console.log(`[EdgeLLM] ✅ ONNX session (fallback, attempt 2): ${(performance.now() - t_retry).toFixed(0)}ms`);
        } catch (fallbackErr) {
          console.error(
            "[HuggingFace] ❌ ONNX session creation failed even with 1-thread / no-SIMD fallback.",
            "This device may not support WebAssembly or have enough free memory.",
            "Model size:", `${(modelBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`,
            "Error:", fallbackErr
          );
          throw fallbackErr;
        }
      }

      sessionRef.current = session;

      // Log input names so we can verify the model schema
      console.log("[EdgeLLM] ONNX input names:", session.inputNames);
      console.log("[EdgeLLM] ONNX output names:", session.outputNames);

      const heapAfter = (performance as Performance & {
        memory?: { usedJSHeapSize: number };
      }).memory ?? null;
      if (heapBefore && heapAfter) {
        const heapDeltaMB = ((heapAfter.usedJSHeapSize - heapBefore.usedJSHeapSize) / 1024 / 1024).toFixed(1);
        console.log(`[EdgeLLM] Heap delta from session creation: +${heapDeltaMB} MB`);
      }

      console.log("[HuggingFace] ✅ ONNX InferenceSession created successfully.");

      // ── Step 3: Load tokenizer from HuggingFace CDN ──────────────────────────
      console.log(`[HuggingFace] Loading tokenizer: ${TOKENIZER_MODEL_ID}`);

      const t_tokImport = performance.now();
      let AutoTokenizer: typeof import("@huggingface/transformers").AutoTokenizer;
      try {
        ({ AutoTokenizer } = await import("@huggingface/transformers"));
      } catch (transformersImportErr) {
        console.error(
          "[HuggingFace] ❌ Failed to import @huggingface/transformers.",
          "Error:", transformersImportErr
        );
        throw transformersImportErr;
      }
      console.log(`[EdgeLLM] @huggingface/transformers import: ${(performance.now() - t_tokImport).toFixed(0)}ms`);

      let tokenizer: import("@huggingface/transformers").PreTrainedTokenizer;
      const t_tokLoad = performance.now();
      try {
        tokenizer = await AutoTokenizer.from_pretrained(TOKENIZER_MODEL_ID, {
          progress_callback: (info: unknown) => {
            // Log tokenizer file download progress
            if (info && typeof info === "object") {
              const p = info as { status?: string; file?: string; progress?: number };
              if (p.status === "downloading") {
                console.log(`[EdgeLLM] Tokenizer file: ${p.file ?? "?"} — ${(p.progress ?? 0).toFixed(0)}%`);
              }
            }
          },
        });
      } catch (tokenizerErr) {
        console.error(
          "[HuggingFace] ❌ Failed to load tokenizer from HuggingFace CDN.",
          "Model ID:", TOKENIZER_MODEL_ID,
          `Time elapsed before failure: ${(performance.now() - t_tokLoad).toFixed(0)}ms`,
          "This may be a network error, CORS issue, or the model ID is incorrect.",
          "Error:", tokenizerErr
        );
        throw tokenizerErr;
      }
      console.log(`[EdgeLLM] Tokenizer '${TOKENIZER_MODEL_ID}' loaded: ${(performance.now() - t_tokLoad).toFixed(0)}ms`);

      tokenizerRef.current = tokenizer;
      console.log(`[HuggingFace] ✅ Tokenizer '${TOKENIZER_MODEL_ID}' loaded successfully.`);

      setStatus("ready");
      setProgress(1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[HuggingFace] ❌ loadModel() failed:", msg, err);
      setError(msg);
      setStatus("error");
    } finally {
      loadingRef.current = false;
    }
  }, [status]);

  const generate = useCallback(async (prompt: string): Promise<string> => {
    const session = sessionRef.current;
    const tokenizer = tokenizerRef.current;

    if (!session || !tokenizer) {
      throw new Error("Model is not loaded yet. Call loadModel() first.");
    }

    const ort = await import("onnxruntime-web");

    // ── Tokenise the prompt ─────────────────────────────────────────────────
    const t_tok = performance.now();
    const encoded = await tokenizer(prompt, {
      return_tensor: false,
      add_special_tokens: true,
    });
    let inputIds = Array.from(encoded.input_ids as number[]).map(Number);
    console.log(`[EdgeLLM] Tokenized: ${inputIds.length} tokens in ${(performance.now() - t_tok).toFixed(0)}ms`);

    const generatedTokenIds: bigint[] = [];
    let pastKeyValues: Record<string, import("onnxruntime-web").Tensor> = {};
    let firstStep = true;
    const t_genStart = performance.now();
    let totalStepMs = 0;

    for (let step = 0; step < MAX_NEW_TOKENS; step++) {
      const currentIds = firstStep ? inputIds : [inputIds[inputIds.length - 1]];

      const inputTensor = new ort.Tensor(
        "int64",
        new BigInt64Array(currentIds.map(BigInt)),
        [1, currentIds.length]
      );

      const attentionMask = firstStep
        ? new ort.Tensor(
            "int64",
            new BigInt64Array(inputIds.map(() => BigInt(1))),
            [1, inputIds.length]
          )
        : new ort.Tensor("int64", new BigInt64Array([BigInt(1)]), [1, 1]);

      const positionIds = firstStep
        ? new ort.Tensor(
            "int64",
            new BigInt64Array(Array.from({ length: inputIds.length }, (_, i) => BigInt(i))),
            [1, inputIds.length]
          )
        : new ort.Tensor(
            "int64",
            new BigInt64Array([BigInt(inputIds.length - 1)]),
            [1, 1]
          );

      const feeds: Record<string, import("onnxruntime-web").Tensor> = {
        input_ids: inputTensor,
        attention_mask: attentionMask,
        position_ids: positionIds,
        ...pastKeyValues,
      };

      const t_step = performance.now();
      let results: Awaited<ReturnType<typeof session.run>>;
      try {
        results = await session.run(feeds);
      } catch (inferErr) {
        console.error(
          `[EdgeLLM] ❌ ONNX inference failed at step ${step}.`,
          "Generated tokens so far:", generatedTokenIds.length,
          "Input ids length:", inputIds.length,
          "Error:", inferErr
        );
        throw inferErr;
      }
      const stepMs = performance.now() - t_step;
      totalStepMs += stepMs;

      // Log first step timing (most representative for mobile)
      if (step === 0) {
        console.log(`[EdgeLLM] First inference step: ${stepMs.toFixed(0)}ms (input tokens: ${inputIds.length})`);
      }

      // Extract next token (greedy)
      const logits = results["logits"] as import("onnxruntime-web").Tensor;
      const logitsData = logits.data as Float32Array;
      const vocabSize = logits.dims[logits.dims.length - 1];
      const lastTokenLogits = logitsData.slice(
        logitsData.length - vocabSize,
        logitsData.length
      );

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
        console.log(`[EdgeLLM] EOS reached at step ${step}.`);
        break;
      }

      // Update past key values for next step
      pastKeyValues = {};
      for (const key of Object.keys(results)) {
        if (key !== "logits") {
          // Map "present.*" → "past_key_values.*"
          const feedKey = key.replace(/^present/, "past_key_values");
          pastKeyValues[feedKey] = results[key] as import("onnxruntime-web").Tensor;
        }
      }

      inputIds = [...inputIds, Number(nextToken)];
      firstStep = false;
    }

    const totalGenMs = performance.now() - t_genStart;
    const tokensGenerated = generatedTokenIds.length;
    console.log(
      `[EdgeLLM] Generation complete: ${tokensGenerated} tokens`,
      `| Total: ${(totalGenMs / 1000).toFixed(2)}s`,
      `| Avg per token: ${(totalStepMs / Math.max(tokensGenerated, 1)).toFixed(0)}ms`,
      `| Tokens/sec: ${(tokensGenerated / (totalGenMs / 1000)).toFixed(2)}`
    );

    // Decode generated tokens
    const t_decode = performance.now();
    const decoded = await tokenizer.decode(
      generatedTokenIds.map(Number),
      { skip_special_tokens: true }
    );
    console.log(`[EdgeLLM] Decode: ${(performance.now() - t_decode).toFixed(0)}ms | output: "${decoded.slice(0, 80)}..."`);

    return decoded.trim();
  }, []);

  const reset = useCallback(() => {
    sessionRef.current = null;
    tokenizerRef.current = null;
    loadingRef.current = false;
    setStatus("idle");
    setProgress(0);
    setError(null);
  }, []);

  return { status, progress, error, loadModel, generate, reset };
}
