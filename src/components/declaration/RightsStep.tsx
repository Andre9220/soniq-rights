"use client";

import type { RightsHolder } from "@/lib/declaration/draft";

const ROLES: Array<{ value: RightsHolder["role"]; label: string }> = [
  { value: "auteur", label: "Auteur" },
  { value: "compositeur", label: "Compositeur" },
  { value: "arrangeur", label: "Arrangeur" },
  { value: "editeur", label: "Éditeur" },
];

export function totalShare(holders: RightsHolder[]) {
  return holders.reduce((sum, h) => sum + (Number(h.share.replace(",", ".")) || 0), 0);
}

interface Props {
  holders: RightsHolder[];
  onChange: (holders: RightsHolder[]) => void;
}

export function RightsStep({ holders, onChange }: Props) {
  const update = (id: string, patch: Partial<RightsHolder>) => onChange(holders.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const total = totalShare(holders);
  const inputClass =
    "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm";

  return (
    <div className="space-y-4">
      {holders.map((h, i) => (
        <div key={h.id} className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[1fr_10rem_6rem_auto] sm:items-end">
          <label className="col-span-2 text-sm sm:col-span-1">
            <span className="mb-1.5 block font-medium">Ayant droit {i + 1}</span>
            <input className={inputClass} value={h.name} onChange={(e) => update(h.id, { name: e.target.value })} placeholder="Nom ou société" />
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium">Rôle</span>
            <select className={inputClass} value={h.role} onChange={(e) => update(h.id, { role: e.target.value as RightsHolder["role"] })}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium">Part (%)</span>
            <input className={inputClass} inputMode="decimal" value={h.share} onChange={(e) => update(h.id, { share: e.target.value })} placeholder="50" />
          </label>
          {holders.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(holders.filter((x) => x.id !== h.id))}
              className="col-span-2 rounded-xl px-3 py-2.5 text-xs text-muted hover:bg-surface-muted sm:col-span-1"
            >
              Supprimer
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange([...holders, { id: `rh-${Date.now()}`, name: "", role: "compositeur", share: "" }])}
          className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-surface-muted"
        >
          + Ajouter un ayant droit
        </button>
        <span className={`text-sm tabular-nums ${Math.abs(total - 100) < 0.01 ? "text-auto" : "text-muted"}`}>Total : {total} %</span>
      </div>
    </div>
  );
}
