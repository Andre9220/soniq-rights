/** Label + control + error, shared by the rights holder and publisher cards. */
export function Field({
  label,
  error,
  optional,
  children,
}: {
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-[13px] font-medium">
        {label}
        {optional ? <span className="font-normal text-muted"> · facultatif</span> : <span className="text-accent"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-xs text-danger">{error}</span>}
    </label>
  );
}
