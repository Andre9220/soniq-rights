import type { DeclarationDraft } from "@/lib/declaration/draft";
import { countryName } from "@/lib/declaration/countries";
import { formatIswc } from "@/lib/declaration/iswc";
import { displayName } from "@/lib/declaration/rights";
import { SourceBadge } from "./SourceBadge";

const LABELS: Record<keyof DeclarationDraft["work"], string> = {
  title: "Titre",
  duration: "Durée",
  bpm: "BPM",
  genre: "Genre",
  iswc: "ISWC",
  isrc: "ISRC",
};

function Section({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5 sm:px-6">
        <h2 className="font-display text-[15px] font-semibold">{title}</h2>
        <button type="button" onClick={onEdit} className="text-xs font-semibold text-accent underline-offset-2 hover:underline">
          Modifier
        </button>
      </div>
      {children}
    </section>
  );
}

export function ReviewStep({ draft, onEditStep }: { draft: DeclarationDraft; onEditStep: (step: number) => void }) {
  return (
    <div className="space-y-6">
      <Section title="L'œuvre" onEdit={() => onEditStep(0)}>
        <dl className="grid border-b border-line sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 text-sm sm:border-b-0 sm:border-r sm:px-6">
            <dt className="text-muted">Statut</dt>
            <dd className="font-medium">{draft.publication === "inedite" ? "Inédite" : draft.publication === "editee" ? "Éditée" : "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6">
            <dt className="text-muted">Pays d&apos;origine</dt>
            <dd className="font-medium">{draft.originCountry ? countryName(draft.originCountry) : "—"}</dd>
          </div>
        </dl>
        <dl className="grid sm:grid-cols-2">
          {(Object.keys(LABELS) as Array<keyof DeclarationDraft["work"]>).map((key) => {
            const f = draft.work[key];
            const value = key === "iswc" && f.value ? formatIswc(f.value) : f.value;
            return (
              <div key={key} className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 text-sm last:border-b-0 sm:px-6 sm:[&:nth-last-child(2)]:border-b-0 sm:odd:border-r">
                <dt className="text-muted">{LABELS[key]}</dt>
                <dd className="flex min-w-0 items-center gap-2 text-right">
                  <span className={`truncate ${["duration", "bpm", "iswc", "isrc"].includes(key) ? "font-mono tabular-nums" : "font-medium"}`}>
                    {value || <span className="font-sans font-normal text-muted">—</span>}
                  </span>
                  <SourceBadge source={f.source} />
                </dd>
              </div>
            );
          })}
        </dl>
        {draft.instrumental && <p className="border-t border-line px-5 py-3 text-xs text-muted sm:px-6">Œuvre instrumentale — pas de part auteur.</p>}
      </Section>

      <Section title={`Ayants droit · ${draft.rightsHolders.length}`} onEdit={() => onEditStep(1)}>
        <ul className="divide-y divide-line">
          {draft.rightsHolders.map((h) => (
            <li key={h.id} className="flex flex-col gap-2 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-w-0">
                <p className="font-medium">{displayName(h) || <span className="text-muted">Sans nom</span>}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {h.email} · {h.phone}
                  {h.ipi && <span className="font-mono"> · IPI {h.ipi}</span>}
                </p>
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                {h.isAuthor && (
                  <span className="rounded-full border border-line bg-surface-muted px-2.5 py-1">
                    Auteur <span className="font-mono font-semibold tabular-nums">{h.authorShare} %</span>
                  </span>
                )}
                {h.isComposer && (
                  <span className="rounded-full border border-line bg-surface-muted px-2.5 py-1">
                    Compositeur <span className="font-mono font-semibold tabular-nums">{h.composerShare} %</span>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <p className="text-xs leading-relaxed text-muted">
        En envoyant cette déclaration, vous certifiez que les informations ci-dessus sont exactes et que chaque ayant droit a validé sa part.
      </p>
    </div>
  );
}
