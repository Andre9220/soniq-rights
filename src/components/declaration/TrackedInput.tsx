"use client";

import { forwardRef } from "react";
import type { TrackedField } from "@/lib/declaration/fields";
import { SourceBadge } from "./SourceBadge";

interface Props {
  id: string;
  label: string;
  field: TrackedField;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  suggestion?: string;
  onAcceptSuggestion?: () => void;
  inputMode?: "text" | "numeric" | "decimal";
  required?: boolean;
  /** Monospaced digits for codes and durations. */
  mono?: boolean;
}

export const TrackedInput = forwardRef<HTMLInputElement, Props>(function TrackedInput(
  { id, label, field, onChange, placeholder, hint, error, suggestion, onAcceptSuggestion, inputMode = "text", required, mono = false },
  ref,
) {
  const highlighted = field.source === "auto";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium">
          {label}
          {required && <span className="text-accent"> *</span>}
        </label>
        <SourceBadge source={field.source} />
      </div>
      <input
        ref={ref}
        id={id}
        value={field.value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint`}
        data-auto={highlighted || undefined}
        className={`field-input ${mono ? "font-mono tabular-nums" : ""}`}
      />
      <div id={`${id}-hint`} className="mt-1.5 min-h-4 text-xs">
        {error ? (
          <span className="text-danger">{error}</span>
        ) : suggestion && onAcceptSuggestion ? (
          <span className="text-muted">
            Détecté : <span className="text-foreground">{suggestion}</span>{" "}
            <button type="button" onClick={onAcceptSuggestion} className="font-semibold text-accent underline-offset-2 hover:underline">
              Utiliser
            </button>
          </span>
        ) : (
          hint && <span className="text-muted">{hint}</span>
        )}
      </div>
    </div>
  );
});
