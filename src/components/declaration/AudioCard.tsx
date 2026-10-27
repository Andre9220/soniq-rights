"use client";

import type { AudioImportState } from "@/hooks/useAudioImport";
import type { AnalysisStage } from "@/lib/audio/analyzer";
import { formatFileSize } from "@/lib/audio/formats";
import { WaveformPlayer } from "./WaveformPlayer";

const STAGES: Array<{ id: AnalysisStage; label: string }> = [
  { id: "reading", label: "Lecture" },
  { id: "decoding", label: "Décodage" },
  { id: "tempo", label: "Tempo" },
  { id: "genre", label: "Genre" },
];

const CONFIDENCE = {
  high: { label: "Fiabilité élevée", dots: 3 },
  medium: { label: "Fiabilité moyenne", dots: 2 },
  low: { label: "Fiabilité faible", dots: 1 },
} as const;

const fr = (n: number) => String(n).replace(".", ",");

interface Props {
  state: Exclude<AudioImportState, { status: "idle" } | { status: "rejected" }>;
  hasUnconfirmed: boolean;
  onConfirm: () => void;
  onCorrect: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onReplace: () => void;
  onPickBpm: (bpm: number) => void;
  onPickGenre: (label: string) => void;
  currentGenre: string;
}

function EstimateTag() {
  return (
    <span className="rounded-full border border-warn/30 bg-warn-soft px-1.5 py-px text-[10px] font-medium normal-case tracking-normal text-warn">
      estimation
    </span>
  );
}

function Metric({ label, children, footer }: { label: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface-muted/60 px-4 py-3">
      <dt className="eyebrow flex items-center gap-1.5">{label}</dt>
      <dd className="mt-1.5 font-display text-2xl font-semibold tabular-nums tracking-tight">{children}</dd>
      {footer && <div className="mt-1 text-xs text-muted">{footer}</div>}
    </div>
  );
}

export function AudioCard(props: Props) {
  const { state } = props;
  const { file, url } = state;
  const analysis = state.status === "ready" ? state.analysis : null;
  const tempo = analysis?.tempo ?? null;
  const currentStage = state.status === "analyzing" ? STAGES.findIndex((s) => s.id === state.stage) : -1;

  return (
    <section aria-label="Fiche audio" className="card overflow-hidden">
      {/* Player — dark brand panel */}
      <div className="relative overflow-hidden bg-ink px-4 pb-4 pt-4 text-white sm:px-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--brand), transparent)" }}
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" title={file.name}>
              {file.name}
            </p>
            <p className="mt-0.5 text-xs text-white/55">
              {file.name.split(".").pop()?.toUpperCase()} · {formatFileSize(file.size)}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={props.onReplace} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white">
              Remplacer
            </button>
            <button type="button" onClick={props.onRemove} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white">
              Retirer
            </button>
          </div>
        </div>
        <div className="relative mt-4">
          <WaveformPlayer key={url} src={url} title={file.name} peaks={analysis?.peaks ?? []} durationHint={analysis?.durationSeconds} />
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {state.status === "analyzing" && (
          <div aria-live="polite" className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Analyse en cours dans votre navigateur…</p>
              <button type="button" onClick={props.onCancel} className="text-xs font-medium text-muted hover:text-foreground">
                Annuler
              </button>
            </div>
            <ol className="grid grid-cols-4 gap-2">
              {STAGES.map((s, i) => (
                <li key={s.id} className="space-y-1.5">
                  <span
                    className={`block h-1 overflow-hidden rounded-full ${i < currentStage ? "bg-accent" : "bg-line"}`}
                  >
                    {i === currentStage && <span className="block h-full w-1/2 animate-pulse rounded-full bg-accent" />}
                  </span>
                  <span className={`block text-[11px] ${i <= currentStage ? "text-foreground" : "text-muted"}`}>{s.label}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {state.status === "failed" && (
          <div role="alert" className="flex gap-3 rounded-xl border border-warn/25 bg-warn-soft px-4 py-3 text-sm text-warn">
            <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" aria-hidden>
              <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm-.75 4.5h1.5v5h-1.5v-5zm0 6.5h1.5v1.5h-1.5V13z" />
            </svg>
            <p>
              {state.message} <span className="text-warn/80">La déclaration reste possible : renseignez les champs à la main.</span>
            </p>
          </div>
        )}

        {analysis && (
          <div className="space-y-5" aria-live="polite">
            <dl className="grid grid-cols-2 gap-3">
              <Metric label="Durée">{analysis.durationLabel}</Metric>
              <Metric
                label={
                  <>
                    BPM <EstimateTag />
                  </>
                }
                footer={
                  tempo ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-flex gap-0.5" aria-hidden>
                        {[1, 2, 3].map((d) => (
                          <span key={d} className={`h-1.5 w-1.5 rounded-full ${d <= CONFIDENCE[tempo.confidence].dots ? "bg-accent" : "bg-line-strong"}`} />
                        ))}
                      </span>
                      {CONFIDENCE[tempo.confidence].label}
                    </span>
                  ) : (
                    "Non détecté"
                  )
                }
              >
                {tempo ? fr(tempo.bpm) : "—"}
              </Metric>
            </dl>

            {analysis.tempoError && <Notice>{analysis.tempoError}</Notice>}
            {tempo?.variable && tempo.range && (
              <Notice>
                Tempo variable ({fr(tempo.range.min)} – {fr(tempo.range.max)} BPM). Indiquez le tempo principal du morceau.
              </Notice>
            )}

            {tempo && (tempo.halfTime || tempo.doubleTime) && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">Ressenti différent ?</span>
                {tempo.halfTime && <Chip onClick={() => props.onPickBpm(tempo.halfTime!)}>Half-time · {fr(tempo.halfTime)}</Chip>}
                {tempo.doubleTime && <Chip onClick={() => props.onPickBpm(tempo.doubleTime!)}>Double-time · {fr(tempo.doubleTime)}</Chip>}
              </div>
            )}

            {analysis.genre && !analysis.genre.speech && (
              <div className="space-y-2.5 border-t border-line pt-4">
                <p className="eyebrow flex items-center gap-1.5">
                  Genre probable <EstimateTag />
                </p>
                <div className="flex flex-wrap gap-2">
                  {analysis.genre.candidates.map((c) => (
                    <Chip key={c.id} selected={props.currentGenre === c.label} onClick={() => props.onPickGenre(c.label)}>
                      {c.label}
                      <span className="ml-1.5 tabular-nums text-muted">{Math.round(c.probability * 100)} %</span>
                    </Chip>
                  ))}
                </div>
                {!analysis.genre.confident && <p className="text-xs text-muted">Résultat incertain : choisissez le genre le plus proche ou saisissez-le.</p>}
              </div>
            )}
            {analysis.genre?.speech && <Notice>Le fichier semble surtout parlé : aucun genre musical proposé.</Notice>}
            {analysis.genreError && <p className="text-xs text-muted">{analysis.genreError}</p>}

            {analysis.title && (
              <p className="border-t border-line pt-4 text-xs text-muted">
                Titre lu dans {analysis.title.source === "metadata" ? "les métadonnées du fichier" : "le nom du fichier"} :{" "}
                <span className="font-medium text-foreground">« {analysis.title.title} »</span>
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="hidden text-xs text-muted sm:block">Analyse locale · aucun fichier envoyé</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button type="button" onClick={props.onCorrect} className="btn-secondary">
                  Corriger les valeurs
                </button>
                <button type="button" onClick={props.onConfirm} disabled={!props.hasUnconfirmed} className="btn-primary">
                  {props.hasUnconfirmed ? (
                    "Confirmer les valeurs"
                  ) : (
                    <>
                      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Valeurs confirmées
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-2.5 text-xs leading-relaxed text-warn">{children}</p>;
}

function Chip({ children, onClick, selected = false }: { children: React.ReactNode; onClick: () => void; selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition ${
        selected ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface hover:border-accent/60 hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}
