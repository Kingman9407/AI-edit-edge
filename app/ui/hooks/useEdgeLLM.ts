"use client";

import { useCallback, useRef, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL_URL =
  "https://media.githubusercontent.com/media/Kingman9407/AI-edit-openrouter/main/trainer/fine_tuned_smollm_onnx/model.onnx";

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
        const response = await fetch(MODEL_URL);
        if (!response.ok) {
          throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
        }

        const contentLength = Number(response.headers.get("content-length") ?? 0);
        const reader = response.body!.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (contentLength > 0) {
            setProgress(received / contentLength);
          }
        }

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
        setProgress(1);
      }

      // ── Step 2: Create ONNX Runtime session ─────────────────────────────────
      setStatus("loading");

      const ort = await import("onnxruntime-web");

      // Use WASM backend (safe, cross-browser). Multi-threaded if COOP/COEP set.
      ort.env.wasm.proxy = false;
      ort.env.wasm.numThreads = Math.min(
        4,
        typeof navigator !== "undefined" ? navigator.hardwareConcurrency ?? 2 : 2
      );

      const session = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });

      sessionRef.current = session;

      // ── Step 3: Load tokenizer from HuggingFace CDN ──────────────────────────
      const { AutoTokenizer } = await import("@huggingface/transformers");
      const tokenizer = await AutoTokenizer.from_pretrained(TOKENIZER_MODEL_ID, {
        progress_callback: undefined,
      });
      tokenizerRef.current = tokenizer;

      setStatus("ready");
      setProgress(1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
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
      return_tensor: "np",
      add_special_tokens: true,
    });

    // Build initial input_ids as BigInt64Array (ONNX expects int64)
    let inputIds = Array.from(encoded.input_ids.data as BigInt64Array);

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
            new BigInt64Array(inputIds.map(() => 1n)),
            [1, inputIds.length]
          )
        : new ort.Tensor("int64", new BigInt64Array([1n]), [1, 1]);

      const feeds: Record<string, import("onnxruntime-web").Tensor> = {
        input_ids: inputTensor,
        attention_mask: attentionMask,
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
      new Int32Array(generatedTokenIds.map(Number)),
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
