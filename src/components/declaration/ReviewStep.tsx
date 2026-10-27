import type { DeclarationDraft } from "@/lib/declaration/draft";
import { SourceBadge } from "./SourceBadge";

const LABELS: Record<keyof DeclarationDraft["work"], string> = {
  title: "Titre",
  duration: "Durée",
  bpm: "BPM",
  genre: "Genre",
  isrc: "ISRC",
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
      </dl>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {draft.rightsHolders.map((h) => (
          <li key={h.id} className="flex justify-between px-4 py-3 text-sm">
            <span>
              {h.name || <span className="text-muted">Sans nom</span>} <span className="text-muted">· {h.role}</span>
            </span>
            <span className="tabular-nums">{h.share || 0} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
