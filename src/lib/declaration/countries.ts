import { COUNTRIES_FR } from "./countries-fr";

/** Shown first: the countries most SONIQ RIGHTS declarants come from. */
export const PRIORITY_COUNTRIES = ["FR", "BE", "CH", "LU", "MC", "CA"];

const NAMES = new Map(COUNTRIES_FR);

export const COUNTRY_CODES = COUNTRIES_FR.map(([code]) => code);

export function isCountryCode(code: string): boolean {
  return NAMES.has(code);
}

export function countryName(code: string): string {
  return NAMES.get(code) ?? code;
}

/** Priority countries first, then the rest in French alphabetical order. */
export function countryOptions(): Array<{ code: string; name: string }> {
  const rest = COUNTRIES_FR.filter(([code]) => !PRIORITY_COUNTRIES.includes(code)).map(([code, name]) => ({ code, name }));
  return [...PRIORITY_COUNTRIES.map((code) => ({ code, name: countryName(code) })), ...rest];
}
