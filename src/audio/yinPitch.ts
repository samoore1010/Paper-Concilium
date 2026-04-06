/**
 * YIN pitch detection algorithm.
 *
 * Based on: de Cheveigné, A., & Kawahara, H. (2002).
 * "YIN, a fundamental frequency estimator for speech and music."
 * Journal of the Acoustical Society of America, 111(4), 1917-1930.
 *
 * The YIN algorithm is the gold standard for monophonic pitch estimation.
 * It uses the cumulative mean normalized difference function (CMNDF) with
 * parabolic interpolation for sub-sample accuracy.
 */

/**
 * Estimate fundamental frequency (F0) from a Float32Array audio buffer.
 *
 * @param buffer - Float32Array of audio samples (mono, -1 to 1)
 * @param sampleRate - Sample rate in Hz (e.g. 44100, 48000)
 * @param threshold - Aperiodicity threshold (0.0–1.0). Lower = stricter.
 *                    Default 0.15 works well for speech. Use 0.10 for cleaner signals.
 * @returns Estimated pitch in Hz, or 0 if no pitch detected (unvoiced/silence)
 */
export function yinPitchDetect(
  buffer: Float32Array,
  sampleRate: number,
  threshold: number = 0.15
): number {
  const halfLen = Math.floor(buffer.length / 2);

  // Minimum detectable F0: ~50 Hz for bass voices
  // Maximum detectable F0: ~500 Hz (covers all human speech)
  const tauMin = Math.floor(sampleRate / 500); // highest pitch period
  const tauMax = Math.min(halfLen, Math.floor(sampleRate / 50)); // lowest pitch period

  if (tauMax <= tauMin || halfLen < tauMax) return 0;

  // Step 1: Difference function d(tau)
  // d(tau) = sum_{j=0}^{W-1} (x_j - x_{j+tau})^2
  const diff = new Float32Array(tauMax);
  for (let tau = 1; tau < tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < halfLen; j++) {
      const delta = buffer[j] - buffer[j + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // Step 2: Cumulative mean normalized difference function (CMNDF)
  // d'(tau) = d(tau) / ((1/tau) * sum_{j=1}^{tau} d(j))    for tau > 0
  // d'(0) = 1
  const cmndf = new Float32Array(tauMax);
  cmndf[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < tauMax; tau++) {
    runningSum += diff[tau];
    cmndf[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
  }

  // Step 3: Absolute threshold
  // Find the first tau where CMNDF dips below threshold, then find the local minimum
  let bestTau = -1;
  for (let tau = tauMin; tau < tauMax - 1; tau++) {
    if (cmndf[tau] < threshold) {
      // Walk to the local minimum in this dip
      while (tau + 1 < tauMax - 1 && cmndf[tau + 1] < cmndf[tau]) {
        tau++;
      }
      bestTau = tau;
      break;
    }
  }

  // No pitch found below threshold — unvoiced or silence
  if (bestTau < 1) return 0;

  // Step 4: Parabolic interpolation for sub-sample accuracy
  // Fit a parabola through (bestTau-1, bestTau, bestTau+1) and find the true minimum
  if (bestTau > 0 && bestTau < tauMax - 1) {
    const s0 = cmndf[bestTau - 1];
    const s1 = cmndf[bestTau];
    const s2 = cmndf[bestTau + 1];
    const adjustment = (s0 - s2) / (2 * (s0 - 2 * s1 + s2));
    if (Math.abs(adjustment) < 1) {
      return sampleRate / (bestTau + adjustment);
    }
  }

  return sampleRate / bestTau;
}

/**
 * Check if a buffer has enough energy to attempt pitch detection.
 * This avoids running YIN on silence, saving CPU.
 *
 * @param buffer - Float32Array of audio samples
 * @param threshold - RMS threshold (default 0.01, very sensitive)
 * @returns true if the buffer has enough energy for pitch analysis
 */
export function hasVoiceEnergy(buffer: Float32Array, threshold: number = 0.01): boolean {
  let sum = 0;
  // Sample every 4th value for speed
  for (let i = 0; i < buffer.length; i += 4) {
    sum += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sum / (buffer.length / 4));
  return rms > threshold;
}
