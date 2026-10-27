"use client";

import { createRightsHolder, displayName, roleTotal, validateRights, type Role, type RightsHolder } from "@/lib/declaration/rights";

interface Props {
  holders: RightsHolder[];
  instrumental: boolean;
  showErrors: boolean;
  onChange: (holders: RightsHolder[]) => void;
  onInstrumentalChange: (instrumental: boolean) => void;
}

const inputClass =
  "w-full rounded-xl border bg-surface px-3.5 py-2.5 text-base outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm";

/** Splits 100 % evenly between the holders of a role; the remainder goes to the first ones. */
export function splitEvenly(holders: RightsHolder[], role: Role): RightsHolder[] {
  const active = holders.filter((h) => (role === "author" ? h.isAuthor : h.isComposer));
  if (active.length === 0) return holders;
  const cents = 10000;
  const base = Math.floor(cents / active.length);
  let remainder = cents - base * active.length;
  const shares = new Map<string, string>();
  for (const h of active) {
    const value = base + (remainder-- > 0 ? 1 : 0);
    shares.set(h.id, String(value / 100).replace(".", ","));
  }
  const key = role === "author" ? "authorShare" : "composerShare";
  return holders.map((h) => (shares.has(h.id) ? { ...h, [key]: shares.get(h.id)! } : h));
}

function Field({
  label,
  error,
  optional,
  children,
}: {
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium">
        {label}
        {optional ? <span className="font-normal text-muted"> (facultatif)</span> : <span className="text-muted"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

function RoleToggle({
  label,
  sublabel,
  checked,
  share,
  error,
  onToggle,
  onShare,
}: {
  label: string;
  sublabel: string;
  checked: boolean;
  share: string;
  error?: string;
  onToggle: (checked: boolean) => void;
  onShare: (value: string) => void;
}) {
  return (
    <div className={`rounded-xl border p-3 transition ${checked ? "border-accent/50 bg-accent-soft/40" : "border-line"}`}>
      <div className="flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">{label}</span> <span className="text-xs text-muted">· {sublabel}</span>
          </span>
        </label>
        {checked && (
          <div className="flex items-center gap-1.5">
            <input
              aria-label={`Part ${label.toLowerCase()} en pourcentage`}
              inputMode="decimal"
              value={share}
              onChange={(e) => onShare(e.target.value)}
              placeholder="50"
              className={`${inputClass} w-20 py-1.5 text-right ${error ? "border-danger" : "border-line"}`}
            />
            <span className="text-sm text-muted">%</span>
          </div>
        )}
      </div>
      {checked && error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

function TotalGauge({ label, total, onSplit, disabled }: { label: string; total: number; onSplit: () => void; disabled: boolean }) {
  const ok = total === 100;
  return (
    <div className="flex-1 rounded-xl bg-surface-muted p-3">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={`font-mono tabular-nums ${ok ? "text-auto" : total > 100 ? "text-danger" : "text-foreground"}`}>
          {String(total).replace(".", ",")} / 100 %
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-all ${ok ? "bg-auto" : total > 100 ? "bg-danger" : "bg-accent"}`}
          style={{ width: `${Math.min(total, 100)}%` }}
        />
      </div>
      <button type="button" disabled={disabled} onClick={onSplit} className="mt-2 text-xs font-medium text-accent hover:underline disabled:text-muted disabled:no-underline">
        Répartir équitablement
      </button>
    </div>
  );
}

export function RightsStep({ holders, instrumental, showErrors, onChange, onInstrumentalChange }: Props) {
  const update = (id: string, patch: Partial<RightsHolder>) => onChange(holders.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const validation = validateRights(holders, { instrumental });
  const errorsFor = (id: string) => (showErrors ? validation.perHolder[id] ?? {} : {});
  const hasAuthors = holders.some((h) => h.isAuthor);
  const hasComposers = holders.some((h) => h.isComposer);

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
        <input
          type="checkbox"
          checked={instrumental}
          onChange={(e) => {
            onInstrumentalChange(e.target.checked);
            if (e.target.checked) onChange(holders.map((h) => ({ ...h, isAuthor: false, authorShare: "" })));
          }}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        Œuvre instrumentale <span className="text-xs text-muted">(sans paroles : pas de part auteur)</span>
      </label>

      {holders.map((h, i) => {
        const errors = errorsFor(h.id);
        const name = displayName(h);
        return (
          <section key={h.id} aria-label={`Ayant droit ${i + 1}`} className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">
                Ayant droit {i + 1}
                {name && <span className="font-normal text-muted"> · {name}</span>}
              </h2>
              {holders.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(holders.filter((x) => x.id !== h.id))}
                  className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-muted hover:text-danger"
                >
                  Supprimer
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Nom" error={errors.identity && !h.lastName.trim() ? "Nom requis" : undefined}>
                <input
                  className={`${inputClass} ${errors.identity && !h.lastName.trim() ? "border-danger" : "border-line"}`}
                  value={h.lastName}
                  onChange={(e) => update(h.id, { lastName: e.target.value })}
                  autoComplete="family-name"
                  placeholder="Dupont"
                />
              </Field>
              <Field label="Prénom" error={errors.identity && !h.firstName.trim() ? "Prénom requis" : undefined}>
                <input
                  className={`${inputClass} ${errors.identity && !h.firstName.trim() ? "border-danger" : "border-line"}`}
                  value={h.firstName}
                  onChange={(e) => update(h.id, { firstName: e.target.value })}
                  autoComplete="given-name"
                  placeholder="Camille"
                />
              </Field>
              <Field label="Pseudonyme" optional>
                <input
                  className={`${inputClass} border-line`}
                  value={h.pseudonym}
                  onChange={(e) => update(h.id, { pseudonym: e.target.value })}
                  placeholder="Nom d'artiste"
                />
              </Field>
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-1.5 text-sm font-medium">
                Rôle et part <span className="text-muted">*</span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {!instrumental && (
                  <RoleToggle
                    label="Auteur"
                    sublabel="paroles"
                    checked={h.isAuthor}
                    share={h.authorShare}
                    error={errors.authorShare}
                    onToggle={(checked) => update(h.id, { isAuthor: checked, authorShare: checked ? h.authorShare : "" })}
                    onShare={(authorShare) => update(h.id, { authorShare })}
                  />
                )}
                <RoleToggle
                  label="Compositeur"
                  sublabel="musique"
                  checked={h.isComposer}
                  share={h.composerShare}
                  error={errors.composerShare}
                  onToggle={(checked) => update(h.id, { isComposer: checked, composerShare: checked ? h.composerShare : "" })}
                  onShare={(composerShare) => update(h.id, { composerShare })}
                />
              </div>
              {errors.roles && <p className="text-xs text-danger">{errors.roles}</p>}
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Téléphone" error={errors.phone}>
                <input
                  type="tel"
                  className={`${inputClass} ${errors.phone ? "border-danger" : "border-line"}`}
                  value={h.phone}
                  onChange={(e) => update(h.id, { phone: e.target.value })}
                  autoComplete="tel"
                  placeholder="+33 6 12 34 56 78"
                />
              </Field>
              <Field label="E-mail" error={errors.email}>
                <input
                  type="email"
                  className={`${inputClass} ${errors.email ? "border-danger" : "border-line"}`}
                  value={h.email}
                  onChange={(e) => update(h.id, { email: e.target.value })}
                  autoComplete="email"
                  placeholder="camille@exemple.fr"
                />
              </Field>
            </div>
          </section>
        );
      })}

      <button
        type="button"
        onClick={() => onChange([...holders, createRightsHolder()])}
        className="w-full rounded-xl border border-dashed border-line px-4 py-3 text-sm font-medium hover:border-accent hover:text-accent"
      >
        + Ajouter un ayant droit
      </button>

      <div className="flex flex-col gap-2 sm:flex-row">
        {!instrumental && (
          <TotalGauge
            label="Paroles · parts auteur"
            total={roleTotal(holders, "author")}
            disabled={!hasAuthors}
            onSplit={() => onChange(splitEvenly(holders, "author"))}
          />
        )}
        <TotalGauge
          label="Musique · parts compositeur"
          total={roleTotal(holders, "composer")}
          disabled={!hasComposers}
          onSplit={() => onChange(splitEvenly(holders, "composer"))}
        />
      </div>

      {showErrors && validation.global.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-xl bg-danger-soft px-4 py-3 text-xs text-danger">
          {validation.global.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
