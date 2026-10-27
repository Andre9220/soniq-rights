import { describe, expect, it, vi } from "vitest";
import { analyzeAudioFile, AudioAnalysisError, type AnalyzerDeps, type BeatDetector } from "@/lib/audio/analyzer";

const fakeBuffer = (duration: number) => ({ duration }) as AudioBuffer;

function makeDeps(opts: {
  duration?: number;
  decodeError?: boolean;
  guess?: BeatDetector["guess"];
  detectorLoadError?: boolean;
}) {
  const context = {
    state: "running",
    decodeAudioData: vi.fn(async () => {
      if (opts.decodeError) throw new DOMException("Unable to decode", "EncodingError");
      return fakeBuffer(opts.duration ?? 180);
    }),
    close: vi.fn(async function (this: { state: string }) {
      context.state = "closed";
    }),
  };
  const deps: AnalyzerDeps = {
    createAudioContext: vi.fn(() => context),
    loadDetector: vi.fn(async () => {
      if (opts.detectorLoadError) throw new Error("chunk load failed");
      return { guess: opts.guess ?? (async () => ({ bpm: 120, offset: 0 })) };
    }),
  };
  return { deps, context };
}

const audioFile = (name = "01 - Nuit Blanche_master.mp3", type = "audio/mpeg") => new File([new Uint8Array(2048)], name, { type });

describe("analyzeAudioFile", () => {
  it("reads the duration and proposes a BPM and a title", async () => {
    const { deps, context } = makeDeps({ duration: 222.4 });
    const result = await analyzeAudioFile(audioFile(), deps);
    expect(result.durationSeconds).toBe(222.4);
    expect(result.durationLabel).toBe("3:42");
    expect(result.tempo?.bpm).toBe(120);
    expect(result.tempoError).toBeNull();
    expect(result.title).toEqual({ title: "Nuit Blanche", source: "filename" });
    expect(context.close).toHaveBeenCalledOnce();
  });

  it.each([
    [0.5, "0:01"],
    [42, "0:42"],
    [3600 + 61, "1:01:01"],
  ])("formats a %s s track as %s", async (duration, label) => {
    const { deps } = makeDeps({ duration });
    expect((await analyzeAudioFile(audioFile(), deps)).durationLabel).toBe(label);
  });

  it("rejects incompatible files before decoding", async () => {
    const { deps } = makeDeps({});
    await expect(analyzeAudioFile(new File(["x"], "cover.png", { type: "image/png" }), deps)).rejects.toMatchObject({
      code: "unsupported-format",
    });
    expect(deps.createAudioContext).not.toHaveBeenCalled();
  });

  it("reports corrupt files as decode errors and still releases the AudioContext", async () => {
    const { deps, context } = makeDeps({ decodeError: true });
    const error = await analyzeAudioFile(audioFile("broken.wav", "audio/wav"), deps).catch((e) => e);
    expect(error).toBeInstanceOf(AudioAnalysisError);
    expect(error.code).toBe("decode-failed");
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("rejects files that decode to an empty duration", async () => {
    const { deps } = makeDeps({ duration: 0 });
    await expect(analyzeAudioFile(audioFile(), deps)).rejects.toMatchObject({ code: "decode-failed" });
  });

  it("keeps the duration when BPM detection fails", async () => {
    const { deps, context } = makeDeps({
      duration: 200,
      guess: async () => {
        throw new Error("The given channelData does not contain any detectable beats.");
      },
    });
    const result = await analyzeAudioFile(audioFile(), deps);
    expect(result.durationLabel).toBe("3:20");
    expect(result.tempo).toBeNull();
    expect(result.tempoError).toMatch(/manuellement/);
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("keeps the duration when the detector cannot be loaded", async () => {
    const { deps } = makeDeps({ detectorLoadError: true });
    const result = await analyzeAudioFile(audioFile(), deps);
    expect(result.tempo).toBeNull();
    expect(result.tempoError).not.toBeNull();
  });

  it("detects variable tempo across segments", async () => {
    const bySegment: Record<number, number> = { 30: 92, 90: 108, 150: 124 };
    const { deps } = makeDeps({
      duration: 200,
      guess: async (_buffer, ...args) => ({ bpm: typeof args[0] === "number" ? bySegment[args[0]] : 108, offset: 0 }),
    });
    const result = await analyzeAudioFile(audioFile(), deps);
    expect(result.tempo).toMatchObject({ bpm: 108, variable: true, range: { min: 92, max: 124 }, confidence: "low" });
  });

  it("does not report half-time segments as a tempo change", async () => {
    const bySegment: Record<number, number> = { 30: 87, 90: 174, 150: 174 };
    const { deps } = makeDeps({
      duration: 200,
      guess: async (_buffer, ...args) => ({ bpm: typeof args[0] === "number" ? bySegment[args[0]] : 174, offset: 0 }),
    });
    const result = await analyzeAudioFile(audioFile(), deps);
    expect(result.tempo).toMatchObject({ bpm: 174, variable: false, halfTime: 87 });
  });

  it("survives a single failing segment", async () => {
    const { deps } = makeDeps({
      duration: 200,
      guess: async (_buffer, ...args) => {
        if (args[0] === 90) throw new Error("silence");
        return { bpm: 120, offset: 0 };
      },
    });
    const result = await analyzeAudioFile(audioFile(), deps);
    expect(result.tempo?.segmentBpms).toEqual([120, 120]);
  });

  it("stops and releases resources when aborted", async () => {
    const controller = new AbortController();
    const { deps, context } = makeDeps({});
    context.decodeAudioData.mockImplementation(async () => {
      controller.abort();
      return fakeBuffer(180);
    });
    await expect(analyzeAudioFile(audioFile(), deps, { signal: controller.signal })).rejects.toMatchObject({ code: "aborted" });
    expect(deps.loadDetector).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("reports progress stages in order", async () => {
    const { deps } = makeDeps({});
    const stages: string[] = [];
    await analyzeAudioFile(audioFile(), deps, { onStage: (s) => stages.push(s) });
    expect(stages).toEqual(["reading", "decoding", "tempo"]);
  });
});
