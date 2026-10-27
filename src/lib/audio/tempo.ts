/**
 * Tempo range passed to the detector (the library default). A wider range makes
 * it lock onto 2/3 or 3/2 of the real tempo; slower or faster feels are offered
 * through the half-time / double-time corrections instead.
 */
export const TEMPO_RANGE = { minTempo: 90, maxTempo: 180 } as const;

/** Relative spread between segments above which the tempo is flagged as variable. */
export const VARIABLE_TEMPO_THRESHOLD = 0.06;

export type TempoConfidence = "high" | "medium" | "low";

export interface TempoEstimate {
  /** Proposed BPM, rounded to one decimal. */
  bpm: number;
  /** Half-time and double-time readings, offered as one-click corrections. */
  halfTime: number | null;
  doubleTime: number | null;
  /** True when segments of the track disagree beyond octave errors. */
  variable: boolean;
  /** Min / max BPM measured across segments (after octave folding). */
  range: { min: number; max: number } | null;
  confidence: TempoConfidence;
  segmentBpms: number[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Brings `bpm` to the octave closest to `reference`. Beat trackers often lock on
 * half or double the real tempo, so a segment at 64 BPM next to a global 128 BPM
 * is the same tempo, not a tempo change.
 */
export function foldToReference(bpm: number, reference: number): number {
  let folded = bpm;
  while (folded / reference > Math.SQRT2) folded /= 2;
  while (reference / folded > Math.SQRT2) folded *= 2;
  return folded;
}

export function isValidBpm(bpm: unknown): bpm is number {
  return typeof bpm === "number" && Number.isFinite(bpm) && bpm > 0;
}

/**
 * Combines the global detection with per-segment detections into a single
 * estimate. Segment values that failed (null) are ignored.
 */
export function summarizeTempo(globalBpm: number, segmentBpms: Array<number | null>): TempoEstimate {
  if (!isValidBpm(globalBpm)) throw new Error("Invalid global BPM");

  const segments = segmentBpms.filter(isValidBpm).map((b) => foldToReference(b, globalBpm));

  let variable = false;
  let range: TempoEstimate["range"] = null;
  let confidence: TempoConfidence = "medium";

  if (segments.length >= 2) {
    const min = Math.min(...segments);
    const max = Math.max(...segments);
    range = { min: round1(min), max: round1(max) };
    const spread = (max - min) / globalBpm;
    variable = spread > VARIABLE_TEMPO_THRESHOLD;
    const agreeing = segments.filter((s) => Math.abs(s - globalBpm) / globalBpm <= 0.03).length;
    confidence = variable ? "low" : agreeing === segments.length ? "high" : "medium";
  }

  const half = globalBpm / 2;
  const double = globalBpm * 2;

  return {
    bpm: round1(globalBpm),
    halfTime: half >= 40 ? round1(half) : null,
    doubleTime: double <= 250 ? round1(double) : null,
    variable,
    range: variable ? range : null,
    confidence,
    segmentBpms: segments.map(round1),
  };
}

/**
 * Picks analysis windows (offset, duration in seconds) spread over the track so
 * tempo changes can be noticed. Short tracks get no extra segments.
 */
export function segmentWindows(durationSeconds: number, windowSeconds = 20): Array<[number, number]> {
  if (durationSeconds < windowSeconds * 3) return [];
  return [0.2, 0.5, 0.8].map((position) => {
    const offset = Math.max(0, Math.min(durationSeconds - windowSeconds, durationSeconds * position - windowSeconds / 2));
    return [round1(offset), windowSeconds];
  });
}
