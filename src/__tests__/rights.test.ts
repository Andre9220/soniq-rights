import { describe, expect, it } from "vitest";
import { splitEvenly } from "@/components/declaration/RightsStep";
import { createEmptyDraft, deserializeDraft, serializeDraft } from "@/lib/declaration/draft";
import { formatIswc, isValidIswc, normalizeIswc } from "@/lib/declaration/iswc";
import {
  createRightsHolder,
  displayName,
  isValidEmail,
  isValidPhone,
  normalizeHolder,
  parseShare,
  roleTotal,
  validateHolder,
  validateRights,
  type RightsHolder,
} from "@/lib/declaration/rights";

const holder = (patch: Partial<RightsHolder>): RightsHolder => ({
  ...createRightsHolder(),
  lastName: "Dupont",
  firstName: "Camille",
  phone: "06 12 34 56 78",
  email: "camille@exemple.fr",
  ...patch,
});

describe("identity", () => {
  it("shows the pseudonym next to the civil name", () => {
    expect(displayName({ firstName: "Camille", lastName: "Dupont", pseudonym: "Kami" })).toBe("Camille Dupont (Kami)");
    expect(displayName({ firstName: "Camille", lastName: "Dupont", pseudonym: "" })).toBe("Camille Dupont");
    expect(displayName({ firstName: "", lastName: "", pseudonym: "Kami" })).toBe("Kami");
  });

  it("requires last and first name but not the pseudonym", () => {
    expect(validateHolder(holder({ isComposer: true, composerShare: "100" }))).toEqual({});
    expect(validateHolder(holder({ firstName: "", isComposer: true, composerShare: "100" })).identity).toBeDefined();
  });
});

describe("contact details", () => {
  it.each(["06 12 34 56 78", "+33 6 12 34 56 78", "06.12.34.56.78", "+1 (415) 555-0100"])("accepts phone %s", (p) =>
    expect(isValidPhone(p)).toBe(true),
  );
  it.each(["", "abc", "12345", "06 12 34 56 78 90 12 34"])("rejects phone %j", (p) => expect(isValidPhone(p)).toBe(false));

  it.each(["a@b.fr", "camille.dupont+sacem@label.music"])("accepts email %s", (e) => expect(isValidEmail(e)).toBe(true));
  it.each(["", "camille", "camille@", "camille@exemple", "a b@c.fr"])("rejects email %j", (e) => expect(isValidEmail(e)).toBe(false));
});

describe("roles and shares", () => {
  it("requires at least one role per holder", () => {
    expect(validateHolder(holder({})).roles).toBeDefined();
  });

  it("requires a share for each checked role", () => {
    const errors = validateHolder(holder({ isAuthor: true, isComposer: true, composerShare: "50" }));
    expect(errors.authorShare).toBeDefined();
    expect(errors.composerShare).toBeUndefined();
  });

  it.each([
    ["50", 50],
    ["33,33", 33.33],
    ["12.5", 12.5],
    ["0", null],
    ["101", null],
    ["", null],
  ])("parses share %j", (input, expected) => expect(parseShare(input)).toBe(expected));

  it("totals shares per role and ignores unchecked roles", () => {
    const holders = [
      holder({ isAuthor: true, authorShare: "60", isComposer: true, composerShare: "50" }),
      holder({ isAuthor: true, authorShare: "40", isComposer: false, composerShare: "50" }),
    ];
    expect(roleTotal(holders, "author")).toBe(100);
    expect(roleTotal(holders, "composer")).toBe(50);
  });

  it("accepts a holder who is both author and composer", () => {
    const result = validateRights([holder({ isAuthor: true, authorShare: "100", isComposer: true, composerShare: "100" })]);
    expect(result.valid).toBe(true);
  });

  it("requires author and composer totals of exactly 100 %", () => {
    const result = validateRights([
      holder({ isAuthor: true, authorShare: "50", isComposer: true, composerShare: "100" }),
      holder({ isComposer: true, composerShare: "10" }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.global.join(" ")).toMatch(/auteur totalisent 50 %/);
    expect(result.global.join(" ")).toMatch(/compositeur totalisent 110 %/);
  });

  it("handles thirds without floating point drift", () => {
    const holders = splitEvenly(
      [holder({ isComposer: true }), holder({ isComposer: true }), holder({ isComposer: true })],
      "composer",
    );
    expect(holders.map((h) => h.composerShare)).toEqual(["33,34", "33,33", "33,33"]);
    expect(roleTotal(holders, "composer")).toBe(100);
  });

  it("requires an author unless the work is instrumental", () => {
    const holders = [holder({ isComposer: true, composerShare: "100" })];
    expect(validateRights(holders).valid).toBe(false);
    expect(validateRights(holders, { instrumental: true }).valid).toBe(true);
  });

  it("always requires a composer", () => {
    const result = validateRights([holder({ isAuthor: true, authorShare: "100" })]);
    expect(result.global).toContain("Au moins un compositeur est requis.");
  });
});

describe("ISWC", () => {
  it.each(["T-034.524.680-1", "T0345246801", "t-034.524.680-1", "T 034 524 680 1"])("accepts %s", (v) =>
    expect(isValidIswc(v)).toBe(true),
  );
  it.each(["T-034.524.680-2", "T-034.524.680", "034.524.680-1", "ISWC", ""])("rejects %j", (v) => expect(isValidIswc(v)).toBe(false));

  it("normalizes and formats", () => {
    expect(normalizeIswc("t-034.524.680-1")).toBe("T0345246801");
    expect(formatIswc("T0345246801")).toBe("T-034.524.680-1");
  });
});

describe("draft migration", () => {
  it("converts holders saved with the previous name / role / share shape", () => {
    const migrated = normalizeHolder({ id: "rh-1", name: "Dupont", role: "compositeur", share: "100" });
    expect(migrated).toMatchObject({ id: "rh-1", lastName: "Dupont", isComposer: true, composerShare: "100", isAuthor: false });
  });

  it("round-trips the new holder fields, the ISWC and the instrumental flag", () => {
    const draft = createEmptyDraft();
    draft.instrumental = true;
    draft.work.iswc = { value: "T-034.524.680-1", source: "manual" };
    draft.rightsHolders = [holder({ pseudonym: "Kami", isComposer: true, composerShare: "100" })];
    const restored = deserializeDraft(serializeDraft(draft))!;
    expect(restored.instrumental).toBe(true);
    expect(restored.work.iswc.value).toBe("T-034.524.680-1");
    expect(restored.rightsHolders[0]).toMatchObject({ pseudonym: "Kami", phone: "06 12 34 56 78", email: "camille@exemple.fr" });
  });
});
