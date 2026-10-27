import { formatDuration } from "./duration";
import { validateAudioFile } from "./formats";
import { segmentWindows, summarizeTempo, TEMPO_RANGE, type TempoEstimate } from "./tempo";
import { suggestTitle, type TitleSource } from "./title";

/** Subset of `web-audio-beat-detector` used here, injectable for tests. */
export interface BeatDetector {
  guess(
    buffer: AudioBuffer,
    ...args: [number, number, { minTempo: number; maxTempo: number }] | [{ minTempo: number; maxTempo: number }]
  ): Promise<{ bpm: number; offset: number }>;
}

export interface AudioContextLike {
  decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer>;
  close(): Promise<void>;
  readonly state: string;
}

export interface AnalyzerDeps {
  createAudioContext: () => AudioContextLike;
  loadDetector: () => Promise<BeatDetector>;
}

export type AnalysisErrorCode = "unsupported-format" | "empty" | "too-large" | "decode-failed" | "aborted";

export class AudioAnalysisError extends Error {
  constructor(
    public readonly code: AnalysisErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AudioAnalysisError";
  }
}

export interface AudioAnalysis {
  durationSeconds: number;
  durationLabel: string;
  /** null when tempo detection failed — the duration is still usable. */
  tempo: TempoEstimate | null;
  tempoError: string | null;
  title: { title: string; source: TitleSource } | null;
}

export type AnalysisStage = "reading" | "decoding" | "tempo";

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new AudioAnalysisError("aborted", "Analyse annulée.");
}

/**
 * Decodes the file in the browser, reads its duration, then estimates the BPM.
 * The AudioContext is always closed, whatever the outcome. Detection failures
 * never reject: they are reported through `tempoError`.
 */
export async function analyzeAudioFile(
  file: File,
  deps: AnalyzerDeps,
  options: { signal?: AbortSignal; onStage?: (stage: AnalysisStage) => void } = {},
): Promise<AudioAnalysis> {
  const { signal, onStage } = options;

  const validation = validateAudioFile(file);
  if (!validation.ok) throw new AudioAnalysisError(validation.reason, validation.message);

  onStage?.("reading");
  const bytes = await file.arrayBuffer();
  throwIfAborted(signal);

  // Metadata first: decodeAudioData detaches the buffer it receives.
  const title = suggestTitle(file.name, bytes);

  const context = deps.createAudioContext();
  try {
    onStage?.("decoding");
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await context.decodeAudioData(bytes);
    } catch {
      throw new AudioAnalysisError(
        "decode-failed",
        "Impossible de lire ce fichier audio. Il est peut-être corrompu ou encodé dans un format non pris en charge.",
      );
    }
    throwIfAborted(signal);

    const durationSeconds = audioBuffer.duration;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new AudioAnalysisError("decode-failed", "Durée illisible : le fichier ne contient pas d'audio exploitable.");
    }

    onStage?.("tempo");
    let tempo: TempoEstimate | null = null;
    let tempoError: string | null = null;
    try {
      const detector = await deps.loadDetector();
      throwIfAborted(signal);
      const global = await detector.guess(audioBuffer, { ...TEMPO_RANGE });
      throwIfAborted(signal);

      const segments: Array<number | null> = [];
      for (const [offset, duration] of segmentWindows(durationSeconds)) {
        try {
          segments.push((await detector.guess(audioBuffer, offset, duration, { ...TEMPO_RANGE })).bpm);
        } catch {
          segments.push(null);
        }
        throwIfAborted(signal);
      }
      tempo = summarizeTempo(global.bpm, segments);
    } catch (error) {
      if (error instanceof AudioAnalysisError && error.code === "aborted") throw error;
      tempoError = "Tempo non détecté (rythme peu marqué ou morceau trop court). Saisissez le BPM manuellement.";
    }

    return { durationSeconds, durationLabel: formatDuration(durationSeconds), tempo, tempoError, title };
  } finally {
    if (context.state !== "closed") await context.close().catch(() => undefined);
  }
}

/** Browser implementation of the analyzer dependencies. */
export const browserAnalyzerDeps: AnalyzerDeps = {
  createAudioContext: () => {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) throw new AudioAnalysisError("decode-failed", "Votre navigateur ne prend pas en charge Web Audio API.");
    return new Ctor();
  },
  loadDetector: async () => (await import("web-audio-beat-detector")) as unknown as BeatDetector,
};
