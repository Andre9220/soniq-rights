"use client";

import { useRef } from "react";
import type { AudioImportState } from "@/hooks/useAudioImport";
import { parseDuration } from "@/lib/audio/duration";
import type { DeclarationDraft } from "@/lib/declaration/draft";
import { isValidIswc } from "@/lib/declaration/iswc";
import { parseBpm, type AutoFieldKey, type Suggestions } from "@/lib/declaration/fields";
import { AudioCard } from "./AudioCard";
import { AudioDropzone } from "./AudioDropzone";
import { TrackedInput } from "./TrackedInput";

type WorkKey = keyof DeclarationDraft["work"];

interface Props {
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

export function WorkStep(props: Props) {
  const { work, audio, suggestions, onEdit } = props;
  const durationRef = useRef<HTMLInputElement>(null);
  const hasFile = audio.status !== "idle" && audio.status !== "rejected";
  const hasUnconfirmed = (["title", "duration", "bpm", "genre"] as const).some((k) => work[k].source === "auto");

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {hasFile ? (
          <>
            <AudioCard
              state={audio}
              hasUnconfirmed={hasUnconfirmed}
              onConfirm={props.onConfirm}
              onCorrect={() => {
                durationRef.current?.focus();
                durationRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              onCancel={props.onCancelAnalysis}
              onRemove={props.onRemoveFile}
              onPickBpm={props.onPickBpm}
              onPickGenre={props.onPickGenre}
              currentGenre={work.genre.value}
            />
            <AudioDropzone onFile={props.onFile} error={props.dropError} compact />
          </>
        ) : (
          <AudioDropzone
            onFile={props.onFile}
            error={audio.status === "rejected" ? audio.message : props.dropError}
          />
        )}
        {hasUnconfirmed && (
          <p className="flex items-center gap-2 text-xs text-muted">
            <span className="inline-block h-2 w-2 rounded-full bg-auto" aria-hidden />
            Les champs marqués <span className="font-medium text-auto">Auto</span> ont été renseignés depuis votre fichier. Vérifiez-les puis
            confirmez.
          </p>
        )}
      </div>

      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
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
          field={work.bpm}
          onChange={(v) => onEdit("bpm", v)}
          placeholder="120"
          inputMode="decimal"
          hint={work.bpm.source === "auto" ? "Estimation automatique — à vérifier à l'écoute" : "Tempo principal"}
          error={bpmError(work.bpm.value)}
          suggestion={suggestions.bpm}
          onAcceptSuggestion={() => props.onAcceptSuggestion("bpm")}
        />
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
        <TrackedInput
          id="iswc"
          label="ISWC (facultatif)"
          field={work.iswc}
          onChange={(v) => onEdit("iswc", v.toUpperCase())}
          placeholder="T-123.456.789-0"
          hint="Code international de l'œuvre, s'il a déjà été attribué"
          error={iswcError(work.iswc.value)}
        />
        <TrackedInput
          id="isrc"
          label="ISRC (facultatif)"
          field={work.isrc}
          onChange={(v) => onEdit("isrc", v.toUpperCase())}
          placeholder="FR-XXX-26-00001"
          hint="Code de l'enregistrement"
        />
      </div>
    </div>
  );
}
