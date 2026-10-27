"use client";

import type { Publisher } from "@/lib/declaration/publishers";
import { createRightsHolder, displayName, roleTotal, validateRights, type RightsHolder } from "@/lib/declaration/rights";
import { Field } from "./FormField";
import { PublishersSection } from "./PublishersSection";

interface Props {
  holders: RightsHolder[];
  instrumental: boolean;
  /** Present only for an "éditée" work. */
  publishers?: Publisher[];
  contract: File | null;
  onContractChange: (file: File | null) => void;
  showErrors: boolean;
  onChange: (holders: RightsHolder[]) => void;
  onPublishersChange: (publishers: Publisher[]) => void;
  onInstrumentalChange: (instrumental: boolean) => void;
}


/**
 * Splits 100 % evenly between every checked role and every publisher (a holder
 * who is both author and composer counts twice); the rounding remainder goes to
 * the first ones.
 */
export function splitEvenly(holders: RightsHolder[], publishers: Publisher[] = []): { holders: RightsHolder[]; publishers: Publisher[] } {
  const nextHolders = holders.map((h) => ({ ...h }));
  const nextPublishers = publishers.map((p) => ({ ...p }));
  const setters: Array<(value: string) => void> = [
    ...nextHolders.flatMap((h) => [
      ...(h.isAuthor ? [(v: string) => (h.authorShare = v)] : []),
      ...(h.isComposer ? [(v: string) => (h.composerShare = v)] : []),
    ]),
    ...nextPublishers.map((p) => (v: string) => (p.share = v)),
  ];
  if (setters.length === 0) return { holders, publishers };
  const cents = 10000;
  const base = Math.floor(cents / setters.length);
  let remainder = cents - base * setters.length;
  for (const set of setters) set(String((base + (remainder-- > 0 ? 1 : 0)) / 100).replace(".", ","));
  return { holders: nextHolders, publishers: nextPublishers };
}

function initials(h: RightsHolder) {
  return ((h.firstName.trim()[0] ?? "") + (h.lastName.trim()[0] ?? "")).toUpperCase() || h.pseudonym.trim().slice(0, 2).toUpperCase();
}

function roleSummary(h: RightsHolder) {
  const roles = [h.isAuthor && `Auteur ${h.authorShare || "–"} %`, h.isComposer && `Compositeur ${h.composerShare || "–"} %`].filter(Boolean);
  return roles.length ? roles.join(" · ") : "Aucun rôle sélectionné";
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

export function RightsStep({
  holders,
  instrumental,
  publishers,
  contract,
  onContractChange,
  showErrors,
  onChange,
  onPublishersChange,
  onInstrumentalChange,
}: Props) {
  const update = (id: string, patch: Partial<RightsHolder>) => onChange(holders.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const validation = validateRights(holders, { instrumental, publishers });
  const fr = (n: number) => String(n).replace(".", ",");
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

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="N° IPI" optional error={errors.ipi}>
                <input
                  className="field-input font-mono tabular-nums"
                  aria-invalid={errors.ipi ? true : undefined}
                  value={h.ipi}
                  onChange={(e) => update(h.id, { ipi: e.target.value })}
                  inputMode="numeric"
                  placeholder="00123456789"
                />
              </Field>
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

      {publishers && (
        <PublishersSection
          publishers={publishers}
          errors={showErrors ? validation.perPublisher : {}}
          contract={contract}
          onChange={onPublishersChange}
          onContractChange={onContractChange}
        />
      )}

      <TotalGauge
        label={publishers ? "Total auteur + compositeur + éditeur" : "Total auteur + compositeur"}
        total={validation.totals.all}
        detail={[
          !instrumental && `auteurs ${fr(roleTotal(holders, "author"))} %`,
          `compositeurs ${fr(roleTotal(holders, "composer"))} %`,
          publishers && `éditeurs ${fr(validation.totals.publisher)} %`,
        ]
          .filter(Boolean)
          .join(" · ")}
        disabled={!hasAuthors && !hasComposers && !publishers?.length}
        onSplit={() => {
          const split = splitEvenly(holders, publishers);
          onChange(split.holders);
          if (publishers) onPublishersChange(split.publishers);
        }}
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
