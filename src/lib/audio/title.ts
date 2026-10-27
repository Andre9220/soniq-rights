/**
 * Turns a file name into a readable title suggestion:
 * "03 - Mon_Titre (Master v2).wav" → "Mon Titre".
 */
export function titleFromFileName(fileName: string): string {
  let name = fileName.replace(/\.[a-z0-9]{2,4}$/i, "");
  name = name.replace(/[_]+/g, " ");
  // Leading track numbers: "01 ", "01 - ", "1. "
  name = name.replace(/^\s*\d{1,3}\s*(?:[-.)]\s*|\s+)/, "");
  // Production suffixes in brackets: (master), [final v2], (mix 3)...
  name = name.replace(/[([]\s*(?:master(?:ed)?|final|mix(?:down)?|bounce|demo|v\d+)[^)\]]*[)\]]/gi, "");
  // Trailing version markers: " v2", " final", " master"
  name = name.replace(/(?:\s+-)?\s+(?:v\d+|final|master(?:ed)?)\s*$/i, "");
  name = name.replace(/\s{2,}/g, " ").trim();
  return name;
}

// ---------------------------------------------------------------------------
// Embedded metadata (ID3v2 / ID3v1 for MP3, LIST/INFO or id3 chunk for WAV)
// ---------------------------------------------------------------------------

const ascii = (view: DataView, offset: number, length: number) => {
  let out = "";
  for (let i = 0; i < length && offset + i < view.byteLength; i++) out += String.fromCharCode(view.getUint8(offset + i));
  return out;
};

const cleanText = (text: string) => text.replace(/\0+$/g, "").replace(/\0/g, "").trim();

function decodeText(bytes: Uint8Array, encoding: number): string {
  try {
    switch (encoding) {
      case 0:
        return new TextDecoder("latin1").decode(bytes);
      case 1:
        return new TextDecoder("utf-16").decode(bytes); // BOM-aware
      case 2:
        return new TextDecoder("utf-16be").decode(bytes);
      default:
        return new TextDecoder("utf-8").decode(bytes);
    }
  } catch {
    return "";
  }
}

const syncsafe = (view: DataView, offset: number) =>
  ((view.getUint8(offset) & 0x7f) << 21) |
  ((view.getUint8(offset + 1) & 0x7f) << 14) |
  ((view.getUint8(offset + 2) & 0x7f) << 7) |
  (view.getUint8(offset + 3) & 0x7f);

function readId3v2Title(view: DataView, start: number): string | null {
  if (view.byteLength < start + 10 || ascii(view, start, 3) !== "ID3") return null;
  const major = view.getUint8(start + 3);
  const flags = view.getUint8(start + 5);
  const tagSize = syncsafe(view, start + 6);
  const end = Math.min(view.byteLength, start + 10 + tagSize);
  let pos = start + 10;

  if (flags & 0x40 && major >= 3) {
    // Extended header
    pos += major === 4 ? syncsafe(view, pos) : view.getUint32(pos) + 4;
  }

  const idLen = major === 2 ? 3 : 4;
  const headerLen = major === 2 ? 6 : 10;
  const titleId = major === 2 ? "TT2" : "TIT2";

  while (pos + headerLen <= end) {
    const id = ascii(view, pos, idLen);
    if (!/^[A-Z0-9]+$/.test(id)) break; // padding
    const size =
      major === 2
        ? (view.getUint8(pos + 3) << 16) | (view.getUint8(pos + 4) << 8) | view.getUint8(pos + 5)
        : major === 4
          ? syncsafe(view, pos + 4)
          : view.getUint32(pos + 4);
    const dataStart = pos + headerLen;
    if (size <= 0 || dataStart + size > end) break;
    if (id === titleId) {
      const encoding = view.getUint8(dataStart);
      const bytes = new Uint8Array(view.buffer, view.byteOffset + dataStart + 1, size - 1);
      return cleanText(decodeText(bytes, encoding)) || null;
    }
    pos = dataStart + size;
  }
  return null;
}

function readId3v1Title(view: DataView): string | null {
  if (view.byteLength < 128) return null;
  const start = view.byteLength - 128;
  if (ascii(view, start, 3) !== "TAG") return null;
  const bytes = new Uint8Array(view.buffer, view.byteOffset + start + 3, 30);
  return cleanText(decodeText(bytes, 0)) || null;
}

function readWavTitle(view: DataView): string | null {
  if (view.byteLength < 12 || ascii(view, 0, 4) !== "RIFF" || ascii(view, 8, 4) !== "WAVE") return null;
  let pos = 12;
  while (pos + 8 <= view.byteLength) {
    const id = ascii(view, pos, 4);
    const size = view.getUint32(pos + 4, true);
    const body = pos + 8;
    if (id === "LIST" && ascii(view, body, 4) === "INFO") {
      let sub = body + 4;
      const listEnd = Math.min(view.byteLength, body + size);
      while (sub + 8 <= listEnd) {
        const subId = ascii(view, sub, 4);
        const subSize = view.getUint32(sub + 4, true);
        if (subId === "INAM") {
          const bytes = new Uint8Array(view.buffer, view.byteOffset + sub + 8, Math.min(subSize, listEnd - sub - 8));
          return cleanText(decodeText(bytes, 3)) || null;
        }
        sub += 8 + subSize + (subSize % 2);
      }
    }
    if (id.toLowerCase() === "id3 ") {
      const title = readId3v2Title(view, body);
      if (title) return title;
    }
    pos = body + size + (size % 2);
  }
  return null;
}

/** Reads the embedded title of an MP3 or WAV file, if any. Never throws. */
export function readEmbeddedTitle(buffer: ArrayBuffer): string | null {
  try {
    const view = new DataView(buffer);
    return readWavTitle(view) ?? readId3v2Title(view, 0) ?? readId3v1Title(view);
  } catch {
    return null;
  }
}

export type TitleSource = "metadata" | "filename";

export function suggestTitle(fileName: string, buffer: ArrayBuffer | null): { title: string; source: TitleSource } | null {
  const embedded = buffer ? readEmbeddedTitle(buffer) : null;
  if (embedded) return { title: embedded, source: "metadata" };
  const fromName = titleFromFileName(fileName);
  return fromName ? { title: fromName, source: "filename" } : null;
}
