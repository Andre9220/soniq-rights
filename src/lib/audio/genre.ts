/** Output classes of the Essentia "genre_rosamerica-musicnn-msd-2" model, in model order. */
export const GENRE_CLASSES = ["cla", "dan", "hip", "jaz", "pop", "rhy", "roc", "spe"] as const;
export type GenreClass = (typeof GENRE_CLASSES)[number];

export const GENRE_LABELS: Record<GenreClass, string> = {
  cla: "Classique",
  dan: "Électro / Dance",
  hip: "Hip-hop / Rap",
  jaz: "Jazz",
  pop: "Pop",
  rhy: "R&B / Soul",
  roc: "Rock",
  spe: "Parlé",
};

export interface GenreCandidate {
  id: GenreClass;
  label: string;
  /** Share of the probability mass, 0–1. */
  probability: number;
}

export interface GenreEstimate {
  candidates: GenreCandidate[];
  /** Top candidate is clearly ahead of the second one. */
  confident: boolean;
  /** The excerpt is mostly speech (podcast, spoken word): no genre proposed. */
  speech: boolean;
}

/** Minimum lead of the first candidate over the second to call the result confident. */
export const GENRE_CONFIDENCE_MARGIN = 0.15;

/**
 * Averages the per-patch predictions of the model (one row of 8 sigmoid scores
 * per ~3 s patch) and returns the top candidates, normalised to sum to 1.
 */
export function summarizeGenre(patchPredictions: ArrayLike<number>[], topN = 3): GenreEstimate {
  const rows = patchPredictions.filter((row) => row.length === GENRE_CLASSES.length);
  if (rows.length === 0) throw new Error("No genre predictions");

  const mean = GENRE_CLASSES.map((_, i) => rows.reduce((sum, row) => sum + (Number.isFinite(row[i]) ? row[i] : 0), 0) / rows.length);
  const total = mean.reduce((a, b) => a + b, 0);
  if (!(total > 0)) throw new Error("Empty genre predictions");

  const ranked = GENRE_CLASSES.map((id, i) => ({ id, label: GENRE_LABELS[id], probability: mean[i] / total })).sort(
    (a, b) => b.probability - a.probability,
  );

  const speech = ranked[0].id === "spe";
  const musical = ranked.filter((c) => c.id !== "spe");
  const candidates = musical.slice(0, topN).map((c) => ({ ...c, probability: Math.round(c.probability * 100) / 100 }));
  const confident = !speech && musical.length > 1 && musical[0].probability - musical[1].probability >= GENRE_CONFIDENCE_MARGIN;

  return { candidates, confident, speech };
}

/**
 * Picks the excerpt to classify: up to `maxSeconds` centred in the track, which
 * skips intros/outros and bounds the processing time on long files.
 */
export function genreExcerpt(durationSeconds: number, maxSeconds = 30): { offset: number; duration: number } {
  if (durationSeconds <= maxSeconds) return { offset: 0, duration: durationSeconds };
  return { offset: (durationSeconds - maxSeconds) / 2, duration: maxSeconds };
}
