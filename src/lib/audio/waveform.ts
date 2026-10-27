/**
 * Reduces a channel to `bins` peak values in 0–1 for drawing a waveform.
 * Values are normalised to the loudest bin so quiet masters still read well.
 */
export function computePeaks(samples: Float32Array, bins = 96): number[] {
  if (samples.length === 0 || bins <= 0) return [];
  const size = Math.max(1, Math.floor(samples.length / bins));
  const peaks: number[] = [];
  for (let b = 0; b < bins; b++) {
    const start = b * size;
    if (start >= samples.length) break;
    const end = Math.min(samples.length, start + size);
    // Stride through long bins: a few thousand reads per bin are plenty.
    const step = Math.max(1, Math.floor((end - start) / 2048));
    let max = 0;
    for (let i = start; i < end; i += step) {
      const v = Math.abs(samples[i]);
      if (v > max) max = v;
    }
    peaks.push(max);
  }
  const loudest = Math.max(...peaks);
  return loudest > 0 ? peaks.map((p) => Math.round((p / loudest) * 1000) / 1000) : peaks;
}
