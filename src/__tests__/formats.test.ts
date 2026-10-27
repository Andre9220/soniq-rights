import { describe, expect, it } from "vitest";
import { formatFileSize, MAX_AUDIO_FILE_BYTES, validateAudioFile } from "@/lib/audio/formats";

const file = (name: string, type = "", size = 1000) => ({ name, type, size });

describe("validateAudioFile", () => {
  it.each([
    file("track.mp3", "audio/mpeg"),
    file("TRACK.MP3", "audio/mp3"),
    file("mix.wav", "audio/wav"),
    file("mix.wav", "audio/x-wav"),
    file("mix.wav", ""), // some browsers report no MIME type
    file("mix.wav", "application/octet-stream"),
  ])("accepts $name ($type)", (f) => {
    expect(validateAudioFile(f).ok).toBe(true);
  });

  it.each([
    file("cover.png", "image/png"),
    file("song.flac", "audio/flac"),
    file("song.m4a", "audio/mp4"),
    file("song.ogg", "audio/ogg"),
    file("notes.txt", "text/plain"),
    file("noext", ""),
    file("fake.mp3", "video/mp4"), // extension says MP3, MIME says otherwise
  ])("rejects incompatible $name ($type)", (f) => {
    const result = validateAudioFile(f);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unsupported-format");
  });

  it("rejects empty files", () => {
    const result = validateAudioFile(file("a.mp3", "audio/mpeg", 0));
    expect(result).toMatchObject({ ok: false, reason: "empty" });
  });

  it("rejects files over the size limit", () => {
    const result = validateAudioFile(file("a.wav", "audio/wav", MAX_AUDIO_FILE_BYTES + 1));
    expect(result).toMatchObject({ ok: false, reason: "too-large" });
  });
});

describe("formatFileSize", () => {
  it("formats sizes in French units", () => {
    expect(formatFileSize(512)).toBe("512 o");
    expect(formatFileSize(2048)).toBe("2 Ko");
    expect(formatFileSize(8.4 * 1024 * 1024)).toBe("8,4 Mo");
  });
});
