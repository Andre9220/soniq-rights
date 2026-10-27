export interface RightsHolder {
  id: string;
  lastName: string;
  firstName: string;
  /** Optional stage name. */
  pseudonym: string;
  isAuthor: boolean;
  /** Share of the lyrics (auteur), in percent. */
  authorShare: string;
  isComposer: boolean;
  /** Share of the music (compositeur), in percent. */
  composerShare: string;
  phone: string;
  email: string;
}

export type Role = "author" | "composer";

/** Pass a fixed id when rendering on the server (initial draft); random ids are for user actions. */
export function createRightsHolder(id: string = `rh-${crypto.randomUUID()}`): RightsHolder {
  return {
    id,
    lastName: "",
    firstName: "",
    pseudonym: "",
    isAuthor: false,
    authorShare: "",
    isComposer: false,
    composerShare: "",
    phone: "",
    email: "",
  };
}

/** Parses a percentage typed with a comma or a dot; null when invalid. */
export function parseShare(input: string): number | null {
  const value = input.trim().replace(",", ".");
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : null;
}

export function displayName(h: Pick<RightsHolder, "firstName" | "lastName" | "pseudonym">): string {
  const civil = [h.firstName.trim(), h.lastName.trim()].filter(Boolean).join(" ");
  const pseudo = h.pseudonym.trim();
  if (civil && pseudo) return `${civil} (${pseudo})`;
  return civil || pseudo;
}

/** Sum of the shares for one role, rounded to two decimals. */
export function roleTotal(holders: RightsHolder[], role: Role): number {
  const total = holders.reduce((sum, h) => {
    const active = role === "author" ? h.isAuthor : h.isComposer;
    const share = parseShare(role === "author" ? h.authorShare : h.composerShare);
    return active && share !== null ? sum + share : sum;
  }, 0);
  return Math.round(total * 100) / 100;
}

/** Author shares + composer shares: the whole distribution key, which must reach 100 %. */
export function totalShare(holders: RightsHolder[]): number {
  return Math.round((roleTotal(holders, "author") + roleTotal(holders, "composer")) * 100) / 100;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Accepts French and international numbers: +33 6 12 34 56 78, 06.12.34.56.78… */
export function isValidPhone(phone: string): boolean {
  const value = phone.trim();
  if (!/^\+?[\d\s.\-()]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

export type HolderErrors = Partial<Record<"identity" | "roles" | "authorShare" | "composerShare" | "phone" | "email", string>>;

export function validateHolder(h: RightsHolder): HolderErrors {
  const errors: HolderErrors = {};
  if (!(h.lastName.trim() && h.firstName.trim())) errors.identity = "Nom et prénom requis";
  if (!h.isAuthor && !h.isComposer) errors.roles = "Cochez auteur, compositeur ou les deux";
  if (h.isAuthor && parseShare(h.authorShare) === null) errors.authorShare = "Part auteur entre 0 et 100 %";
  if (h.isComposer && parseShare(h.composerShare) === null) errors.composerShare = "Part compositeur entre 0 et 100 %";
  if (!isValidPhone(h.phone)) errors.phone = "Numéro de téléphone invalide";
  if (!isValidEmail(h.email)) errors.email = "Adresse e-mail invalide";
  return errors;
}

/**
 * One distribution key for the whole work: every author share plus every
 * composer share must total exactly 100 %. A work needs at least one composer,
 * and at least one author unless it is instrumental.
 */
export function validateRights(holders: RightsHolder[], options: { instrumental?: boolean } = {}) {
  const perHolder = Object.fromEntries(holders.map((h) => [h.id, validateHolder(h)]));
  const hasAuthor = holders.some((h) => h.isAuthor);
  const hasComposer = holders.some((h) => h.isComposer);
  const totals = { author: roleTotal(holders, "author"), composer: roleTotal(holders, "composer"), all: totalShare(holders) };
  const global: string[] = [];

  if (!hasComposer) global.push("Au moins un compositeur est requis.");
  if (!options.instrumental && !hasAuthor) global.push("Au moins un auteur est requis (ou cochez « œuvre instrumentale »).");
  if (totals.all !== 100) global.push(`Le total auteur + compositeur fait ${String(totals.all).replace(".", ",")} % au lieu de 100 %.`);

  const valid = global.length === 0 && Object.values(perHolder).every((e) => Object.keys(e).length === 0);
  return { valid, perHolder, totals, global };
}

/** Migrates holders saved by earlier versions of the draft (name / role / share). */
export function normalizeHolder(raw: unknown): RightsHolder {
  const base = createRightsHolder("");
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const holder: RightsHolder = {
    ...base,
    id: str(r.id) || `rh-${crypto.randomUUID()}`,
    lastName: str(r.lastName),
    firstName: str(r.firstName),
    pseudonym: str(r.pseudonym),
    isAuthor: r.isAuthor === true,
    authorShare: str(r.authorShare),
    isComposer: r.isComposer === true,
    composerShare: str(r.composerShare),
    phone: str(r.phone),
    email: str(r.email),
  };
  if ("name" in r && !holder.lastName) {
    holder.lastName = str(r.name);
    if (r.role === "auteur") Object.assign(holder, { isAuthor: true, authorShare: str(r.share) });
    if (r.role === "compositeur") Object.assign(holder, { isComposer: true, composerShare: str(r.share) });
  }
  return holder;
}
