import type { AutoFields, TrackedField } from "./fields";

export const DRAFT_STORAGE_KEY = "soniq-rights:declaration-draft:v1";

export interface RightsHolder {
  id: string;
  name: string;
  role: "auteur" | "compositeur" | "arrangeur" | "editeur";
  share: string;
}

export interface DeclarationDraft {
  step: number;
  work: AutoFields & {
    genre: TrackedField;
    isrc: TrackedField;
  };
  rightsHolders: RightsHolder[];
  updatedAt: string | null;
}

const field = (): TrackedField => ({ value: "", source: "empty" });

export function createEmptyDraft(): DeclarationDraft {
  return {
    step: 0,
    work: { title: field(), duration: field(), bpm: field(), genre: field(), isrc: field() },
    rightsHolders: [{ id: "rh-1", name: "", role: "auteur", share: "" }],
    updatedAt: null,
  };
}

/**
 * Only values the user typed or confirmed are persisted. Unconfirmed auto
 * values depend on a file that is not stored, so they are dropped.
 */
export function serializeDraft(draft: DeclarationDraft): string {
  const work = Object.fromEntries(
    Object.entries(draft.work).map(([key, f]) => [key, f.source === "auto" ? field() : f]),
  );
  return JSON.stringify({ ...draft, work, updatedAt: new Date().toISOString() });
}

export function deserializeDraft(raw: string | null): DeclarationDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DeclarationDraft>;
    const base = createEmptyDraft();
    if (!parsed || typeof parsed !== "object" || !parsed.work) return null;
    const work = { ...base.work };
    for (const key of Object.keys(work) as Array<keyof DeclarationDraft["work"]>) {
      const f = parsed.work[key];
      if (f && typeof f.value === "string" && ["empty", "confirmed", "manual"].includes(f.source)) work[key] = f;
    }
    return {
      step: typeof parsed.step === "number" ? parsed.step : 0,
      work,
      rightsHolders: Array.isArray(parsed.rightsHolders) && parsed.rightsHolders.length ? parsed.rightsHolders : base.rightsHolders,
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return null;
  }
}

export function loadDraft(): DeclarationDraft | null {
  try {
    return deserializeDraft(window.localStorage.getItem(DRAFT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveDraft(draft: DeclarationDraft): void {
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, serializeDraft(draft));
  } catch {
    // Storage full or disabled: the declaration keeps working in memory.
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {}
}
