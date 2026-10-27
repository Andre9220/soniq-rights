import { describe, expect, it } from "vitest";
import { readEmbeddedTitle, suggestTitle, titleFromFileName } from "@/lib/audio/title";

describe("titleFromFileName", () => {
  it.each([
    ["Lumiere du Nord.mp3", "Lumiere du Nord"],
    ["01 - Nuit_Blanche.wav", "Nuit Blanche"],
    ["03. Solstice (Master v2).wav", "Solstice"],
    ["Horizon [final].mp3", "Horizon"],
    ["Horizon - v3.mp3", "Horizon"],
    ["Été indien master.wav", "Été indien"],
    ["1999.mp3", "1999"],
  ])("%s → %s", (name, expected) => {
    expect(titleFromFileName(name)).toBe(expected);
  });
});

const bytes = (...parts: Array<string | number[]>) => {
  const out: number[] = [];
  for (const p of parts) out.push(...(typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p));
  return new Uint8Array(out).buffer;
};
const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u32le = (n: number) => u32be(n).reverse();
const syncsafe = (n: number) => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];

describe("readEmbeddedTitle", () => {
  it("reads an ID3v2.3 TIT2 frame (latin1)", () => {
    const text = "Aurore";
    const frame = [..."TIT2"].map((c) => c.charCodeAt(0)).concat(u32be(text.length + 1), [0, 0], [0], [...text].map((c) => c.charCodeAt(0)));
    const buffer = bytes("ID3", [3, 0, 0], syncsafe(frame.length), frame, new Array(64).fill(0));
    expect(readEmbeddedTitle(buffer)).toBe("Aurore");
  });

  it("reads an ID3v2.4 UTF-8 title", () => {
    const encoded = [...new TextEncoder().encode("Été")];
    const frame = [..."TIT2"].map((c) => c.charCodeAt(0)).concat(syncsafe(encoded.length + 1), [0, 0], [3], encoded);
    const buffer = bytes("ID3", [4, 0, 0], syncsafe(frame.length), frame);
    expect(readEmbeddedTitle(buffer)).toBe("Été");
  });

  it("reads a WAV LIST/INFO INAM chunk", () => {
    const name = "Marée\0";
    const nameBytes = [...new TextEncoder().encode(name)];
    const inam = [..."INAM"].map((c) => c.charCodeAt(0)).concat(u32le(nameBytes.length), nameBytes);
    const list = [..."INFO"].map((c) => c.charCodeAt(0)).concat(inam);
    const fmt = [..."fmt "].map((c) => c.charCodeAt(0)).concat(u32le(16), new Array(16).fill(0));
    const listChunk = [..."LIST"].map((c) => c.charCodeAt(0)).concat(u32le(list.length), list);
    const body = [..."WAVE"].map((c) => c.charCodeAt(0)).concat(fmt, listChunk);
    const buffer = bytes("RIFF", u32le(body.length), body);
    expect(readEmbeddedTitle(buffer)).toBe("Marée");
  });

  it("reads an ID3v1 tag at the end of the file", () => {
    const title = "Vieux Tag".padEnd(30, "\0");
    const tag = bytes(new Array(200).fill(0), "TAG", title, new Array(95).fill(0));
    expect(readEmbeddedTitle(tag)).toBe("Vieux Tag");
  });

  it("returns null for files without metadata or garbage data", () => {
    expect(readEmbeddedTitle(new Uint8Array(1024).buffer)).toBeNull();
    expect(readEmbeddedTitle(bytes("ID3", [3, 0, 0], [127, 127, 127, 127]))).toBeNull();
    expect(readEmbeddedTitle(new ArrayBuffer(0))).toBeNull();
  });
});

describe("suggestTitle", () => {
  it("prefers embedded metadata over the file name", () => {
    const frame = [..."TIT2"].map((c) => c.charCodeAt(0)).concat(u32be(4), [0, 0], [0], [..."Sol"].map((c) => c.charCodeAt(0)));
    const buffer = bytes("ID3", [3, 0, 0], syncsafe(frame.length), frame);
    expect(suggestTitle("track_01.mp3", buffer)).toEqual({ title: "Sol", source: "metadata" });
  });

  it("falls back to the file name", () => {
    expect(suggestTitle("02 - Brume.wav", new ArrayBuffer(8))).toEqual({ title: "Brume", source: "filename" });
  });
});
