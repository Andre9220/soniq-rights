/**
 * Publishing contract (contrat d'édition) attached to an "éditée" work.
 * Vercel functions accept request bodies up to 4.5 MB, hence the 4 MB cap.
 */
export const MAX_CONTRACT_BYTES = 4 * 1024 * 1024;

export const CONTRACT_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export type ContractKind = "pdf" | "jpeg" | "png";

const EXTENSIONS: Record<ContractKind, string> = { pdf: "pdf", jpeg: "jpg", png: "png" };
const MIME: Record<ContractKind, string> = { pdf: "application/pdf", jpeg: "image/jpeg", png: "image/png" };

export function contractExtension(kind: ContractKind) {
  return EXTENSIONS[kind];
}

export function contractMime(kind: ContractKind) {
  return MIME[kind];
}

/** Identifies the file from its first bytes, so a renamed file cannot pass for a PDF. */
export function sniffContractKind(bytes: Uint8Array): ContractKind | null {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (starts([0xff, 0xd8, 0xff])) return "jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  return null;
}

/** Quick check on what the browser reports, before reading the file. */
export function checkContractFile(file: Pick<File, "name" | "size" | "type">): string | null {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const typeOk = ["application/pdf", "image/jpeg", "image/png", ""].includes(file.type) && ["pdf", "jpg", "jpeg", "png"].includes(ext);
  if (!typeOk) return "Format non pris en charge. Joignez le contrat en PDF, JPG ou PNG.";
  if (file.size === 0) return "Ce fichier est vide.";
  if (file.size > MAX_CONTRACT_BYTES) return "Fichier trop volumineux (4 Mo maximum). Compressez le PDF ou numérisez-le en plus basse résolution.";
  return null;
}
