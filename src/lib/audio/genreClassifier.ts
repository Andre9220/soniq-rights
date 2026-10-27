import { genreExcerpt, summarizeGenre, type GenreEstimate } from "./genre";

export const GENRE_MODEL_URL = "/models/genre-rosamerica/model.json";
const MODEL_SAMPLE_RATE = 16000;

export interface GenreClassifier {
  classify(buffer: AudioBuffer, signal?: AbortSignal): Promise<GenreEstimate>;
}

/** Downmixes and resamples an excerpt of the buffer to 16 kHz mono, as MusiCNN expects. */
async function toModelInput(buffer: AudioBuffer): Promise<Float32Array> {
  const { offset, duration } = genreExcerpt(buffer.duration);
  const length = Math.max(1, Math.round(duration * MODEL_SAMPLE_RATE));
  const offline = new OfflineAudioContext(1, length, MODEL_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0, offset, duration);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

type EssentiaModule = { calledRun?: boolean; onRuntimeInitialized?: () => void };

function whenReady(module: EssentiaModule): Promise<void> {
  if (module.calledRun) return Promise.resolve();
  return new Promise((resolve) => {
    const previous = module.onRuntimeInitialized;
    module.onRuntimeInitialized = () => {
      previous?.();
      resolve();
    };
  });
}

let modelPromise: Promise<{ predict: (input: unknown, zeroPadding?: boolean) => Promise<number[][]> }> | null = null;

/**
 * Loads Essentia (WASM) and TensorFlow.js lazily, only when a file is analysed.
 * The model is cached for the session; the feature extractor is created and
 * freed for each file.
 */
export const browserGenreClassifier: GenreClassifier = {
  async classify(buffer, signal) {
    const [{ EssentiaWASM }, { EssentiaTFInputExtractor, TensorflowMusiCNN }, tf] = await Promise.all([
      import("essentia.js/dist/essentia-wasm.es.js"),
      import("essentia.js/dist/essentia.js-model.es.js"),
      import("@tensorflow/tfjs"),
    ]);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    modelPromise ??= (async () => {
      const model = new TensorflowMusiCNN(tf, GENRE_MODEL_URL);
      await model.initialize();
      return model;
    })().catch((error) => {
      modelPromise = null; // allow a retry on the next file
      throw error;
    });

    const [model] = await Promise.all([modelPromise, whenReady(EssentiaWASM)]);
    const signalData = await toModelInput(buffer);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const extractor = new EssentiaTFInputExtractor(EssentiaWASM, "musicnn");
    try {
      const features = extractor.computeFrameWise(signalData, 256);
      const predictions = await model.predict(features, true);
      return summarizeGenre(predictions);
    } finally {
      extractor.delete();
    }
  },
};
