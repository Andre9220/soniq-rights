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
}

export const TrackedInput = forwardRef<HTMLInputElement, Props>(function TrackedInput(
  { id, label, field, onChange, placeholder, hint, error, suggestion, onAcceptSuggestion, inputMode = "text", required },
  ref,
) {
  const highlighted = field.source === "auto";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-muted"> *</span>}
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
        className={`w-full rounded-xl border bg-surface px-3.5 py-2.5 text-base outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm ${
          error ? "border-danger" : highlighted ? "border-auto/50 bg-auto-soft/40" : "border-line"
        }`}
      />
      <div id={`${id}-hint`} className="mt-1 min-h-4 text-xs">
        {error ? (
          <span className="text-danger">{error}</span>
        ) : suggestion && onAcceptSuggestion ? (
          <span className="text-muted">
            Détecté : <span className="text-foreground">{suggestion}</span>{" "}
            <button type="button" onClick={onAcceptSuggestion} className="font-medium text-accent hover:underline">
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
