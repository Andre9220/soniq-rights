"use client";

import { countryOptions, PRIORITY_COUNTRIES } from "@/lib/declaration/countries";
import type { PublicationStatus } from "@/lib/declaration/draft";

const STATUSES: Array<{ value: Exclude<PublicationStatus, "">; label: string; description: string }> = [
  { value: "inedite", label: "Inédite", description: "Jamais publiée ni éditée" },
  { value: "editee", label: "Éditée", description: "Déjà publiée ou confiée à un éditeur" },
];

interface Props {
  publication: PublicationStatus;
  originCountry: string;
  onPublicationChange: (value: PublicationStatus) => void;
  onCountryChange: (code: string) => void;
}

const OPTIONS = countryOptions();
const PRIORITY = OPTIONS.filter((o) => PRIORITY_COUNTRIES.includes(o.code));
const OTHERS = OPTIONS.filter((o) => !PRIORITY_COUNTRIES.includes(o.code));

export function WorkStatusCard({ publication, originCountry, onPublicationChange, onCountryChange }: Props) {

  return (
    <section className="card">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 className="font-display text-[15px] font-semibold">Statut de l&apos;œuvre</h2>
        <p className="mt-0.5 text-[13px] text-muted">Ces informations conditionnent le traitement de la déclaration.</p>
      </div>
      <div className="grid gap-5 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_240px] sm:px-6">
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium">
            L&apos;œuvre est-elle inédite ou éditée ? <span className="text-accent">*</span>
          </legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-2">
            {STATUSES.map((s) => {
              const checked = publication === s.value;
              return (
                <label
                  key={s.value}
                  className={`relative flex cursor-pointer flex-col rounded-xl border px-3.5 py-3 transition-colors focus-within:ring-4 focus-within:ring-accent/15 ${
                    checked ? "border-accent bg-accent-soft/60" : "border-line hover:border-line-strong"
                  }`}
                >
                  <input
                    type="radio"
                    name="publication"
                    value={s.value}
                    checked={checked}
                    onChange={() => onPublicationChange(s.value)}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{s.label}</span>
                    <span
                      aria-hidden
                      className={`flex h-4 w-4 items-center justify-center rounded-full border transition ${checked ? "border-accent bg-accent" : "border-line-strong"}`}
                    >
                      {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                  </span>
                  <span className="mt-0.5 text-xs text-muted">{s.description}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="originCountry" className="mb-1.5 block text-[13px] font-medium">
            Pays d&apos;origine <span className="text-accent">*</span>
          </label>
          <div className="relative">
            <select
              id="originCountry"
              value={originCountry}
              onChange={(e) => onCountryChange(e.target.value)}
              className={`field-input appearance-none pr-9 ${originCountry ? "" : "text-muted"}`}
            >
              <option value="" disabled>
                Choisir un pays
              </option>
              <optgroup label="Fréquents">
                {PRIORITY.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Tous les pays">
                {OTHERS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="mt-1.5 text-xs text-muted">Pays de première création ou publication</p>
        </div>
      </div>
    </section>
  );
}
