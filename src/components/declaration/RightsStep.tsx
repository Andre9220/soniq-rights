"use client";

import { createRightsHolder, displayName, roleTotal, totalShare, validateRights, type RightsHolder } from "@/lib/declaration/rights";

interface Props {
  holders: RightsHolder[];
  instrumental: boolean;
  showErrors: boolean;
  onChange: (holders: RightsHolder[]) => void;
  onInstrumentalChange: (instrumental: boolean) => void;
}


/**
 * Splits 100 % evenly between every checked role (a holder who is both author
 * and composer counts twice); the rounding remainder goes to the first ones.
 */
export function splitEvenly(holders: RightsHolder[]): RightsHolder[] {
  const slots = holders.flatMap((h) => [
    ...(h.isAuthor ? [{ id: h.id, key: "authorShare" as const }] : []),
    ...(h.isComposer ? [{ id: h.id, key: "composerShare" as const }] : []),
  ]);
  if (slots.length === 0) return holders;
  const cents = 10000;
  const base = Math.floor(cents / slots.length);
  let remainder = cents - base * slots.length;
  const next = holders.map((h) => ({ ...h }));
  for (const slot of slots) {
    const value = base + (remainder-- > 0 ? 1 : 0);
    next.find((h) => h.id === slot.id)![slot.key] = String(value / 100).replace(".", ",");
  }
  return next;
}

function initials(h: RightsHolder) {
  return ((h.firstName.trim()[0] ?? "") + (h.lastName.trim()[0] ?? "")).toUpperCase() || h.pseudonym.trim().slice(0, 2).toUpperCase();
}

function roleSummary(h: RightsHolder) {
  const roles = [h.isAuthor && `Auteur ${h.authorShare || "–"} %`, h.isComposer && `Compositeur ${h.composerShare || "–"} %`].filter(Boolean);
  return roles.length ? roles.join(" · ") : "Aucun rôle sélectionné";
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
      <span className="mb-1.5 block text-[13px] font-medium">
        {label}
        {optional ? <span className="font-normal text-muted"> · facultatif</span> : <span className="text-accent"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-xs text-danger">{error}</span>}
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
    <div className={`rounded-xl border px-3.5 py-3 transition-colors ${checked ? "border-accent/45 bg-accent-soft/50" : "border-line hover:border-line-strong"}`}>
      <div className="flex min-h-9 items-center justify-between gap-3">
        <label className="flex flex-1 cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="h-[18px] w-[18px] rounded accent-[var(--accent)]" />
          <span className="leading-tight">
            <span className="block font-medium">{label}</span>
            <span className="block text-xs text-muted">{sublabel}</span>
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
              aria-invalid={error ? true : undefined}
              className="field-input h-9 w-20 text-right font-mono tabular-nums"
            />
            <span className="text-sm text-muted">%</span>
          </div>
        )}
      </div>
      {checked && error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

function TotalGauge({
  label,
  total,
  detail,
  onSplit,
  disabled,
}: {
  label: string;
  total: number;
  detail?: string;
  onSplit: () => void;
  disabled: boolean;
}) {
  const ok = total === 100;
  return (
    <div className="flex-1 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={`font-mono text-[13px] font-semibold tabular-nums ${ok ? "text-success" : total > 100 ? "text-danger" : "text-foreground"}`}>
          {String(total).replace(".", ",")} / 100 %
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-all ${ok ? "bg-success" : total > 100 ? "bg-danger" : "bg-accent"}`}
          style={{ width: `${Math.min(total, 100)}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        {detail && <span className="text-muted">{detail}</span>}
        <button type="button" disabled={disabled} onClick={onSplit} className="font-medium text-accent hover:underline disabled:text-muted disabled:no-underline">
          Répartir équitablement
        </button>
      </div>
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
      <label className="card flex cursor-pointer items-center gap-3 px-5 py-4 text-sm">
        <input
          type="checkbox"
          checked={instrumental}
          onChange={(e) => {
            onInstrumentalChange(e.target.checked);
            if (e.target.checked) onChange(holders.map((h) => ({ ...h, isAuthor: false, authorShare: "" })));
          }}
          className="h-[18px] w-[18px] rounded accent-[var(--accent)]"
        />
        <span>
          <span className="block font-medium">Œuvre instrumentale</span>
          <span className="block text-xs text-muted">Sans paroles : aucune part auteur à répartir</span>
        </span>
      </label>

      {holders.map((h, i) => {
        const errors = errorsFor(h.id);
        const name = displayName(h);
        return (
          <section key={h.id} aria-label={`Ayant droit ${i + 1}`} className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5 sm:px-6">
              <h2 className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-display text-xs font-semibold text-white">
                  {initials(h) || i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-[15px] font-semibold">{name || `Ayant droit ${i + 1}`}</span>
                  <span className="block text-xs text-muted">{roleSummary(h)}</span>
                </span>
              </h2>
              {holders.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(holders.filter((x) => x.id !== h.id))}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-danger-soft hover:text-danger"
                >
                  Supprimer
                </button>
              )}
            </div>

            <div className="space-y-5 px-5 py-5 sm:px-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Nom" error={errors.identity && !h.lastName.trim() ? "Nom requis" : undefined}>
                <input
                  className="field-input"
                  aria-invalid={errors.identity && !h.lastName.trim() ? true : undefined}
                  value={h.lastName}
                  onChange={(e) => update(h.id, { lastName: e.target.value })}
                  autoComplete="family-name"
                  placeholder="Dupont"
                />
              </Field>
              <Field label="Prénom" error={errors.identity && !h.firstName.trim() ? "Prénom requis" : undefined}>
                <input
                  className="field-input"
                  aria-invalid={errors.identity && !h.firstName.trim() ? true : undefined}
                  value={h.firstName}
                  onChange={(e) => update(h.id, { firstName: e.target.value })}
                  autoComplete="given-name"
                  placeholder="Camille"
                />
              </Field>
              <Field label="Pseudonyme" optional>
                <input
                  className="field-input"
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
                  className="field-input"
                  aria-invalid={errors.phone ? true : undefined}
                  value={h.phone}
                  onChange={(e) => update(h.id, { phone: e.target.value })}
                  autoComplete="tel"
                  placeholder="+33 6 12 34 56 78"
                />
              </Field>
              <Field label="E-mail" error={errors.email}>
                <input
                  type="email"
                  className="field-input"
                  aria-invalid={errors.email ? true : undefined}
                  value={h.email}
                  onChange={(e) => update(h.id, { email: e.target.value })}
                  autoComplete="email"
                  placeholder="camille@exemple.fr"
                />
              </Field>
            </div>
            </div>
          </section>
        );
      })}

      <button
        type="button"
        onClick={() => onChange([...holders, createRightsHolder()])}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line-strong text-sm font-medium text-muted transition hover:border-accent hover:bg-accent-soft/40 hover:text-accent"
      >
        + Ajouter un ayant droit
      </button>

      <TotalGauge
        label="Total auteur + compositeur"
        total={totalShare(holders)}
        detail={
          instrumental
            ? undefined
            : `dont auteurs ${String(roleTotal(holders, "author")).replace(".", ",")} % · compositeurs ${String(roleTotal(holders, "composer")).replace(".", ",")} %`
        }
        disabled={!hasAuthors && !hasComposers}
        onSplit={() => onChange(splitEvenly(holders))}
      />

      {showErrors && validation.global.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-xs text-danger">
          {validation.global.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
