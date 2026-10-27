"use client";

import { useRef } from "react";
import type { AudioImportState } from "@/hooks/useAudioImport";
import { parseDuration } from "@/lib/audio/duration";
import type { DeclarationDraft, PublicationStatus } from "@/lib/declaration/draft";
import { isValidIswc } from "@/lib/declaration/iswc";
import { parseBpm, type AutoFieldKey, type Suggestions } from "@/lib/declaration/fields";
import { AudioCard } from "./AudioCard";
import { AudioDropzone, type AudioDropzoneHandle } from "./AudioDropzone";
import { TrackedInput } from "./TrackedInput";
import { WorkStatusCard } from "./WorkStatusCard";

type WorkKey = keyof DeclarationDraft["work"];

interface Props {
  publication: PublicationStatus;
  originCountry: string;
  onPublicationChange: (value: PublicationStatus) => void;
  onCountryChange: (code: string) => void;
  work: DeclarationDraft["work"];
  audio: AudioImportState;
  dropError: string | null;
  suggestions: Suggestions;
  onFile: (file: File) => void;
  onEdit: (key: WorkKey, value: string) => void;
  onAcceptSuggestion: (key: AutoFieldKey) => void;
  onConfirm: () => void;
  onCancelAnalysis: () => void;
  onRemoveFile: () => void;
  onPickBpm: (bpm: number) => void;
  onPickGenre: (label: string) => void;
}

export function durationError(value: string) {
  return value.trim() && parseDuration(value) === null ? "Format attendu : mm:ss (ex. 3:42)" : null;
}

export function bpmError(value: string) {
  return value.trim() && parseBpm(value) === null ? "BPM entre 20 et 300" : null;
}

export function iswcError(value: string) {
  return value.trim() && !isValidIswc(value) ? "ISWC invalide (format T-123.456.789-0)" : null;
}

function SectionHeader({ title, description, aside }: { title: string; description: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
      <div>
        <h2 className="font-display text-[15px] font-semibold">{title}</h2>
        <p className="mt-0.5 text-[13px] text-muted">{description}</p>
      </div>
      {aside}
    </div>
  );
}

export function WorkStep(props: Props) {
  const { work, audio, suggestions, onEdit } = props;
  const durationRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<AudioDropzoneHandle>(null);
  const hasFile = audio.status !== "idle" && audio.status !== "rejected";
  const autoCount = (["title", "duration", "bpm", "genre"] as const).filter((k) => work[k].source === "auto").length;

  return (
    <div className="space-y-6">
      <WorkStatusCard
        publication={props.publication}
        originCountry={props.originCountry}
        onPublicationChange={props.onPublicationChange}
        onCountryChange={props.onCountryChange}
      />

      <section className="space-y-3">
        {hasFile ? (
          <>
            <AudioCard
              state={audio}
              hasUnconfirmed={autoCount > 0}
              onConfirm={props.onConfirm}
              onCorrect={() => {
                durationRef.current?.focus();
                durationRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              onCancel={props.onCancelAnalysis}
              onRemove={props.onRemoveFile}
              onReplace={() => replaceRef.current?.open()}
              onPickBpm={props.onPickBpm}
              onPickGenre={props.onPickGenre}
              currentGenre={work.genre.value}
            />
            <AudioDropzone ref={replaceRef} onFile={props.onFile} hidden />
            {props.dropError && (
              <p role="alert" className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-xs text-danger">
                {props.dropError}
              </p>
            )}
          </>
        ) : (
          <AudioDropzone onFile={props.onFile} error={audio.status === "rejected" ? audio.message : props.dropError} />
        )}
      </section>

      <section className="card">
        <SectionHeader
          title="Informations de l'œuvre"
          description="Chaque valeur reste modifiable."
          aside={
            autoCount > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-auto/25 bg-auto-soft px-2.5 py-1 text-xs font-medium text-auto">
                <span className="h-1.5 w-1.5 rounded-full bg-auto" aria-hidden />
                {autoCount} champ{autoCount > 1 ? "s" : ""} à vérifier
              </span>
            ) : undefined
          }
        />
        <div className="grid gap-x-4 gap-y-3 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <div className="sm:col-span-2">
            <TrackedInput
              id="title"
              label="Titre de l'œuvre"
              required
              field={work.title}
              onChange={(v) => onEdit("title", v)}
              placeholder="Ex. Lumière du Nord"
              suggestion={suggestions.title}
              onAcceptSuggestion={() => props.onAcceptSuggestion("title")}
            />
          </div>
          <TrackedInput
            ref={durationRef}
            id="duration"
            label="Durée (mm:ss)"
            required
            mono
            field={work.duration}
            onChange={(v) => onEdit("duration", v)}
            placeholder="3:42"
            inputMode="numeric"
            error={durationError(work.duration.value)}
            suggestion={suggestions.duration}
            onAcceptSuggestion={() => props.onAcceptSuggestion("duration")}
          />
          <TrackedInput
            id="bpm"
            label="BPM"
            mono
            field={work.bpm}
            onChange={(v) => onEdit("bpm", v)}
            placeholder="120"
            inputMode="decimal"
            hint={work.bpm.source === "auto" ? "Estimation automatique — vérifiez à l'écoute" : "Tempo principal du morceau"}
            error={bpmError(work.bpm.value)}
            suggestion={suggestions.bpm}
            onAcceptSuggestion={() => props.onAcceptSuggestion("bpm")}
          />
          <div className="sm:col-span-2">
            <TrackedInput
              id="genre"
              label="Genre"
              field={work.genre}
              onChange={(v) => onEdit("genre", v)}
              placeholder="Électro, pop, jazz…"
              hint={work.genre.source === "auto" ? "Suggestion automatique — à vérifier" : undefined}
              suggestion={suggestions.genre}
              onAcceptSuggestion={() => props.onAcceptSuggestion("genre")}
            />
          </div>
        </div>

        <div className="border-t border-line px-5 py-5 sm:px-6">
          <p className="eyebrow mb-3">Identifiants · facultatifs</p>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <TrackedInput
              id="iswc"
              label="ISWC"
              mono
              field={work.iswc}
              onChange={(v) => onEdit("iswc", v.toUpperCase())}
              placeholder="T-123.456.789-0"
              hint="Code de l'œuvre, s'il a déjà été attribué"
              error={iswcError(work.iswc.value)}
            />
            <TrackedInput
              id="isrc"
              label="ISRC"
              mono
              field={work.isrc}
              onChange={(v) => onEdit("isrc", v.toUpperCase())}
              placeholder="FR-XXX-26-00001"
              hint="Code de l'enregistrement"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
