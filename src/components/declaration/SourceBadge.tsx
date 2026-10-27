import type { FieldSource } from "@/lib/declaration/fields";

const BADGES: Partial<Record<FieldSource, { text: string; className: string; title: string; icon: React.ReactNode }>> = {
  auto: {
    text: "Auto",
    className: "border-auto/25 bg-auto-soft text-auto",
    title: "Renseigné automatiquement depuis le fichier audio — à vérifier",
    icon: <path d="M8 1.5l1.5 4 4 1.5-4 1.5L8 12.5l-1.5-4-4-1.5 4-1.5z" fill="currentColor" />,
  },
  confirmed: {
    text: "Confirmé",
    className: "border-success/25 bg-success-soft text-success",
    title: "Valeur détectée puis confirmée par vous",
    icon: <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  },
  manual: {
    text: "Saisi",
    className: "border-line bg-surface-muted text-muted",
    title: "Valeur saisie ou corrigée manuellement",
    icon: <path d="M10.5 2.5l3 3L6 13H3v-3z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />,
  },
};

export function SourceBadge({ source }: { source: FieldSource }) {
  const badge = BADGES[source];
  if (!badge) return null;
  return (
    <span title={badge.title} className={`inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-[10.5px] font-semibold ${badge.className}`}>
      <svg aria-hidden viewBox="0 0 16 16" className="h-2.5 w-2.5">
        {badge.icon}
      </svg>
      {badge.text}
    </span>
  );
}
