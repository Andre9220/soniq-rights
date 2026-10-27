import { isValidEmail, isValidIpi, isValidPhone, parseShare } from "./rights";

export const PUBLISHER_ROLES = [
  { value: "original", label: "Éditeur original" },
  { value: "co", label: "Co-éditeur" },
  { value: "sub", label: "Sous-éditeur" },
  { value: "admin", label: "Administrateur" },
] as const;

export type PublisherRole = (typeof PUBLISHER_ROLES)[number]["value"];

export function publisherRoleLabel(role: string): string {
  return PUBLISHER_ROLES.find((r) => r.value === role)?.label ?? role;
}

/** A music publisher (éditeur) holding a share of an "éditée" work, as on a Sacem declaration. */
export interface Publisher {
  id: string;
  /** Company name (raison sociale). */
  name: string;
  /** Name of the person in charge at the publisher. */
  contactName: string;
  /** Catalogue the work is placed in. */
  catalogue: string;
  role: PublisherRole | "";
  /** Optional IPI name number of the publishing company. */
  ipi: string;
  email: string;
  phone: string;
  /** Publisher share of the distribution key, in percent. */
  share: string;
}

/** Pass a fixed id when rendering on the server; random ids are for user actions. */
export function createPublisher(id: string = `pub-${crypto.randomUUID()}`): Publisher {
  return { id, name: "", contactName: "", catalogue: "", role: "", ipi: "", email: "", phone: "", share: "" };
}

export type PublisherErrors = Partial<Record<"name" | "contactName" | "catalogue" | "role" | "share" | "email" | "phone" | "ipi", string>>;

export function validatePublisher(p: Publisher): PublisherErrors {
  const errors: PublisherErrors = {};
  if (!p.name.trim()) errors.name = "Raison sociale requise";
  if (!p.contactName.trim()) errors.contactName = "Nom requis";
  if (!p.catalogue.trim()) errors.catalogue = "Catalogue requis";
  if (!PUBLISHER_ROLES.some((r) => r.value === p.role)) errors.role = "Choisissez un rôle";
  if (parseShare(p.share) === null) errors.share = "Part éditeur entre 0 et 100 %";
  if (!isValidEmail(p.email)) errors.email = "Adresse e-mail invalide";
  if (!isValidPhone(p.phone)) errors.phone = "Numéro de portable invalide";
  if (p.ipi.trim() && !isValidIpi(p.ipi)) errors.ipi = "IPI : 9 à 11 chiffres";
  return errors;
}

export function publisherTotal(publishers: Publisher[]): number {
  const total = publishers.reduce((sum, p) => sum + (parseShare(p.share) ?? 0), 0);
  return Math.round(total * 100) / 100;
}

export function normalizePublisher(raw: unknown): Publisher {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    id: str(r.id) || `pub-${crypto.randomUUID()}`,
    name: str(r.name),
    contactName: str(r.contactName),
    catalogue: str(r.catalogue),
    role: PUBLISHER_ROLES.some((x) => x.value === r.role) ? (r.role as PublisherRole) : "",
    ipi: str(r.ipi),
    email: str(r.email),
    phone: str(r.phone),
    share: str(r.share),
  };
}
