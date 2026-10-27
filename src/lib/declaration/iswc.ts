/**
 * ISWC (International Standard Musical Work Code): "T" + 9 digits + 1 check digit,
 * usually written T-123.456.789-C.
 */
export function normalizeIswc(input: string): string | null {
  const compact = input.toUpperCase().replace(/[\s.\-]/g, "");
  return /^T\d{10}$/.test(compact) ? compact : null;
}

export function iswcCheckDigit(nineDigits: string): number {
  let sum = 1; // weight of the "T" prefix
  for (let i = 0; i < 9; i++) sum += Number(nineDigits[i]) * (i + 1);
  return (10 - (sum % 10)) % 10;
}

export function isValidIswc(input: string): boolean {
  const compact = normalizeIswc(input);
  if (!compact) return false;
  return iswcCheckDigit(compact.slice(1, 10)) === Number(compact[10]);
}

export function formatIswc(input: string): string {
  const compact = normalizeIswc(input);
  if (!compact) return input;
  const d = compact.slice(1);
  return `T-${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d[9]}`;
}
