import type { FieldSource } from "@/lib/declaration/fields";

const LABELS: Partial<Record<FieldSource, { text: string; className: string; title: string }>> = {
  auto: {
    text: "Auto",
    className: "bg-auto-soft text-auto",
    title: "Renseigné automatiquement depuis le fichier audio — à vérifier",
  },
  confirmed: {
    text: "Confirmé",
    className: "bg-accent-soft text-accent",
    title: "Valeur détectée et confirmée par vous",
  },
  manual: {
    text: "Modifié",
    className: "bg-surface-muted text-muted",
    title: "Valeur saisie ou corrigée manuellement",
  },
};

export function SourceBadge({ source }: { source: FieldSource }) {
  const label = LABELS[source];
  if (!label) return null;
  return (
    <span
      title={label.title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${label.className}`}
    >
      {source === "auto" && (
        <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3 fill-current">
          <path d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6z" />
        </svg>
      )}
      {label.text}
    </span>
  );
}
