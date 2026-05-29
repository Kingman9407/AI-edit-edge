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
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const req = tx.objectStore(IDB_STORE).put(buffer, IDB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore cache write errors
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

    try {
      // ── Step 1: Fetch / load from cache ────────────────────────────────────
      setStatus("downloading");
      setProgress(0);

      let modelBuffer = await getCachedModel();

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
        console.log(`[HuggingFace] Downloading model — expected size: ${contentLength} bytes.`);

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            // Clamp to [0, 1] in case bytes exceed expected size
            setProgress(Math.min(received / contentLength, 0.99));
          }
        } catch (streamErr) {
          console.error(
            "[HuggingFace] ❌ Stream read error while downloading model.",
            "Bytes received before failure:", received,
            "Error:", streamErr
          );
          throw streamErr;
        }

        console.log(`[HuggingFace] ✅ Model download complete — ${received} bytes received.`);

        // Combine chunks into single ArrayBuffer
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
        console.log("[HuggingFace] ✅ Model loaded from IndexedDB cache — skipping download.");
        setProgress(1);
      }

      // ── Step 2: Create ONNX Runtime session ─────────────────────────────────
      setStatus("loading");

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

      // Detect mobile / low-memory devices
      const isMobile = typeof navigator !== "undefined" &&
        /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const hardwareConcurrency = typeof navigator !== "undefined"
        ? navigator.hardwareConcurrency ?? 1
        : 1;

      // Force single thread on mobile to avoid SharedArrayBuffer / Atomics issues
      const numThreads = isMobile ? 1 : Math.min(4, hardwareConcurrency);

      console.log("[HuggingFace] ONNX session config:", {
        isMobile,
        hardwareConcurrency,
        numThreads,
        modelBufferBytes: modelBuffer.byteLength,
      });

      ort.env.wasm.proxy = false;        // proxy mode can fail on mobile
      ort.env.wasm.numThreads = numThreads;
      ort.env.wasm.simd = true;          // SIMD is widely supported; speeds up inference

      let session: import("onnxruntime-web").InferenceSession;
      try {
        session = await ort.InferenceSession.create(modelBuffer, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        });
      } catch (ortSessionErr) {
        // On failure, retry with the most conservative settings (1 thread, no SIMD)
        console.error(
          "[HuggingFace] ❌ ONNX InferenceSession creation failed. Retrying with single thread / no SIMD...",
          "Model buffer size (bytes):", modelBuffer.byteLength,
          "Error:", ortSessionErr
        );
        try {
          ort.env.wasm.numThreads = 1;
          ort.env.wasm.simd = false;
          session = await ort.InferenceSession.create(modelBuffer, {
            executionProviders: ["wasm"],
            graphOptimizationLevel: "basic",
          });
          console.log("[HuggingFace] ✅ ONNX session created with fallback settings (1 thread, no SIMD).");
        } catch (fallbackErr) {
          console.error(
            "[HuggingFace] ❌ ONNX session creation failed even with fallback settings.",
            "This device may not support WASM or have enough memory.",
            "Error:", fallbackErr
          );
          throw fallbackErr;
        }
      }

      sessionRef.current = session;
      console.log("[HuggingFace] ✅ ONNX InferenceSession created successfully.");

      // ── Step 3: Load tokenizer from HuggingFace CDN ──────────────────────────
      console.log(`[HuggingFace] Loading tokenizer: ${TOKENIZER_MODEL_ID}`);
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

      let tokenizer: import("@huggingface/transformers").PreTrainedTokenizer;
      try {
        tokenizer = await AutoTokenizer.from_pretrained(TOKENIZER_MODEL_ID, {
          progress_callback: undefined,
        });
      } catch (tokenizerErr) {
        console.error(
          "[HuggingFace] ❌ Failed to load tokenizer from HuggingFace CDN.",
          "Model ID:", TOKENIZER_MODEL_ID,
          "This may be a network error, CORS issue, or the model ID is incorrect.",
          "Error:", tokenizerErr
        );
        throw tokenizerErr;
      }

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

    // Tokenise the prompt
    const encoded = await tokenizer(prompt, {
      return_tensor: false,
      add_special_tokens: true,
    });

    // Build initial input_ids (Transformers.js default returns arrays when return_tensor is false)
    let inputIds = Array.from(encoded.input_ids as number[]).map(Number);

    const generatedTokenIds: bigint[] = [];
    let pastKeyValues: Record<string, import("onnxruntime-web").Tensor> = {};
    let firstStep = true;

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


      // For models exported WITHOUT past_key_values on first step,
      // we skip pkv on step 0
      if (!firstStep) {
        // past_key_values already in feeds via spread
      }

      const results = await session.run(feeds);

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

      if (Number(nextToken) === EOS_TOKEN_ID) break;

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

    // Decode generated tokens
    const decoded = await tokenizer.decode(
      generatedTokenIds.map(Number),
      { skip_special_tokens: true }
    );

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
