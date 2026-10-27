import { describe, expect, it, vi } from "vitest";
import { analyzeAudioFile, type AnalyzerDeps } from "@/lib/audio/analyzer";
import { genreExcerpt, summarizeGenre } from "@/lib/audio/genre";
import { applyDetection, detectedValues, editField, emptyField } from "@/lib/declaration/fields";

//                       cla   dan   hip   jaz   pop   rhy   roc   spe
const ROCK = /*      */ [0.02, 0.05, 0.03, 0.04, 0.15, 0.03, 0.85, 0.01];
const POP_OR_RNB = /**/ [0.02, 0.05, 0.05, 0.03, 0.50, 0.45, 0.10, 0.01];
const SPEECH = /*    */ [0.01, 0.02, 0.10, 0.01, 0.03, 0.02, 0.02, 0.95];

describe("summarizeGenre", () => {
  it("averages patches and ranks the top 3 candidates", () => {
    const g = summarizeGenre([ROCK, ROCK, POP_OR_RNB]);
    expect(g.candidates.map((c) => c.id)).toEqual(["roc", "pop", "rhy"]);
    expect(g.candidates[0].label).toBe("Rock");
    expect(g.confident).toBe(true);
    expect(g.speech).toBe(false);
  });

  it("is not confident when two genres are close", () => {
    const g = summarizeGenre([POP_OR_RNB]);
    expect(g.candidates.slice(0, 2).map((c) => c.id)).toEqual(["pop", "rhy"]);
    expect(g.confident).toBe(false);
  });

  it("flags spoken content and never proposes 'speech' as a genre", () => {
    const g = summarizeGenre([SPEECH]);
    expect(g.speech).toBe(true);
    expect(g.confident).toBe(false);
    expect(g.candidates.some((c) => c.id === "spe")).toBe(false);
  });

  it("ignores malformed rows and rejects empty output", () => {
    expect(summarizeGenre([[1, 2], ROCK]).candidates[0].id).toBe("roc");
    expect(() => summarizeGenre([])).toThrow();
    expect(() => summarizeGenre([[0, 0, 0, 0, 0, 0, 0, 0]])).toThrow();
  });
});

describe("genreExcerpt", () => {
  it("uses the whole track when it is short", () => {
    expect(genreExcerpt(20)).toEqual({ offset: 0, duration: 20 });
  });
  it("centres a 30 s excerpt in long tracks", () => {
    expect(genreExcerpt(210)).toEqual({ offset: 90, duration: 30 });
  });
});

describe("genre prefilling", () => {
  const analysis = (genre: ReturnType<typeof summarizeGenre> | null) => ({
    durationSeconds: 200,
    durationLabel: "3:20",
    peaks: [],
    tempo: null,
    tempoError: null,
    genre,
    genreError: null,
    title: null,
  });
  const fields = () => ({ title: emptyField(), duration: emptyField(), bpm: emptyField(), genre: emptyField() });

  it("prefills the genre only when the model is confident", () => {
    expect(applyDetection(fields(), detectedValues(analysis(summarizeGenre([ROCK])))).fields.genre).toEqual({
      value: "Rock",
      source: "auto",
    });
    expect(applyDetection(fields(), detectedValues(analysis(summarizeGenre([POP_OR_RNB])))).fields.genre).toEqual(emptyField());
  });

  it("never overwrites a genre typed by the user", () => {
    const result = applyDetection({ ...fields(), genre: editField("Chanson française") }, detectedValues(analysis(summarizeGenre([ROCK]))));
    expect(result.fields.genre.value).toBe("Chanson française");
    expect(result.suggestions.genre).toBe("Rock");
  });
});

describe("analyzer with genre classifier", () => {
  const deps = (classify: () => Promise<ReturnType<typeof summarizeGenre>>): AnalyzerDeps => ({
    createAudioContext: () => ({ state: "running", decodeAudioData: async () => ({ duration: 30 }) as AudioBuffer, close: async () => {} }),
    loadDetector: async () => ({ guess: async () => ({ bpm: 120, offset: 0 }) }),
    genreClassifier: { classify: vi.fn(classify) },
  });
  const file = () => new File([new Uint8Array(64)], "a.mp3", { type: "audio/mpeg" });

  it("returns the genre estimate", async () => {
    const result = await analyzeAudioFile(file(), deps(async () => summarizeGenre([ROCK])));
    expect(result.genre?.candidates[0].id).toBe("roc");
    expect(result.genreError).toBeNull();
  });

  it("keeps duration and tempo when the model fails to load", async () => {
    const result = await analyzeAudioFile(
      file(),
      deps(async () => {
        throw new Error("model.json 404");
      }),
    );
    expect(result.durationLabel).toBe("0:30");
    expect(result.tempo?.bpm).toBe(120);
    expect(result.genre).toBeNull();
    expect(result.genreError).toMatch(/manuellement/);
  });
});

import { computePeaks } from "@/lib/audio/waveform";

describe("computePeaks", () => {
  it("returns normalised peaks per bin", () => {
    const samples = new Float32Array([0.1, -0.2, 0.5, -0.5, 0, 0.25, -0.1, 0.05]);
    expect(computePeaks(samples, 4)).toEqual([0.4, 1, 0.5, 0.2]);
  });
  it("handles silence and empty input", () => {
    expect(computePeaks(new Float32Array(8), 4)).toEqual([0, 0, 0, 0]);
    expect(computePeaks(new Float32Array(0), 4)).toEqual([]);
  });
});
