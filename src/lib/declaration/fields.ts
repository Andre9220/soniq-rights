import type { AudioAnalysis } from "@/lib/audio/analyzer";

/**
 * Where a field value comes from:
 * - empty:     nothing entered yet
 * - auto:      prefilled from the audio file, not yet confirmed
 * - confirmed: prefilled, then validated by the user
 * - manual:    typed or corrected by the user
 */
export type FieldSource = "empty" | "auto" | "confirmed" | "manual";

export interface TrackedField {
  value: string;
  source: FieldSource;
}

export type AutoFieldKey = "title" | "duration" | "bpm" | "genre";

export type AutoFields = Record<AutoFieldKey, TrackedField>;

/** A detected value that was not applied because the user already filled the field. */
export type Suggestions = Partial<Record<AutoFieldKey, string>>;

export const emptyField = (): TrackedField => ({ value: "", source: "empty" });

export function detectedValues(analysis: AudioAnalysis): Suggestions {
  const values: Suggestions = { duration: analysis.durationLabel };
  if (analysis.tempo) values.bpm = String(analysis.tempo.bpm).replace(".", ",");
  if (analysis.title) values.title = analysis.title.title;
  // A genre is only prefilled when the model is clearly confident; otherwise
  // the candidates are shown on the audio card for the user to pick from.
  if (analysis.genre?.confident) values.genre = analysis.genre.candidates[0].label;
  return values;
}

/**
 * Applies detected values without ever overwriting user input: a field is
 * filled only if it is empty or still holds an unconfirmed auto value (e.g. the
 * file was replaced). Otherwise the detected value becomes a suggestion the user
 * can accept explicitly.
 */
export function applyDetection(fields: AutoFields, detected: Suggestions): { fields: AutoFields; suggestions: Suggestions } {
  const next = { ...fields };
  const suggestions: Suggestions = {};

  for (const key of Object.keys(detected) as AutoFieldKey[]) {
    const value = detected[key];
    if (value === undefined) continue;
    const current = fields[key];
    if (current.source === "empty" || current.source === "auto" || current.value.trim() === "") {
      next[key] = { value, source: "auto" };
    } else if (current.value !== value) {
      suggestions[key] = value;
    }
  }
  return { fields: next, suggestions };
}

/** When a file is removed, unconfirmed auto values go with it. */
export function clearAutoValues(fields: AutoFields): AutoFields {
  const next = { ...fields };
  for (const key of Object.keys(next) as AutoFieldKey[]) {
    if (next[key].source === "auto") next[key] = emptyField();
  }
  return next;
}

export function confirmAutoValues(fields: AutoFields): AutoFields {
  const next = { ...fields };
  for (const key of Object.keys(next) as AutoFieldKey[]) {
    if (next[key].source === "auto") next[key] = { ...next[key], source: "confirmed" };
  }
  return next;
}

export function editField(value: string): TrackedField {
  return value === "" ? emptyField() : { value, source: "manual" };
}

/** Parses a BPM typed with either a comma or a dot. */
export function parseBpm(input: string): number | null {
  const n = Number(input.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 20 && n <= 300 ? n : null;
}
