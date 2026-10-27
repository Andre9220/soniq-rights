"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { AUDIO_ACCEPT, MAX_AUDIO_FILE_BYTES, formatFileSize } from "@/lib/audio/formats";

interface Props {
  onFile: (file: File) => void;
  error?: string | null;
  /** Renders only the hidden input (used for "Remplacer" on the audio card). */
  hidden?: boolean;
}

export interface AudioDropzoneHandle {
  open: () => void;
}

export const AudioDropzone = forwardRef<AudioDropzoneHandle, Props>(function AudioDropzone({ onFile, error, hidden = false }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  useImperativeHandle(ref, () => ({ open: () => inputRef.current?.click() }), []);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const input = <input ref={inputRef} type="file" accept={AUDIO_ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files)} />;
  if (hidden) return input;

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
        className={`group relative flex cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border-[1.5px] border-dashed px-6 py-12 text-center transition-colors focus:outline-none focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15 sm:py-14 ${
          dragging ? "border-accent bg-accent-soft" : "border-line-strong bg-surface hover:border-accent/70 hover:bg-accent-soft/40"
        }`}
      >
        <span className="flex h-12 items-end gap-1" aria-hidden>
          {[0.35, 0.7, 1, 0.55, 0.85, 0.4].map((h, i) => (
            <span
              key={i}
              className="w-1.5 rounded-full bg-gradient-to-t from-brand-deep to-brand-sky transition-transform duration-300 group-hover:scale-y-110"
              style={{ height: `${h * 100}%`, transitionDelay: `${i * 30}ms` }}
            />
          ))}
        </span>
        <div className="space-y-1">
          <p className="font-display text-base font-semibold">{dragging ? "Déposez le fichier" : "Glissez votre morceau ici"}</p>
          <p className="text-sm text-muted">
            ou <span className="font-medium text-accent underline-offset-4 group-hover:underline">choisissez un fichier</span>
          </p>
        </div>
        <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted">
          <li>MP3 · WAV</li>
          <li aria-hidden>·</li>
          <li>{formatFileSize(MAX_AUDIO_FILE_BYTES)} max.</li>
          <li aria-hidden>·</li>
          <li className="inline-flex items-center gap-1">
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <rect x="3" y="7" width="10" height="7" rx="1.5" />
              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
            </svg>
            Analysé sur votre appareil
          </li>
        </ul>
        {input}
      </div>
      {error && (
        <p role="alert" className="mt-2 rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
