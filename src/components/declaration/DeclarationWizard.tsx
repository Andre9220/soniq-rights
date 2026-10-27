"use client";

import { useCallback, useEffect, useState } from "react";
import { useAudioImport } from "@/hooks/useAudioImport";
import type { AudioAnalysis } from "@/lib/audio/analyzer";
import { parseDuration } from "@/lib/audio/duration";
import { validateAudioFile } from "@/lib/audio/formats";
import { clearDraft, createEmptyDraft, loadDraft, saveDraft, type DeclarationDraft } from "@/lib/declaration/draft";
import {
  applyDetection,
  clearAutoValues,
  confirmAutoValues,
  detectedValues,
  editField,
  type AutoFieldKey,
  type Suggestions,
} from "@/lib/declaration/fields";
import { ReviewStep } from "./ReviewStep";
import { validateRights } from "@/lib/declaration/rights";
import { RightsStep } from "./RightsStep";
import { bpmError, iswcError, WorkStep } from "./WorkStep";

const STEPS = [
  {
    title: "L'œuvre",
    rail: "Fichier audio, titre, durée",
    subtitle: "Importez votre morceau : durée, tempo, genre et titre sont proposés automatiquement. Vous gardez la main sur chaque valeur.",
  },
  {
    title: "Ayants droit",
    rail: "Auteurs, compositeurs, parts",
    subtitle: "Indiquez qui a écrit les paroles et composé la musique, avec la part de chacun.",
  },
  {
    title: "Récapitulatif",
    rail: "Vérification et envoi",
    subtitle: "Relisez votre déclaration avant de l'envoyer.",
  },
];

const omit = (s: Suggestions, key: string): Suggestions => Object.fromEntries(Object.entries(s).filter(([k]) => k !== key));

type AutoWork = Pick<DeclarationDraft["work"], AutoFieldKey>;

export function DeclarationWizard() {
  const [draft, setDraft] = useState<DeclarationDraft>(createEmptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions>({});
  const [dropError, setDropError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showRightsErrors, setShowRightsErrors] = useState(false);

  useEffect(() => {
    const saved = loadDraft();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    if (saved) setDraft(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !submitted) saveDraft(draft);
  }, [draft, hydrated, submitted]);

  const handleAnalyzed = useCallback((analysis: AudioAnalysis) => {
    setDraft((d) => {
      const auto: AutoWork = { title: d.work.title, duration: d.work.duration, bpm: d.work.bpm, genre: d.work.genre };
      const result = applyDetection(auto, detectedValues(analysis));
      setSuggestions(result.suggestions);
      return { ...d, work: { ...d.work, ...result.fields } };
    });
  }, []);

  const audio = useAudioImport(handleAnalyzed);

  const updateAuto = (fn: (fields: AutoWork) => AutoWork) =>
    setDraft((d) => ({ ...d, work: { ...d.work, ...fn({ title: d.work.title, duration: d.work.duration, bpm: d.work.bpm, genre: d.work.genre }) } }));

  const onFile = async (file: File) => {
    setDropError(null);
    setSuggestions({});
    // A valid new file replaces the previous one: its unconfirmed values go too,
    // so a failed analysis never leaves values from another track behind.
    if (validateAudioFile(file).ok) updateAuto(clearAutoValues);
    const error = await audio.importFile(file);
    if (error) setDropError(error);
  };

  const onEdit = (key: keyof DeclarationDraft["work"], value: string) => {
    setDraft((d) => ({ ...d, work: { ...d.work, [key]: editField(value) } }));
    setSuggestions((s) => omit(s, key));
  };

  const onAcceptSuggestion = (key: AutoFieldKey) => {
    const value = suggestions[key];
    if (value === undefined) return;
    setDraft((d) => ({ ...d, work: { ...d.work, [key]: { value, source: "confirmed" } } }));
    setSuggestions((s) => omit(s, key));
  };

  const step = draft.step;
  const setStep = (n: number) => {
    setDraft((d) => ({ ...d, step: n }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const hasUnconfirmed = (["title", "duration", "bpm", "genre"] as const).some((k) => draft.work[k].source === "auto");
  const canContinue =
    step === 0
      ? draft.work.title.value.trim() !== "" &&
        parseDuration(draft.work.duration.value) !== null &&
        !bpmError(draft.work.bpm.value) &&
        !iswcError(draft.work.iswc.value)
      : true;
  const rightsValid = validateRights(draft.rightsHolders, { instrumental: draft.instrumental }).valid;

  const next = () => {
    if (step === 1 && !rightsValid) {
      // Errors stay hidden until the user tries to move on, then point at the first one.
      setShowRightsErrors(true);
      requestAnimationFrame(() =>
        document.querySelector(".text-danger")?.closest("section, ul")?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
      return;
    }
    if (step === 0 && hasUnconfirmed) updateAuto(confirmAutoValues);
    if (step < STEPS.length - 1) setStep(step + 1);
    else {
      setSubmitted(true);
      clearDraft();
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center sm:py-28">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">Déclaration enregistrée</h1>
        <p className="mt-2 text-sm text-muted">« {draft.work.title.value} » a bien été déclarée. Vous recevrez une confirmation par e-mail.</p>
        <button
          type="button"
          onClick={() => {
            audio.remove();
            setDraft(createEmptyDraft());
            setShowRightsErrors(false);
            setSubmitted(false);
          }}
          className="btn-primary mt-8"
        >
          Déclarer une autre œuvre
        </button>
      </div>
    );
  }

  const primaryLabel = step === STEPS.length - 1 ? "Envoyer la déclaration" : step === 0 && hasUnconfirmed ? "Confirmer et continuer" : "Continuer";

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-36 pt-8 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12 lg:pt-12">
      {/* Step rail (desktop) */}
      <aside className="hidden lg:block">
        <div className="sticky top-28">
          <p className="eyebrow mb-4">Déclaration d&apos;œuvre</p>
          <ol className="relative space-y-1" aria-label="Étapes">
            {STEPS.map((s, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <li key={s.title} className="relative">
                  {i < STEPS.length - 1 && (
                    <span aria-hidden className={`absolute left-[15px] top-10 h-[calc(100%-20px)] w-px ${done ? "bg-accent" : "bg-line"}`} />
                  )}
                  <button
                    type="button"
                    disabled={i > step}
                    onClick={() => setStep(i)}
                    aria-current={current ? "step" : undefined}
                    className={`flex w-full items-start gap-3 rounded-xl px-0 py-2 text-left transition disabled:cursor-default ${current ? "" : "hover:opacity-80"}`}
                  >
                    <span
                      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition ${
                        current
                          ? "border-accent bg-accent text-white shadow-[0_0_0_4px_var(--accent-soft)]"
                          : done
                            ? "border-accent bg-surface text-accent"
                            : "border-line-strong bg-surface text-muted"
                      }`}
                    >
                      {done ? (
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                          <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="pt-1">
                      <span className={`block text-sm ${current ? "font-semibold text-foreground" : done ? "font-medium text-foreground" : "text-muted"}`}>
                        {s.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{s.rail}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-8 rounded-xl border border-line bg-surface p-4 text-xs leading-relaxed text-muted">
            <p className="font-medium text-foreground">Analyse 100 % locale</p>
            <p className="mt-1">Votre fichier audio ne quitte jamais votre appareil. Seules les informations saisies sont enregistrées.</p>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Compact progress (mobile / tablet) */}
        <div className="mb-6 lg:hidden">
          <div className="flex items-center justify-between text-xs">
            <span className="eyebrow">
              Étape {step + 1} sur {STEPS.length}
            </span>
            {step < STEPS.length - 1 && <span className="text-muted">Ensuite : {STEPS[step + 1].title}</span>}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5" aria-hidden>
            {STEPS.map((s, i) => (
              <span key={s.title} className={`h-1 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
            ))}
          </div>
        </div>

        <header className="mb-6 max-w-2xl">
          <p className="eyebrow hidden lg:block">
            Étape {step + 1} sur {STEPS.length}
          </p>
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight sm:text-3xl lg:mt-2">{STEPS[step].title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{STEPS[step].subtitle}</p>
        </header>

        {step === 0 && (
          <WorkStep
            work={draft.work}
            audio={audio.state}
            dropError={dropError}
            suggestions={suggestions}
            onFile={onFile}
            onEdit={onEdit}
            onAcceptSuggestion={onAcceptSuggestion}
            onConfirm={() => updateAuto(confirmAutoValues)}
            onCancelAnalysis={audio.cancel}
            onRemoveFile={() => {
              audio.remove();
              setSuggestions({});
              setDropError(null);
              updateAuto(clearAutoValues);
            }}
            onPickBpm={(bpm) => onEdit("bpm", String(bpm).replace(".", ","))}
            onPickGenre={(label) => onEdit("genre", label)}
          />
        )}
        {step === 1 && (
          <RightsStep
            holders={draft.rightsHolders}
            instrumental={draft.instrumental}
            showErrors={showRightsErrors}
            onChange={(rightsHolders) => setDraft((d) => ({ ...d, rightsHolders }))}
            onInstrumentalChange={(instrumental) => setDraft((d) => ({ ...d, instrumental }))}
          />
        )}
        {step === 2 && <ReviewStep draft={draft} onEditStep={setStep} />}
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="hidden items-center gap-2 text-xs text-muted sm:flex">
            {hydrated && (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
                Brouillon enregistré automatiquement
              </>
            )}
          </span>
          <div className="flex flex-1 justify-end gap-2 sm:flex-none">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="btn-secondary">
                Retour
              </button>
            )}
            <button type="button" onClick={next} disabled={!canContinue} className="btn-primary flex-1 sm:min-w-44 sm:flex-none">
              {primaryLabel}
              {step < STEPS.length - 1 && (
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
