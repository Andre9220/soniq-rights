import type { DeclarationDraft } from "@/lib/declaration/draft";
import { displayName } from "@/lib/declaration/rights";
import { SourceBadge } from "./SourceBadge";

const LABELS: Record<keyof DeclarationDraft["work"], string> = {
  title: "Titre",
  duration: "Durée",
  bpm: "BPM",
  genre: "Genre",
  isrc: "ISRC",
  iswc: "ISWC",
};

export function ReviewStep({ draft }: { draft: DeclarationDraft }) {
  return (
    <div className="space-y-4">
      <dl className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {(Object.keys(LABELS) as Array<keyof DeclarationDraft["work"]>).map((key) => (
          <div key={key} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <dt className="text-muted">{LABELS[key]}</dt>
            <dd className="flex items-center gap-2 text-right">
              {draft.work[key].value || <span className="text-muted">—</span>}
              <SourceBadge source={draft.work[key].source} />
            </dd>
          </div>
        ))}
        {draft.instrumental && (
          <div className="flex justify-between px-4 py-3 text-sm">
            <dt className="text-muted">Type</dt>
            <dd>Œuvre instrumentale</dd>
          </div>
        )}
      </dl>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {draft.rightsHolders.map((h) => (
          <li key={h.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">{displayName(h) || <span className="text-muted">Sans nom</span>}</p>
              <p className="truncate text-xs text-muted">
                {h.email} · {h.phone}
              </p>
            </div>
            <div className="flex gap-2 text-xs tabular-nums">
              {h.isAuthor && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">Auteur {h.authorShare} %</span>}
              {h.isComposer && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">Compositeur {h.composerShare} %</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
