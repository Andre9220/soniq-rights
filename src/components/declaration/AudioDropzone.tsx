"use client";

import { useRef, useState } from "react";
import { AUDIO_ACCEPT, MAX_AUDIO_FILE_BYTES, formatFileSize } from "@/lib/audio/formats";

interface Props {
  onFile: (file: File) => void;
  error?: string | null;
  compact?: boolean;
}

export function AudioDropzone({ onFile, error, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Importer un fichier audio MP3 ou WAV"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
        className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          compact ? "gap-1 px-4 py-4" : "gap-3 px-6 py-10 sm:py-12"
        } ${dragging ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-accent/60"}`}
      >
        {!compact && (
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent transition group-hover:scale-105">
            <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </span>
        )}
        <p className="text-sm font-medium">
          {compact ? "Remplacer le fichier" : "Glissez votre morceau ici"}
          <span className="text-muted"> ou </span>
          <span className="text-accent underline-offset-2 group-hover:underline">parcourez</span>
        </p>
        <p className="text-xs text-muted">
          MP3 ou WAV · {formatFileSize(MAX_AUDIO_FILE_BYTES)} max. · analysé dans votre navigateur, rien n&apos;est envoyé
        </p>
        <input ref={inputRef} type="file" accept={AUDIO_ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files)} />
      </div>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
