"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  loadModel: (format?: "int8" | "fp16" | "fp32") => Promise<void>;
  generate: (prompt: string, onToken?: (token: string) => void) => Promise<string>;
  reset: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEdgeLLM(): EdgeLLMState {
  const [status, setStatus] = useState<EdgeLLMStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const reqIdRef = useRef(0);
  const resolversRef = useRef<Map<number, { resolve: (val: string) => void, reject: (err: Error) => void, onToken?: (val: string) => void }>>(new Map());

  // Initialize Web Worker
  useEffect(() => {
    if (typeof window !== "undefined") {
      workerRef.current = new Worker(new URL("./edge-llm.worker.ts", import.meta.url));
      
      workerRef.current.onmessage = (e) => {
        const data = e.data;
        if (data.type === "STATUS") {
          setStatus(data.status);
          setProgress(data.progress);
        } else if (data.type === "ERROR") {
          if (data.reqId !== undefined) {
            const resolver = resolversRef.current.get(data.reqId);
            if (resolver) {
              resolver.reject(new Error(data.error));
              resolversRef.current.delete(data.reqId);
            }
          } else {
            setError(data.error);
            setStatus("error");
          }
        } else if (data.type === "PARTIAL") {
          const resolver = resolversRef.current.get(data.reqId);
          if (resolver && resolver.onToken) {
            resolver.onToken(data.text);
          }
        } else if (data.type === "DONE") {
          const resolver = resolversRef.current.get(data.reqId);
          if (resolver) {
            resolver.resolve(data.text);
            resolversRef.current.delete(data.reqId);
          }
        }
      };
    }
    
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const loadModel = useCallback(async (format: "int8" | "fp16" | "fp32" = "int8") => {
    if (status === "ready" || status === "loading" || status === "downloading") return;
    setError(null);
    workerRef.current?.postMessage({ type: "LOAD", payload: { format } });
  }, [status]);

  const generate = useCallback((prompt: string, onToken?: (token: string) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (status !== "ready") {
        reject(new Error("Model is not loaded yet. Call loadModel() first."));
        return;
      }
      const reqId = reqIdRef.current++;
      resolversRef.current.set(reqId, { resolve, reject, onToken });
      workerRef.current?.postMessage({ type: "GENERATE", payload: { prompt, reqId } });
    });
  }, [status]);

  const reset = useCallback(() => {
    setError(null);
    workerRef.current?.postMessage({ type: "RESET" });
  }, []);

  return { status, progress, error, loadModel, generate, reset };
}
