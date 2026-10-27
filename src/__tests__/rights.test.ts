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
  totalShare,
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

  it("accepts a sole author-composer at 50 % + 50 %", () => {
    const result = validateRights([holder({ isAuthor: true, authorShare: "50", isComposer: true, composerShare: "50" })]);
    expect(result.valid).toBe(true);
    expect(result.totals).toEqual({ author: 50, composer: 50, publisher: 0, all: 100 });
  });

  it("requires author + composer shares to total exactly 100 % together", () => {
    // 100 % per role used to be valid; the distribution key is now global.
    const perRole = validateRights([
      holder({ isAuthor: true, authorShare: "100", isComposer: true, composerShare: "50" }),
      holder({ isComposer: true, composerShare: "50" }),
    ]);
    expect(perRole.valid).toBe(false);
    expect(perRole.global).toContain("Le total auteur + compositeur fait 200 % au lieu de 100 %.");

    const under = validateRights([holder({ isAuthor: true, authorShare: "30", isComposer: true, composerShare: "30,5" })]);
    expect(under.global).toContain("Le total auteur + compositeur fait 60,5 % au lieu de 100 %.");
  });

  it("accepts an uneven key across several holders", () => {
    const result = validateRights([
      holder({ isAuthor: true, authorShare: "40" }),
      holder({ isComposer: true, composerShare: "35" }),
      holder({ isAuthor: true, authorShare: "10", isComposer: true, composerShare: "15" }),
    ]);
    expect(result.valid).toBe(true);
    expect(totalShare([holder({ isAuthor: true, authorShare: "33,33" }), holder({ isComposer: true, composerShare: "66,67" })])).toBe(100);
  });

  it("splits evenly across every checked role, without floating point drift", () => {
    const { holders } = splitEvenly([
      holder({ isAuthor: true, isComposer: true }), // counts twice
      holder({ isComposer: true }),
    ]);
    expect(holders.map((h) => [h.authorShare, h.composerShare])).toEqual([
      ["33,34", "33,33"],
      ["", "33,33"],
    ]);
    expect(totalShare(holders)).toBe(100);
    expect(splitEvenly([holder({})]).holders[0].composerShare).toBe("");
  });

  it("requires an author unless the work is instrumental", () => {
    const holders = [holder({ isComposer: true, composerShare: "100" })];
    expect(validateRights(holders).global).toContain("Au moins un auteur est requis (ou cochez « œuvre instrumentale »).");
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

import { countryName, countryOptions, isCountryCode } from "@/lib/declaration/countries";
import { isValidIpi, normalizeIpi } from "@/lib/declaration/rights";

describe("IPI", () => {
  it.each([
    ["00123456789", "00123456789"],
    ["123456789", "00123456789"],
    ["123 456 789 01", "12345678901"],
    ["1234-5678-90", "01234567890"],
  ])("normalizes %s → %s", (input, expected) => expect(normalizeIpi(input)).toBe(expected));

  it.each(["", "12345678", "123456789012", "12345678A"])("rejects %j", (v) => expect(isValidIpi(v)).toBe(false));

  it("is optional on a holder but validated when filled", () => {
    expect(validateHolder(holder({ isComposer: true, composerShare: "100" })).ipi).toBeUndefined();
    expect(validateHolder(holder({ isComposer: true, composerShare: "100", ipi: "12" })).ipi).toBe("IPI : 9 à 11 chiffres");
    expect(validateHolder(holder({ isComposer: true, composerShare: "100", ipi: "123456789" })).ipi).toBeUndefined();
  });

  it("is migrated as empty from older drafts", () => {
    expect(normalizeHolder({ id: "x", lastName: "A" }).ipi).toBe("");
  });
});

describe("countries", () => {
  it("lists every ISO country with French names, frequent ones first", () => {
    const options = countryOptions();
    expect(options).toHaveLength(249);
    expect(options.slice(0, 3).map((o) => o.name)).toEqual(["France", "Belgique", "Suisse"]);
    expect(countryName("DE")).toBe("Allemagne");
    expect(isCountryCode("FR")).toBe(true);
    expect(isCountryCode("XX")).toBe(false);
  });
});

describe("publication status and origin country in drafts", () => {
  it("round-trips and drops invalid values", () => {
    const draft = createEmptyDraft();
    draft.publication = "editee";
    draft.originCountry = "BE";
    expect(deserializeDraft(serializeDraft(draft))).toMatchObject({ publication: "editee", originCountry: "BE" });
    const tampered = JSON.parse(serializeDraft(draft));
    tampered.publication = "autre";
    expect(deserializeDraft(JSON.stringify(tampered))?.publication).toBe("");
  });
});

import { createPublisher, normalizePublisher, publisherTotal, validatePublisher, type Publisher } from "@/lib/declaration/publishers";

const publisher = (patch: Partial<Publisher>): Publisher => ({
  ...createPublisher(),
  name: "Éditions Exemple",
  contactName: "Marie Durand",
  catalogue: "Électro 2026",
  role: "original",
  email: "contact@editions.fr",
  phone: "+33 1 23 45 67 89",
  ...patch,
});

describe("publishers (œuvre éditée)", () => {
  it("validates the publisher card", () => {
    expect(validatePublisher(publisher({ share: "33,33" }))).toEqual({});
    expect(validatePublisher({ ...createPublisher(), share: "" })).toMatchObject({
      name: "Raison sociale requise",
      contactName: "Nom requis",
      catalogue: "Catalogue requis",
      role: "Choisissez un rôle",
      share: "Part éditeur entre 0 et 100 %",
      email: "Adresse e-mail invalide",
      phone: "Numéro de portable invalide",
    });
    expect(validatePublisher(publisher({ share: "10", ipi: "12" })).ipi).toBe("IPI : 9 à 11 chiffres");
  });

  it("includes publisher shares in the 100 % key (Sacem thirds)", () => {
    const holders = [holder({ isAuthor: true, authorShare: "33,34" }), holder({ isComposer: true, composerShare: "33,33" })];
    const result = validateRights(holders, { publishers: [publisher({ share: "33,33" })] });
    expect(result.valid).toBe(true);
    expect(result.totals).toEqual({ author: 33.34, composer: 33.33, publisher: 33.33, all: 100 });
  });

  it("rejects a published work whose key ignores the publisher", () => {
    const holders = [holder({ isAuthor: true, authorShare: "50", isComposer: true, composerShare: "50" })];
    const result = validateRights(holders, { publishers: [publisher({ share: "20" })] });
    expect(result.global).toContain("Le total auteur + compositeur + éditeur fait 120 % au lieu de 100 %.");
  });

  it("requires at least one publisher for a published work", () => {
    const holders = [holder({ isAuthor: true, authorShare: "50", isComposer: true, composerShare: "50" })];
    expect(validateRights(holders, { publishers: [] }).global).toContain("Une œuvre éditée doit avoir au moins un éditeur.");
    expect(validateRights(holders).valid).toBe(true); // inédite: no publisher needed
  });

  it("reports per-publisher errors", () => {
    const p = { ...createPublisher("p1"), share: "100" };
    const result = validateRights([holder({ isComposer: true, composerShare: "0" })], { publishers: [p] });
    expect(result.perPublisher.p1.name).toBeDefined();
    expect(result.valid).toBe(false);
  });

  it("splits evenly across holders and publishers", () => {
    const split = splitEvenly([holder({ isAuthor: true }), holder({ isComposer: true })], [publisher({})]);
    expect([split.holders[0].authorShare, split.holders[1].composerShare, split.publishers[0].share]).toEqual(["33,34", "33,33", "33,33"]);
    expect(publisherTotal(split.publishers)).toBe(33.33);
  });

  it("migrates and round-trips publishers in drafts", () => {
    expect(normalizePublisher({ name: "X", role: "pirate" })).toMatchObject({ name: "X", share: "", ipi: "", catalogue: "", role: "" });
    expect(normalizePublisher({ role: "sub" }).role).toBe("sub");
    const draft = createEmptyDraft();
    draft.publication = "editee";
    draft.publishers = [publisher({ share: "25", contactName: "Marie" })];
    expect(deserializeDraft(serializeDraft(draft))?.publishers[0]).toMatchObject({ name: "Éditions Exemple", contactName: "Marie", share: "25" });
    expect(deserializeDraft(JSON.stringify({ work: {} }))?.publishers).toEqual([]);
  });
});

import { checkContractFile, MAX_CONTRACT_BYTES, sniffContractKind } from "@/lib/declaration/contract";

describe("publishing contract file", () => {
  it("identifies PDF, JPEG and PNG from their first bytes", () => {
    expect(sniffContractKind(new TextEncoder().encode("%PDF-1.7"))).toBe("pdf");
    expect(sniffContractKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniffContractKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(sniffContractKind(new TextEncoder().encode("PK\u0003\u0004 docx"))).toBeNull();
  });

  it("checks extension, emptiness and size before upload", () => {
    expect(checkContractFile({ name: "contrat.pdf", size: 1000, type: "application/pdf" })).toBeNull();
    expect(checkContractFile({ name: "scan.JPG", size: 1000, type: "image/jpeg" })).toBeNull();
    expect(checkContractFile({ name: "contrat.docx", size: 1000, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })).toMatch(/PDF, JPG ou PNG/);
    expect(checkContractFile({ name: "contrat.pdf", size: 0, type: "application/pdf" })).toMatch(/vide/);
    expect(checkContractFile({ name: "contrat.pdf", size: MAX_CONTRACT_BYTES + 1, type: "application/pdf" })).toMatch(/4 Mo/);
  });
});
