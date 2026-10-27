"use client";

import type { AudioImportState } from "@/hooks/useAudioImport";
import { formatFileSize } from "@/lib/audio/formats";
import type { AnalysisStage } from "@/lib/audio/analyzer";

const STAGE_LABELS: Record<AnalysisStage, string> = {
  reading: "Lecture du fichier…",
  decoding: "Décodage audio…",
  tempo: "Estimation du tempo…",
  genre: "Reconnaissance du genre…",
};

const CONFIDENCE_LABELS = { high: "fiabilité élevée", medium: "fiabilité moyenne", low: "fiabilité faible" } as const;

interface Props {
  state: Exclude<AudioImportState, { status: "idle" } | { status: "rejected" }>;
  hasUnconfirmed: boolean;
  onConfirm: () => void;
  onCorrect: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onPickBpm: (bpm: number) => void;
  onPickGenre: (label: string) => void;
  currentGenre: string;
}

export function AudioCard({ state, hasUnconfirmed, onConfirm, onCorrect, onCancel, onRemove, onPickBpm, onPickGenre, currentGenre }: Props) {
  const { file, url } = state;
  const analysis = state.status === "ready" ? state.analysis : null;
  const tempo = analysis?.tempo ?? null;

  return (
    <section aria-label="Fiche audio" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <rect x="3" y="10" width="2" height="4" rx="1" />
            <rect x="7" y="6" width="2" height="12" rx="1" />
            <rect x="11" y="3" width="2" height="18" rx="1" />
            <rect x="15" y="7" width="2" height="10" rx="1" />
            <rect x="19" y="10" width="2" height="4" rx="1" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-muted">{formatFileSize(file.size)}</p>
        </div>
        <button type="button" onClick={onRemove} className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-muted hover:text-foreground">
          Retirer
        </button>
      </div>

      <div className="px-4 sm:px-5">
        <audio controls preload="metadata" src={url} aria-label={`Écouter ${file.name}`} />
      </div>

      <div className="mt-4 border-t border-line p-4 sm:p-5">
        {state.status === "analyzing" && (
          <div className="flex items-center justify-between gap-3" aria-live="polite">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />
              {STAGE_LABELS[state.stage]}
            </div>
            <button type="button" onClick={onCancel} className="text-xs text-muted underline-offset-2 hover:underline">
              Annuler
            </button>
          </div>
        )}

        {state.status === "failed" && (
          <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
            {state.message} La déclaration reste possible : renseignez la durée et le BPM à la main.
          </p>
        )}

        {analysis && (
          <div className="space-y-4" aria-live="polite">
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-muted p-3">
                <dt className="text-[11px] uppercase tracking-wide text-muted">Durée détectée</dt>
                <dd className="mt-1 font-mono text-xl tabular-nums">{analysis.durationLabel}</dd>
              </div>
              <div className="rounded-xl bg-surface-muted p-3">
                <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
                  BPM proposé
                  <span className="rounded-full bg-warn-soft px-1.5 py-px text-[10px] normal-case tracking-normal text-warn">estimation</span>
                </dt>
                <dd className="mt-1 font-mono text-xl tabular-nums">
                  {tempo ? String(tempo.bpm).replace(".", ",") : "—"}
                </dd>
                {tempo && <p className="mt-0.5 text-[11px] text-muted">{CONFIDENCE_LABELS[tempo.confidence]}</p>}
              </div>
            </dl>

            {analysis.tempoError && <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">{analysis.tempoError}</p>}

            {tempo?.variable && tempo.range && (
              <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
                Tempo variable détecté ({String(tempo.range.min).replace(".", ",")} – {String(tempo.range.max).replace(".", ",")} BPM). Indiquez
                le tempo principal du morceau.
              </p>
            )}

            {tempo && (tempo.halfTime || tempo.doubleTime) && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted">Ressenti différent ?</span>
                {tempo.halfTime && (
                  <button
                    type="button"
                    onClick={() => onPickBpm(tempo.halfTime!)}
                    className="rounded-full border border-line px-2.5 py-1 hover:border-accent hover:text-accent"
                  >
                    Half-time · {String(tempo.halfTime).replace(".", ",")}
                  </button>
                )}
                {tempo.doubleTime && (
                  <button
                    type="button"
                    onClick={() => onPickBpm(tempo.doubleTime!)}
                    className="rounded-full border border-line px-2.5 py-1 hover:border-accent hover:text-accent"
                  >
                    Double-time · {String(tempo.doubleTime).replace(".", ",")}
                  </button>
                )}
              </div>
            )}

            {analysis.genre && !analysis.genre.speech && (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
                  Genre probable
                  <span className="rounded-full bg-warn-soft px-1.5 py-px text-[10px] normal-case tracking-normal text-warn">estimation</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {analysis.genre.candidates.map((c) => {
                    const selected = currentGenre === c.label;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onPickGenre(c.label)}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          selected ? "border-accent bg-accent-soft text-accent" : "border-line hover:border-accent hover:text-accent"
                        }`}
                      >
                        {c.label} <span className="tabular-nums text-muted">{Math.round(c.probability * 100)} %</span>
                      </button>
                    );
                  })}
                </div>
                {!analysis.genre.confident && (
                  <p className="text-[11px] text-muted">Résultat incertain : choisissez le genre le plus proche ou saisissez-le.</p>
                )}
              </div>
            )}
            {analysis.genre?.speech && (
              <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">Le fichier semble surtout parlé : aucun genre musical proposé.</p>
            )}
            {analysis.genreError && <p className="text-xs text-muted">{analysis.genreError}</p>}

            {analysis.title && (
              <p className="text-xs text-muted">
                Titre proposé depuis {analysis.title.source === "metadata" ? "les métadonnées du fichier" : "le nom du fichier"} :{" "}
                <span className="text-foreground">« {analysis.title.title} »</span>
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onCorrect}
                className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:bg-surface-muted"
              >
                Corriger les valeurs
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={!hasUnconfirmed}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-default disabled:bg-surface-muted disabled:text-muted"
              >
                {hasUnconfirmed ? "Confirmer les valeurs" : "Valeurs confirmées ✓"}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
