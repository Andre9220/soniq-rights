export const MAX_AUDIO_FILE_BYTES = 150 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = ["mp3", "wav"] as const;
const ACCEPTED_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/vnd.wave",
];

/** Value for the `accept` attribute of the file input. */
export const AUDIO_ACCEPT = [
  ...ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`),
  ...ACCEPTED_MIME_TYPES,
].join(",");

export type AudioFormat = (typeof ACCEPTED_EXTENSIONS)[number];

export type FileValidation =
  | { ok: true; format: AudioFormat }
  | { ok: false; reason: "unsupported-format" | "empty" | "too-large"; message: string };

export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/**
 * Checks the extension first (browsers often report an empty or generic MIME
 * type for WAV files), then rejects files whose MIME type is clearly not audio.
 */
export function validateAudioFile(file: Pick<File, "name" | "size" | "type">): FileValidation {
  const ext = getExtension(file.name);
  const mime = file.type.toLowerCase();
  const extOk = (ACCEPTED_EXTENSIONS as readonly string[]).includes(ext);
  const mimeOk = mime === "" || mime === "application/octet-stream" || ACCEPTED_MIME_TYPES.includes(mime);

  if (!extOk || !mimeOk) {
    return {
      ok: false,
      reason: "unsupported-format",
      message: "Format non pris en charge. Importez un fichier MP3 ou WAV.",
    };
  }
  if (file.size === 0) {
    return { ok: false, reason: "empty", message: "Ce fichier est vide." };
  }
  if (file.size > MAX_AUDIO_FILE_BYTES) {
    return {
      ok: false,
      reason: "too-large",
      message: `Fichier trop volumineux (max. ${formatFileSize(MAX_AUDIO_FILE_BYTES)}).`,
    };
  }
  return { ok: true, format: ext as AudioFormat };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1).replace(".", ",")} Mo`;
}
