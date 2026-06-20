/**
 * Runs a local LLM on-device with the QVAC SDK and exposes its lifecycle so the
 * UI can show whether the local model is running.
 *
 * QVAC only runs on a **physical device** (not simulators/emulators/web), so on
 * unsupported platforms the status is `unsupported` and nothing is loaded.
 *
 * The `@qvac/sdk` is imported lazily (inside `start`) so its native bindings are
 * never touched on platforms that can't run it.
 *
 * See docs/expo.md for the integration guide.
 */
import * as Device from "expo-device";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

import { log, logError } from "@/lib/log";
import { usePromptSettings } from "@/hooks/use-prompt-settings";

export type QvacStatus =
  | "unsupported"
  | "idle"
  | "downloading"
  | "loading"
  | "ready"
  | "error";

const MODEL_LABEL = "Llama 3.2 1B";
// Context window for the model. Must hold the cleaned email body + the
// instruction prompt + the generated summary; email bodies are capped in
// gmail.ts (MAX_BODY_CHARS) to stay well under this.
const CTX_SIZE = 4096;

type QvacValue = {
  status: QvacStatus;
  /** 0–100 during download/loading, otherwise null. */
  progress: number | null;
  /** Human-readable model name when running. */
  modelName: string | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /**
   * Summarize text with the loaded model. Returns null if the model isn't ready.
   * Calls are serialized internally — the local model runs one completion at a
   * time — so callers can fire many and they queue. Pass `shouldRun` to skip a
   * queued job whose result is no longer needed (e.g. its card unmounted).
   */
  summarize: (
    text: string,
    shouldRun?: () => boolean,
  ) => Promise<string | null>;
  /** Run an arbitrary prompt through the LLM (used by the RAG chat, TODO #13). */
  complete: (
    prompt: string,
    shouldRun?: () => boolean,
  ) => Promise<string | null>;
  /** Lifecycle of the embeddings model, loaded lazily on first RAG use. */
  embeddingStatus: EmbeddingStatus;
  /** 0–100 while the embeddings model downloads/loads, otherwise null. */
  embeddingProgress: number | null;
  /** Embed text with the embeddings model (loads it on demand). */
  embedText: (text: string) => Promise<number[] | null>;
};

export type EmbeddingStatus =
  | "idle"
  | "downloading"
  | "loading"
  | "ready"
  | "error";

const QvacContext = createContext<QvacValue | null>(null);

export function QvacProvider({ children }: PropsWithChildren) {
  const { prompts } = usePromptSettings();
  const supported = Platform.OS !== "web" && Device.isDevice;
  const [status, setStatus] = useState<QvacStatus>(
    supported ? "idle" : "unsupported",
  );
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const modelId = useRef<string | null>(null);
  // Promise chain that serializes completions so only one runs at a time.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  // Embeddings model (for RAG, TODO #13) — loaded lazily on first use.
  const [embeddingStatus, setEmbeddingStatus] =
    useState<EmbeddingStatus>("idle");
  const [embeddingProgress, setEmbeddingProgress] = useState<number | null>(
    null,
  );
  const embedModelId = useRef<string | null>(null);
  const embedLoad = useRef<Promise<string | null> | null>(null);

  async function start() {
    log("qvac", "start() called", {
      supported,
      status,
      platform: Platform.OS,
      isDevice: Device.isDevice,
    });
    if (
      !supported ||
      status === "downloading" ||
      status === "loading" ||
      status === "ready"
    ) {
      log("qvac", "start() ignored (unsupported or already active)");
      return;
    }
    setError(null);
    try {
      log("qvac", "importing @qvac/sdk…");
      const { downloadAsset, loadModel, LLAMA_3_2_1B_INST_Q4_0, VERBOSITY } =
        await import("@qvac/sdk");
      log("qvac", "sdk imported", { model: LLAMA_3_2_1B_INST_Q4_0 });

      setStatus("downloading");
      setProgress(0);
      log("qvac", "downloadAsset start");
      await downloadAsset({
        assetSrc: LLAMA_3_2_1B_INST_Q4_0,
        onProgress: (p) => {
          log("qvac", `download ${Math.round(p.percentage)}%`);
          setProgress(Math.round(p.percentage));
        },
      });
      log("qvac", "downloadAsset done");

      setStatus("loading");
      setProgress(0);
      log("qvac", "loadModel start", { device: "gpu", ctx_size: CTX_SIZE });
      const id = await loadModel({
        modelSrc: LLAMA_3_2_1B_INST_Q4_0,
        modelType: "llm",
        modelConfig: {
          device: "gpu",
          ctx_size: CTX_SIZE,
          verbosity: VERBOSITY.ERROR,
        },
        onProgress: (p) => {
          log("qvac", `load ${Math.round(p.percentage)}%`);
          setProgress(Math.round(p.percentage));
        },
      });
      log("qvac", "loadModel done", { modelId: id });

      modelId.current = id;
      setProgress(null);
      setStatus("ready");
      log("qvac", "status → ready");
    } catch (e) {
      logError("qvac", e, "(failed during start)");
      setError(
        e instanceof Error ? e.message : "Failed to start the local model.",
      );
      setProgress(null);
      setStatus("error");
    }
  }

  // Run a single prompt through the model, serialized behind the queue so
  // completions never overlap. `shouldRun` lets a stale job be skipped.
  async function runCompletion(
    prompt: string,
    shouldRun?: () => boolean,
  ): Promise<string | null> {
    const id = modelId.current;
    if (!id || !prompt) return null;
    const run = queue.current.then(async () => {
      if (shouldRun && !shouldRun()) {
        log("qvac", "completion skipped (no longer needed)");
        return null;
      }
      log("qvac", "completion start", { chars: prompt.length });
      const { completion } = await import("@qvac/sdk");
      const result = completion({
        modelId: id,
        history: [{ role: "user", content: prompt }],
        stream: true,
      });
      let acc = "";
      for await (const token of result.tokenStream) acc += token;
      const out = acc.trim();
      log("qvac", "completion done", { chars: out.length });
      return out;
    });
    // Keep the queue alive even if this run rejects.
    queue.current = run.catch(() => undefined);
    try {
      return await run;
    } catch (e) {
      logError("qvac", e, "(completion failed)");
      return null;
    }
  }

  function summarize(
    text: string,
    shouldRun?: () => boolean,
  ): Promise<string | null> {
    if (!text) return Promise.resolve(null);
    // Instruction is user-editable in Settings; the email body is always
    // appended here so a custom prompt can't break body injection.
    const prompt = `${prompts.summary}\n\nEmail:\n${text}`;
    return runCompletion(prompt, shouldRun);
  }

  // Load the embeddings model once (deduping concurrent callers via a ref).
  async function ensureEmbedModel(): Promise<string | null> {
    if (!supported) return null;
    if (embedModelId.current) return embedModelId.current;
    if (embedLoad.current) return embedLoad.current;
    embedLoad.current = (async () => {
      try {
        log("qvac", "embeddings: loading model");
        const { downloadAsset, loadModel, GTE_LARGE_FP16 } =
          await import("@qvac/sdk");
        setEmbeddingStatus("downloading");
        setEmbeddingProgress(0);
        await downloadAsset({
          assetSrc: GTE_LARGE_FP16,
          onProgress: (p) => {
            log("qvac", `embeddings download ${Math.round(p.percentage)}%`);
            setEmbeddingProgress(Math.round(p.percentage));
          },
        });
        setEmbeddingStatus("loading");
        setEmbeddingProgress(0);
        const id = await loadModel({
          modelSrc: GTE_LARGE_FP16,
          modelType: "llamacpp-embedding",
          onProgress: (p) => {
            log("qvac", `embeddings load ${Math.round(p.percentage)}%`);
            setEmbeddingProgress(Math.round(p.percentage));
          },
        });
        embedModelId.current = id;
        setEmbeddingProgress(null);
        setEmbeddingStatus("ready");
        log("qvac", "embeddings: ready", { id });
        return id;
      } catch (e) {
        logError("qvac", e, "(embeddings load failed)");
        setEmbeddingProgress(null);
        setEmbeddingStatus("error");
        embedLoad.current = null; // allow a retry on the next call
        return null;
      }
    })();
    return embedLoad.current;
  }

  async function embedText(text: string): Promise<number[] | null> {
    if (!text) return null;
    const id = await ensureEmbedModel();
    if (!id) return null;
    try {
      const { embed } = await import("@qvac/sdk");
      const res = await embed({ modelId: id, text });
      return res.embedding ?? null;
    } catch (e) {
      logError("qvac", e, "(embed failed)");
      return null;
    }
  }

  async function stop() {
    const id = modelId.current;
    log("qvac", "stop() called", { modelId: id });
    modelId.current = null;
    if (id) {
      try {
        const { unloadModel } = await import("@qvac/sdk");
        await unloadModel({ modelId: id, clearStorage: false });
        log("qvac", "unloadModel done");
      } catch (e) {
        logError("qvac", e, "(unload failed)");
      }
    }
    if (supported) setStatus("idle");
  }

  // Auto-start the model on mount (on supported devices) so summaries work
  // without a manual tap; unload it when the provider unmounts. `start()` is
  // idempotent — it no-ops if unsupported or already downloading/loading/ready.
  useEffect(() => {
    log("qvac", "provider mounted", {
      supported: Platform.OS !== "web" && Device.isDevice,
      platform: Platform.OS,
      isDevice: Device.isDevice,
    });
    // Defer so the first setState in `start` doesn't run during this effect.
    const timer = setTimeout(() => void start(), 0);
    return () => {
      clearTimeout(timer);
      const ids = [modelId.current, embedModelId.current].filter(
        Boolean,
      ) as string[];
      if (ids.length) {
        import("@qvac/sdk")
          .then(({ unloadModel }) =>
            Promise.all(
              ids.map((id) =>
                unloadModel({ modelId: id, clearStorage: false }),
              ),
            ),
          )
          .catch(() => {});
      }
    };
    // Run once on mount; `start` is stable enough for this purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: QvacValue = {
    status,
    progress,
    modelName: status === "ready" ? MODEL_LABEL : null,
    error,
    start,
    stop,
    summarize,
    complete: runCompletion,
    embeddingStatus,
    embeddingProgress,
    embedText,
  };

  return <QvacContext.Provider value={value}>{children}</QvacContext.Provider>;
}

export function useQvac(): QvacValue {
  const ctx = useContext(QvacContext);
  if (!ctx) {
    throw new Error("useQvac must be used within a QvacProvider");
  }
  return ctx;
}
