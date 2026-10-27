import { describe, expect, it } from "vitest";
import { foldToReference, segmentWindows, summarizeTempo } from "@/lib/audio/tempo";

describe("foldToReference (half-time / double-time errors)", () => {
  it.each([
    [64, 128, 128],
    [256, 128, 128],
    [32, 128, 128],
    [126, 128, 126],
    [90, 120, 90], // 3:4 ratio is a real difference, not an octave error
  ])("%s relative to %s → %s", (bpm, ref, expected) => {
    expect(foldToReference(bpm, ref)).toBe(expected);
  });
});

describe("summarizeTempo", () => {
  it("is highly confident when all segments agree", () => {
    const t = summarizeTempo(120, [120, 119.8, 120.3]);
    expect(t).toMatchObject({ bpm: 120, variable: false, confidence: "high", range: null });
  });

  it("does not flag tempo as variable when segments are half/double-time readings", () => {
    const t = summarizeTempo(128, [64, 128, 256]);
    expect(t.variable).toBe(false);
    expect(t.segmentBpms).toEqual([128, 128, 128]);
    expect(t.confidence).toBe("high");
  });

  it("flags variable tempo and reports the range", () => {
    const t = summarizeTempo(110, [96, 110, 124]);
    expect(t.variable).toBe(true);
    expect(t.confidence).toBe("low");
    expect(t.range).toEqual({ min: 96, max: 124 });
  });

  it("tolerates small drift (live recordings) without flagging it", () => {
    const t = summarizeTempo(100, [98, 100, 102]);
    expect(t.variable).toBe(false);
  });

  it("offers half-time and double-time alternatives", () => {
    expect(summarizeTempo(140, [])).toMatchObject({ halfTime: 70, doubleTime: null });
    expect(summarizeTempo(85, [])).toMatchObject({ halfTime: 42.5, doubleTime: 170 });
    expect(summarizeTempo(70, [])).toMatchObject({ halfTime: null, doubleTime: 140 });
  });

  it("ignores failed segments and keeps medium confidence with too few segments", () => {
    const t = summarizeTempo(120, [null, 121, null]);
    expect(t).toMatchObject({ variable: false, confidence: "medium", segmentBpms: [121] });
  });

  it("rounds the proposed BPM to one decimal", () => {
    expect(summarizeTempo(127.9666, []).bpm).toBe(128);
    expect(summarizeTempo(92.345, []).bpm).toBe(92.3);
  });

  it("throws on an invalid global BPM", () => {
    expect(() => summarizeTempo(NaN, [])).toThrow();
    expect(() => summarizeTempo(0, [])).toThrow();
  });
});

describe("segmentWindows", () => {
  it("returns no segments for short tracks", () => {
    expect(segmentWindows(30)).toEqual([]);
    expect(segmentWindows(59)).toEqual([]);
  });

  it("spreads three windows inside the track", () => {
    const windows = segmentWindows(200);
    expect(windows).toHaveLength(3);
    for (const [offset, duration] of windows) {
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset + duration).toBeLessThanOrEqual(200);
    }
    expect(windows.map(([o]) => o)).toEqual([30, 90, 150]);
  });
});
