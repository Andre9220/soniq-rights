"use client";

import { createPublisher, PUBLISHER_ROLES, publisherRoleLabel, type Publisher, type PublisherErrors } from "@/lib/declaration/publishers";
import { ContractDropzone } from "./ContractDropzone";
import { Field } from "./FormField";

interface Props {
  publishers: Publisher[];
  errors: Record<string, PublisherErrors>;
  contract: File | null;
  onChange: (publishers: Publisher[]) => void;
  onContractChange: (file: File | null) => void;
}

export function PublishersSection({ publishers, errors, contract, onChange, onContractChange }: Props) {
  const update = (id: string, patch: Partial<Publisher>) => onChange(publishers.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <section aria-labelledby="publishers-title" className="space-y-4 pt-2">
      <div>
        <h2 id="publishers-title" className="font-display text-lg font-semibold tracking-tight">
          Éditeurs
        </h2>
        <p className="mt-0.5 text-[13px] text-muted">
          L&apos;œuvre étant éditée, indiquez l&apos;éditeur et sa part. Elle entre dans le total de 100 %.
        </p>
      </div>

      {publishers.map((p, i) => {
        const e = errors[p.id] ?? {};
        return (
          <section key={p.id} aria-label={`Éditeur ${i + 1}`} className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5 sm:px-6">
              <h3 className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-deep text-white" aria-hidden>
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="2.5" y="4.5" width="11" height="9" rx="1.5" />
                    <path d="M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-[15px] font-semibold">{p.name.trim() || `Éditeur ${i + 1}`}</span>
                  <span className="block text-xs text-muted">
                    {[p.role && publisherRoleLabel(p.role), `Part ${p.share || "–"} %`].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </h3>
              <button
                type="button"
                onClick={() => onChange(publishers.filter((x) => x.id !== p.id))}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-danger-soft hover:text-danger"
              >
                Supprimer
              </button>
            </div>

            <div className="space-y-4 px-5 py-5 sm:px-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Raison sociale" error={e.name}>
                  <input
                    className="field-input"
                    aria-invalid={e.name ? true : undefined}
                    value={p.name}
                    onChange={(ev) => update(p.id, { name: ev.target.value })}
                    autoComplete="organization"
                    placeholder="Éditions Exemple SAS"
                  />
                </Field>
                <Field label="Nom" error={e.contactName}>
                  <input
                    className="field-input"
                    aria-invalid={e.contactName ? true : undefined}
                    value={p.contactName}
                    onChange={(ev) => update(p.id, { contactName: ev.target.value })}
                    autoComplete="name"
                    placeholder="Nom et prénom du responsable"
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px]">
                <Field label="Catalogue" error={e.catalogue}>
                  <input
                    className="field-input"
                    aria-invalid={e.catalogue ? true : undefined}
                    value={p.catalogue}
                    onChange={(ev) => update(p.id, { catalogue: ev.target.value })}
                    placeholder="Nom du catalogue"
                  />
                </Field>
                <Field label="Rôle" error={e.role}>
                  <div className="relative">
                    <select
                      className={`field-input appearance-none pr-9 ${p.role ? "" : "text-muted"}`}
                      aria-invalid={e.role ? true : undefined}
                      value={p.role}
                      onChange={(ev) => update(p.id, { role: ev.target.value as Publisher["role"] })}
                    >
                      <option value="" disabled>
                        Choisir
                      </option>
                      {PUBLISHER_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </Field>
                <Field label="Part (%)" error={e.share}>
                  <input
                    className="field-input text-right font-mono tabular-nums"
                    aria-invalid={e.share ? true : undefined}
                    value={p.share}
                    onChange={(ev) => update(p.id, { share: ev.target.value })}
                    inputMode="decimal"
                    placeholder="33,33"
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Téléphone portable" error={e.phone}>
                  <input
                    type="tel"
                    className="field-input"
                    aria-invalid={e.phone ? true : undefined}
                    value={p.phone}
                    onChange={(ev) => update(p.id, { phone: ev.target.value })}
                    autoComplete="tel"
                    placeholder="+33 6 12 34 56 78"
                  />
                </Field>
                <Field label="E-mail" error={e.email}>
                  <input
                    type="email"
                    className="field-input"
                    aria-invalid={e.email ? true : undefined}
                    value={p.email}
                    onChange={(ev) => update(p.id, { email: ev.target.value })}
                    autoComplete="email"
                    placeholder="contact@editions.fr"
                  />
                </Field>
                <Field label="N° IPI" optional error={e.ipi}>
                  <input
                    className="field-input font-mono tabular-nums"
                    aria-invalid={e.ipi ? true : undefined}
                    value={p.ipi}
                    onChange={(ev) => update(p.id, { ipi: ev.target.value })}
                    inputMode="numeric"
                    placeholder="00123456789"
                  />
                </Field>
              </div>
            </div>
          </section>
        );
      })}

      <button
        type="button"
        onClick={() => onChange([...publishers, createPublisher()])}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line-strong text-sm font-medium text-muted transition hover:border-accent hover:bg-accent-soft/40 hover:text-accent"
      >
        + Ajouter un éditeur
      </button>

      <ContractDropzone file={contract} onChange={onContractChange} />
    </section>
  );
}
