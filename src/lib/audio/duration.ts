/** Formats a duration in seconds as `m:ss` (or `h:mm:ss` beyond one hour). */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "";
  const rounded = Math.round(totalSeconds);
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/**
 * Parses a user-entered duration. Accepts `m:ss`, `h:mm:ss` or a plain number
 * of seconds. Returns null when the input is not a valid duration.
 */
export function parseDuration(input: string): number | null {
  const value = input.trim();
  if (value === "") return null;
  if (/^\d+$/.test(value)) return Number(value);

  const parts = value.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => /^\d+$/.test(p))) return null;

  const nums = parts.map(Number);
  const [sec] = nums.slice(-1);
  const [min] = nums.slice(-2, -1);
  if (sec > 59) return null;
  if (nums.length === 3 && min > 59) return null;
  return nums.reduce((acc, n) => acc * 60 + n, 0);
}
