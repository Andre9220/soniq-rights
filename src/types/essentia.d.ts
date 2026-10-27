declare module "essentia.js/dist/essentia-wasm.es.js" {
  export const EssentiaWASM: { calledRun?: boolean; onRuntimeInitialized?: () => void };
}

declare module "essentia.js/dist/essentia.js-model.es.js" {
  export class EssentiaTFInputExtractor {
    constructor(EssentiaWASM: unknown, extractorType?: "musicnn" | "vggish" | "tempocnn", isDebug?: boolean);
    computeFrameWise(audioSignal: Float32Array, hopSize?: number): unknown;
    delete(): void;
    shutdown(): void;
  }
  export class TensorflowMusiCNN {
    constructor(tfjs: unknown, modelUrl: string, verbose?: boolean);
    initialize(): Promise<void>;
    predict(inputFeature: unknown, zeroPadding?: boolean): Promise<number[][]>;
    dispose(): void;
  }
}
