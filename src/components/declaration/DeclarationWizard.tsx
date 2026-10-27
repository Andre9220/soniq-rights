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
  { title: "L'œuvre", subtitle: "Importez votre morceau : durée, tempo et titre sont proposés automatiquement." },
  { title: "Ayants droit", subtitle: "Répartissez les droits d'auteur entre les contributeurs." },
  { title: "Récapitulatif", subtitle: "Vérifiez votre déclaration avant l'envoi." },
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
      const auto: AutoWork = { title: d.work.title, duration: d.work.duration, bpm: d.work.bpm };
      const result = applyDetection(auto, detectedValues(analysis));
      setSuggestions(result.suggestions);
      return { ...d, work: { ...d.work, ...result.fields } };
    });
  }, []);

  const audio = useAudioImport(handleAnalyzed);

  const updateAuto = (fn: (fields: AutoWork) => AutoWork) =>
    setDraft((d) => ({ ...d, work: { ...d.work, ...fn({ title: d.work.title, duration: d.work.duration, bpm: d.work.bpm }) } }));

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

  const hasUnconfirmed = (["title", "duration", "bpm"] as const).some((k) => draft.work[k].source === "auto");
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
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <p className="text-2xl font-semibold">Déclaration enregistrée</p>
        <p className="mt-2 text-sm text-muted">« {draft.work.title.value} » a bien été déclarée.</p>
        <button
          type="button"
          onClick={() => {
            audio.remove();
            setDraft(createEmptyDraft());
            setShowRightsErrors(false);
            setSubmitted(false);
          }}
          className="mt-6 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white"
        >
          Nouvelle déclaration
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-8 sm:px-6 sm:pt-12">
      <ol className="mb-8 flex gap-2" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex-1">
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className="w-full text-left disabled:cursor-default"
            >
              <span className={`block h-1 rounded-full transition ${i <= step ? "bg-accent" : "bg-line"}`} />
              <span className={`mt-2 block text-xs ${i === step ? "font-medium text-foreground" : "text-muted"}`}>
                {i + 1}. {s.title}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{STEPS[step].title}</h1>
      <p className="mt-1 mb-6 text-sm text-muted">{STEPS[step].subtitle}</p>

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
      {step === 2 && <ReviewStep draft={draft} />}

      <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="hidden text-xs text-muted sm:block">{hydrated ? "Brouillon enregistré automatiquement" : ""}</span>
          <div className="flex flex-1 justify-end gap-2 sm:flex-none">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:bg-surface-muted">
                Retour
              </button>
            )}
            <button
              type="button"
              onClick={next}
              disabled={!canContinue}
              className="flex-1 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40 sm:flex-none"
            >
              {step === STEPS.length - 1 ? "Envoyer la déclaration" : step === 0 && hasUnconfirmed ? "Confirmer et continuer" : "Continuer"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
