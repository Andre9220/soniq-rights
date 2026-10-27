"use client";

import { useRef, useState } from "react";
import { checkContractFile, CONTRACT_ACCEPT } from "@/lib/declaration/contract";
import { formatFileSize } from "@/lib/audio/formats";

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
}

/** Drag-and-drop for the publishing contract. The file stays in memory and is sent with the declaration. */
export function ContractDropzone({ file, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (files: FileList | null) => {
    const next = files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!next) return;
    const problem = checkContractFile(next);
    setError(problem);
    if (!problem) onChange(next);
  };

  const input = <input ref={inputRef} type="file" accept={CONTRACT_ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files)} />;

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-5 py-3.5 sm:px-6">
        <h3 className="font-display text-[15px] font-semibold">
          Contrat d&apos;édition <span className="font-sans text-xs font-normal text-muted">· facultatif</span>
        </h3>
        <p className="mt-0.5 text-xs text-muted">Joint à la déclaration envoyée. PDF, JPG ou PNG, 4 Mo maximum.</p>
      </div>
      <div className="p-4 sm:p-5">
        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-muted/60 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent" aria-hidden>
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M11.5 2.5H5.5a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V7l-4.5-4.5z" strokeLinejoin="round" />
                <path d="M11.5 2.5V7H16M7 11h6M7 14h4" strokeLinecap="round" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-muted">{formatFileSize(file.size)}</p>
            </div>
            <button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface hover:text-foreground">
              Remplacer
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setError(null);
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-danger-soft hover:text-danger"
            >
              Retirer
            </button>
            {input}
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            aria-label="Joindre le contrat d'édition"
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
            className={`flex cursor-pointer items-center justify-center gap-3 rounded-xl border-[1.5px] border-dashed px-4 py-6 text-sm transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/15 ${
              dragging ? "border-accent bg-accent-soft" : "border-line-strong hover:border-accent/70 hover:bg-accent-soft/40"
            }`}
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M10 13V3.5M6.5 7L10 3.5 13.5 7M4 13.5v2A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>
              <span className="font-medium">{dragging ? "Déposez le contrat" : "Glissez le contrat ici"}</span>
              <span className="text-muted"> ou </span>
              <span className="font-medium text-accent">parcourez</span>
            </span>
            {input}
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}
        {file && <p className="mt-2 text-[11px] text-muted">Le fichier n&apos;est pas conservé dans le brouillon : rejoignez-le si vous rechargez la page.</p>}
      </div>
    </div>
  );
}
