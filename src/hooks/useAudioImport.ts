"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzeAudioFile,
  AudioAnalysisError,
  browserAnalyzerDeps,
  type AnalysisStage,
  type AnalyzerDeps,
  type AudioAnalysis,
} from "@/lib/audio/analyzer";
import { validateAudioFile } from "@/lib/audio/formats";

export type AudioImportState =
  | { status: "idle" }
  | { status: "rejected"; message: string }
  | { status: "analyzing"; file: File; url: string; stage: AnalysisStage }
  | { status: "ready"; file: File; url: string; analysis: AudioAnalysis }
  | { status: "failed"; file: File; url: string; message: string };

/**
 * Owns the imported file: one analysis at a time, previous analysis aborted
 * when a file is replaced or removed, object URLs revoked when no longer used.
 */
export function useAudioImport(onAnalyzed: (analysis: AudioAnalysis) => void, deps: AnalyzerDeps = browserAnalyzerDeps) {
  const [state, setState] = useState<AudioImportState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);
  const onAnalyzedRef = useRef(onAnalyzed);
  useEffect(() => {
    onAnalyzedRef.current = onAnalyzed;
  }, [onAnalyzed]);

  const releaseCurrent = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  useEffect(() => releaseCurrent, [releaseCurrent]);

  const importFile = useCallback(
    async (file: File): Promise<string | null> => {
      const validation = validateAudioFile(file);
      if (!validation.ok) {
        // Keep the current file if there is one: a bad drop shouldn't lose it.
        if (!urlRef.current) setState({ status: "rejected", message: validation.message });
        return validation.message;
      }

      releaseCurrent();
      const controller = new AbortController();
      controllerRef.current = controller;
      const url = URL.createObjectURL(file);
      urlRef.current = url;

      setState({ status: "analyzing", file, url, stage: "reading" });
      try {
        const analysis = await analyzeAudioFile(file, deps, {
          signal: controller.signal,
          onStage: (stage) => {
            if (!controller.signal.aborted) setState({ status: "analyzing", file, url, stage });
          },
        });
        if (controller.signal.aborted) return null;
        setState({ status: "ready", file, url, analysis });
        onAnalyzedRef.current(analysis);
      } catch (error) {
        if (controller.signal.aborted) return null;
        const message =
          error instanceof AudioAnalysisError ? error.message : "Analyse impossible. Vous pouvez saisir les informations manuellement.";
        setState({ status: "failed", file, url, message });
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
      return null;
    },
    [deps, releaseCurrent],
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState((s) =>
      s.status === "analyzing" ? { status: "failed", file: s.file, url: s.url, message: "Analyse annulée. Saisissez les valeurs manuellement." } : s,
    );
  }, []);

  const remove = useCallback(() => {
    releaseCurrent();
    setState({ status: "idle" });
  }, [releaseCurrent]);

  return { state, importFile, cancel, remove };
}
