import { describe, expect, it } from "vitest";
import { createEmptyDraft, deserializeDraft, serializeDraft } from "@/lib/declaration/draft";
import {
  applyDetection,
  clearAutoValues,
  confirmAutoValues,
  editField,
  emptyField,
  parseBpm,
  type AutoFields,
} from "@/lib/declaration/fields";

const empty = (): AutoFields => ({ title: emptyField(), duration: emptyField(), bpm: emptyField(), genre: emptyField() });
const detected = { title: "Nuit Blanche", duration: "3:42", bpm: "120" };

describe("applyDetection", () => {
  it("prefills empty fields and marks them as auto", () => {
    const { fields, suggestions } = applyDetection(empty(), detected);
    expect(fields.title).toEqual({ value: "Nuit Blanche", source: "auto" });
    expect(fields.duration).toEqual({ value: "3:42", source: "auto" });
    expect(fields.bpm).toEqual({ value: "120", source: "auto" });
    expect(suggestions).toEqual({});
  });

  it("never overwrites a title the user already entered", () => {
    const fields = { ...empty(), title: editField("Mon vrai titre") };
    const result = applyDetection(fields, detected);
    expect(result.fields.title).toEqual({ value: "Mon vrai titre", source: "manual" });
    expect(result.suggestions.title).toBe("Nuit Blanche");
  });

  it("never overwrites confirmed values", () => {
    const fields: AutoFields = { ...empty(), bpm: { value: "90", source: "confirmed" } };
    const result = applyDetection(fields, detected);
    expect(result.fields.bpm.value).toBe("90");
    expect(result.suggestions.bpm).toBe("120");
  });

  it("replaces unconfirmed auto values when the file is replaced", () => {
    const first = applyDetection(empty(), detected).fields;
    const second = applyDetection(first, { title: "Autre", duration: "2:10", bpm: "95" });
    expect(second.fields.duration).toEqual({ value: "2:10", source: "auto" });
    expect(second.suggestions).toEqual({});
  });

  it("leaves the BPM untouched when detection failed", () => {
    const { fields } = applyDetection(empty(), { duration: "3:42" });
    expect(fields.bpm).toEqual(emptyField());
  });

  it("does not suggest a value identical to the current one", () => {
    const fields = { ...empty(), duration: editField("3:42") };
    expect(applyDetection(fields, detected).suggestions.duration).toBeUndefined();
  });
});

describe("confirm / clear", () => {
  it("confirms only auto values", () => {
    const fields = { ...applyDetection(empty(), detected).fields, title: editField("Manuel") };
    const confirmed = confirmAutoValues(fields);
    expect(confirmed.duration.source).toBe("confirmed");
    expect(confirmed.title.source).toBe("manual");
  });

  it("clears only unconfirmed auto values when the file is removed", () => {
    const fields = confirmAutoValues(applyDetection(empty(), { duration: "3:42" }).fields);
    const withAutoBpm = applyDetection(fields, { bpm: "120" }).fields;
    const cleared = clearAutoValues(withAutoBpm);
    expect(cleared.duration.value).toBe("3:42");
    expect(cleared.bpm).toEqual(emptyField());
  });
});

describe("draft persistence", () => {
  it("persists confirmed and manual values but not unconfirmed auto values", () => {
    const draft = createEmptyDraft();
    draft.work.title = { value: "Titre", source: "manual" };
    draft.work.duration = { value: "3:42", source: "confirmed" };
    draft.work.bpm = { value: "120", source: "auto" };
    const restored = deserializeDraft(serializeDraft(draft))!;
    expect(restored.work.title).toEqual({ value: "Titre", source: "manual" });
    expect(restored.work.duration).toEqual({ value: "3:42", source: "confirmed" });
    expect(restored.work.bpm).toEqual(emptyField());
    expect(restored.updatedAt).not.toBeNull();
  });

  it("ignores corrupt drafts", () => {
    expect(deserializeDraft("{not json")).toBeNull();
    expect(deserializeDraft("null")).toBeNull();
    expect(deserializeDraft(null)).toBeNull();
  });
});

describe("parseBpm", () => {
  it.each([
    ["120", 120],
    ["92,5", 92.5],
    ["92.5", 92.5],
  ])("%s → %s", (input, expected) => expect(parseBpm(input)).toBe(expected));

  it.each(["", "abc", "0", "10", "400"])("rejects %j", (input) => expect(parseBpm(input)).toBeNull());
});
