/**
 * Science-backed prosody analysis for public speaking coaching.
 *
 * References:
 * - Pitch ranges: Titze (1994) "Principles of Voice Production"
 * - Speaking rate: Tauroza & Allison (1990), optimal 120-150 WPM for presentations
 * - Pause research: Duez (1982), Goldman-Eisler (1968) on strategic pauses
 * - Filler words: Brennan & Williams (1995) on disfluency perception
 * - Dynamic range: Baken & Orlikoff (2000) "Clinical Measurement of Speech and Voice"
 */

import { ProsodyFrame } from "../hooks/useProsody";

// === PITCH ANALYSIS ===

export interface PitchAnalysis {
  averagePitchHz: number;
  pitchRangeHz: [number, number];
  pitchStdDev: number;
  coefficientOfVariation: number;    // CV = stdDev/mean — gender-normalized measure
  monotonePercent: number;
  upspeakCount: number;             // statements ending with rising pitch
  rating: "monotone" | "low-variety" | "good" | "expressive" | "overly-dramatic";
  advice: string;
}

// Normal pitch ranges (Titze, 1994)
const PITCH_RANGES = {
  male: { low: 85, typical: 120, high: 180 },     // Hz
  female: { low: 165, typical: 210, high: 275 },   // Hz
};

export function analyzePitch(timeline: ProsodyFrame[]): PitchAnalysis {
  const pitches = timeline.filter((f) => f.pitch > 50 && f.pitch < 500).map((f) => f.pitch);
  if (pitches.length < 10) return { averagePitchHz: 0, pitchRangeHz: [0, 0], pitchStdDev: 0, coefficientOfVariation: 0, monotonePercent: 100, upspeakCount: 0, rating: "monotone", advice: "Not enough speech data to analyze pitch." };

  const avg = pitches.reduce((a, b) => a + b, 0) / pitches.length;
  // Use 5th/95th percentile for range (excludes outliers per Baken & Orlikoff 2000)
  const sorted = [...pitches].sort((a, b) => a - b);
  const p5 = sorted[Math.floor(sorted.length * 0.05)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const stdDev = Math.sqrt(pitches.reduce((s, p) => s + (p - avg) ** 2, 0) / pitches.length);

  // Coefficient of Variation — gender-normalized (Rosenberg & Hirschberg 2009)
  // CV < 0.10 = monotone, 0.15-0.30 = good, > 0.50 = erratic
  const cv = avg > 0 ? stdDev / avg : 0;

  // Monotone detection: sliding 3-second windows with <10Hz variation
  let monotoneFrames = 0;
  const windowSize = 30;
  for (let i = 0; i < pitches.length - windowSize; i++) {
    const w = pitches.slice(i, i + windowSize);
    const wAvg = w.reduce((a, b) => a + b, 0) / w.length;
    const wStd = Math.sqrt(w.reduce((s, p) => s + (p - wAvg) ** 2, 0) / w.length);
    if (wStd < 10) monotoneFrames++;
  }
  const monotonePercent = pitches.length > windowSize ? Math.round((monotoneFrames / (pitches.length - windowSize)) * 100) : 0;

  // Upspeak detection — statements ending with rising pitch >15% in final frames
  // (Indicates questioning intonation on declarative statements)
  let upspeakCount = 0;
  // Find silence boundaries (end of phrases)
  for (let i = 20; i < timeline.length - 1; i++) {
    if (timeline[i + 1].isSilent && !timeline[i].isSilent && timeline[i].pitch > 0) {
      const endPitch = timeline[i].pitch;
      const startIdx = Math.max(0, i - 10);
      const startPitch = timeline.slice(startIdx, i).filter((f) => f.pitch > 0).map((f) => f.pitch);
      if (startPitch.length > 3) {
        const phraseAvg = startPitch.reduce((a, b) => a + b, 0) / startPitch.length;
        if (endPitch > phraseAvg * 1.15) upspeakCount++; // >15% rise at end
      }
    }
  }

  // Rating based on CV (more robust than raw Hz, per Rosenberg & Hirschberg 2009)
  let rating: PitchAnalysis["rating"];
  let advice: string;
  if (cv < 0.10) {
    rating = "monotone";
    advice = "Your pitch barely changes (CV: " + (cv * 100).toFixed(0) + "%). Charismatic speakers typically vary pitch by 15-30% of their baseline. Try emphasizing 2-3 key words per sentence by raising your pitch, and dropping it for authoritative statements.";
  } else if (cv < 0.15) {
    rating = "low-variety";
    advice = "Your pitch has some variation (CV: " + (cv * 100).toFixed(0) + "%) but could be more engaging. Research shows speakers rated as 'charismatic' use 15-30% pitch variation. Try rhetorical questions (pitch naturally rises) and strong declarations (pitch drops).";
  } else if (cv < 0.30) {
    rating = "good";
    advice = "Excellent pitch variety (CV: " + (cv * 100).toFixed(0) + "%)! Research shows this range correlates strongly with audience engagement and perceived charisma (Rosenberg & Hirschberg, 2009).";
  } else if (cv < 0.50) {
    rating = "expressive";
    advice = "Very expressive pitch variation (CV: " + (cv * 100).toFixed(0) + "%). Your delivery is dynamic and engaging. Just ensure the variation feels natural and serves your message.";
  } else {
    rating = "overly-dramatic";
    advice = "Your pitch variation is extreme (CV: " + (cv * 100).toFixed(0) + "%). While expressiveness is valuable, wide swings can sound theatrical. Channel the energy into deliberate emphasis on 3-4 key words per paragraph rather than constant variation.";
  }

  if (upspeakCount > 3) {
    advice += ` Also: you ended ${upspeakCount} statements with rising pitch ('upspeak'), which can sound uncertain. Practice ending declarative sentences with a downward pitch to project confidence.`;
  }

  return { averagePitchHz: Math.round(avg), pitchRangeHz: [Math.round(p5), Math.round(p95)], pitchStdDev: Math.round(stdDev), coefficientOfVariation: Math.round(cv * 100) / 100, monotonePercent, upspeakCount, rating, advice };
}

// === VOLUME/LOUDNESS ANALYSIS ===

export interface VolumeAnalysis {
  averageLevel: number;              // 0-100 normalized
  dynamicRange: number;              // difference between loud and quiet
  projectionRating: "too-quiet" | "quiet" | "good" | "loud" | "too-loud";
  dynamicsRating: "flat" | "low" | "good" | "dramatic";
  quietMoments: number;              // count of drops below threshold
  advice: string;
}

export function analyzeVolume(timeline: ProsodyFrame[]): VolumeAnalysis {
  const volumes = timeline.filter((f) => !f.isSilent).map((f) => f.volume);
  if (volumes.length < 10) return { averageLevel: 0, dynamicRange: 0, projectionRating: "too-quiet", dynamicsRating: "flat", quietMoments: 0, advice: "Not enough speech data." };

  const avg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const sorted = [...volumes].sort((a, b) => a - b);
  const p10 = sorted[Math.floor(sorted.length * 0.1)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const dynamicRange = p90 - p10;

  // Count quiet drops (below 20 for 1+ seconds)
  let quietMoments = 0;
  let quietStart: number | null = null;
  timeline.forEach((f) => {
    if (f.volume < 20 && !f.isSilent) {
      if (quietStart === null) quietStart = f.time;
    } else {
      if (quietStart !== null && f.time - quietStart >= 1) quietMoments++;
      quietStart = null;
    }
  });

  let projectionRating: VolumeAnalysis["projectionRating"];
  if (avg < 15) projectionRating = "too-quiet";
  else if (avg < 30) projectionRating = "quiet";
  else if (avg < 70) projectionRating = "good";
  else if (avg < 85) projectionRating = "loud";
  else projectionRating = "too-loud";

  let dynamicsRating: VolumeAnalysis["dynamicsRating"];
  if (dynamicRange < 10) dynamicsRating = "flat";
  else if (dynamicRange < 25) dynamicsRating = "low";
  else if (dynamicRange < 50) dynamicsRating = "good";
  else dynamicsRating = "dramatic";

  const adviceParts: string[] = [];
  if (projectionRating === "too-quiet") adviceParts.push("Your volume is too low. Imagine projecting to the back of the room. Take a deep breath before speaking and use your diaphragm.");
  else if (projectionRating === "quiet") adviceParts.push("You could project more. Try speaking as if addressing someone 20 feet away.");
  else if (projectionRating === "good") adviceParts.push("Good volume level — you're projecting clearly.");
  else if (projectionRating === "too-loud") adviceParts.push("Your volume is quite high. Bring it down slightly for conversational moments, then raise it for emphasis.");

  if (dynamicsRating === "flat") adviceParts.push("Your volume barely changes. Use volume strategically: get quieter to draw the audience in, then louder to drive home key points.");
  else if (dynamicsRating === "good") adviceParts.push("Great dynamic range — you're using volume changes effectively.");

  if (quietMoments > 3) adviceParts.push(`You had ${quietMoments} moments where your volume dropped significantly. This often happens at the end of sentences — try maintaining volume through your final words.`);

  return { averageLevel: Math.round(avg), dynamicRange: Math.round(dynamicRange), projectionRating, dynamicsRating, quietMoments, advice: adviceParts.join(" ") };
}

// === PACE/RATE ANALYSIS ===

export interface PaceAnalysis {
  wpm: number;
  rating: "too-slow" | "slow" | "optimal" | "fast" | "too-fast";
  advice: string;
}

// Optimal ranges (Tauroza & Allison, 1990; presentation coaching consensus)
// Persuasive speech: 120-150 WPM, Informational: 140-170 WPM, Conversational: 150-180 WPM
export function analyzePace(wpm: number, sessionType: string): PaceAnalysis {
  const ranges: Record<string, [number, number]> = {
    "mock-trial": [130, 160],        // Measured, authoritative
    "business-pitch": [140, 170],    // Energetic but clear
    "public-speaking": [120, 150],   // Deliberate, impactful
    "sales-demo": [140, 170],        // Engaging, not rushed
  };
  const [lo, hi] = ranges[sessionType] || [130, 160];

  let rating: PaceAnalysis["rating"];
  let advice: string;
  if (wpm < lo - 30) { rating = "too-slow"; advice = `At ${wpm} WPM, you're speaking quite slowly. While pauses are powerful, sustained slow speech can lose your audience. Try to aim for ${lo}-${hi} WPM for this type of presentation.`; }
  else if (wpm < lo) { rating = "slow"; advice = `At ${wpm} WPM, you're on the slower side. This can convey thoughtfulness, but try picking up slightly during supporting points while staying measured on key statements.`; }
  else if (wpm <= hi) { rating = "optimal"; advice = `At ${wpm} WPM, your pace is right in the sweet spot for this type of presentation. You're giving your audience time to absorb key points without losing momentum.`; }
  else if (wpm <= hi + 30) { rating = "fast"; advice = `At ${wpm} WPM, you're speaking a bit fast. Try inserting 2-second pauses after key statements. A deliberate pause after an important point is one of the most powerful tools in public speaking.`; }
  else { rating = "too-fast"; advice = `At ${wpm} WPM, you're rushing. Your audience can't absorb information at this speed. Practice deliberately pausing after every 2-3 sentences. Slow down especially on numbers, names, and key conclusions.`; }

  return { wpm, rating, advice };
}

// === PAUSE ANALYSIS ===

export interface PauseAnalysis {
  totalPauses: number;
  strategicPauses: number;           // 1-3 seconds (intentional)
  awkwardSilences: number;           // 4+ seconds (too long)
  averagePauseLength: number;        // seconds
  pauseFrequency: number;            // pauses per minute
  rating: "too-few" | "good" | "too-many" | "awkward-silences";
  advice: string;
}

// Goldman-Eisler (1968): skilled speakers pause ~40-50% of total time
// Strategic pauses: 0.5-3 seconds; Awkward: 4+ seconds
export function analyzePauses(timeline: ProsodyFrame[], durationSeconds: number): PauseAnalysis {
  const pauses: { start: number; end: number }[] = [];
  let pauseStart: number | null = null;

  timeline.forEach((f) => {
    if (f.isSilent) {
      if (pauseStart === null) pauseStart = f.time;
    } else {
      if (pauseStart !== null) {
        const length = f.time - pauseStart;
        if (length >= 0.5) pauses.push({ start: pauseStart, end: f.time }); // Only count 0.5s+
      }
      pauseStart = null;
    }
  });

  const strategicPauses = pauses.filter((p) => p.end - p.start >= 1 && p.end - p.start <= 3).length;
  const awkwardSilences = pauses.filter((p) => p.end - p.start >= 4).length;
  const avgLength = pauses.length > 0 ? pauses.reduce((s, p) => s + (p.end - p.start), 0) / pauses.length : 0;
  const perMinute = durationSeconds > 0 ? (pauses.length / durationSeconds) * 60 : 0;

  let rating: PauseAnalysis["rating"];
  let advice: string;
  if (awkwardSilences > 3) {
    rating = "awkward-silences";
    advice = `You had ${awkwardSilences} pauses longer than 4 seconds. These feel uncomfortable to an audience. If you need to collect your thoughts, use a transitional phrase like "Now, let me address..." rather than going silent.`;
  } else if (perMinute < 2) {
    rating = "too-few";
    advice = "You're not pausing enough. Strategic pauses (1-3 seconds) after key points let your audience absorb information. Try the 'comma pause' technique: wherever you'd put a comma in writing, insert a 1-second pause.";
  } else if (perMinute > 8) {
    rating = "too-many";
    advice = "You're pausing very frequently. While pauses are valuable, too many can make your speech feel fragmented. Try connecting your sentences more smoothly and reserving pauses for after the most important statements.";
  } else {
    rating = "good";
    advice = `Good use of pauses! You had ${strategicPauses} well-placed pauses that gave your audience time to process key points. This is a sign of a confident, measured speaker.`;
  }

  return { totalPauses: pauses.length, strategicPauses, awkwardSilences, averagePauseLength: Math.round(avgLength * 10) / 10, pauseFrequency: Math.round(perMinute * 10) / 10, rating, advice };
}

// === FILLER WORD ANALYSIS ===

export interface FillerAnalysis {
  count: number;
  perMinute: number;
  rating: "excellent" | "good" | "moderate" | "high" | "excessive";
  advice: string;
}

// Brennan & Williams (1995): listeners perceive speakers with >3 fillers/min as less credible
export function analyzeFillers(count: number, durationSeconds: number): FillerAnalysis {
  const perMinute = durationSeconds > 0 ? (count / durationSeconds) * 60 : 0;

  let rating: FillerAnalysis["rating"];
  let advice: string;
  if (perMinute < 0.5) { rating = "excellent"; advice = "Almost no filler words — excellent! Your speech sounds polished and confident."; }
  else if (perMinute < 2) { rating = "good"; advice = "Very few filler words. Most listeners won't notice them at this rate. Keep it up!"; }
  else if (perMinute < 4) { rating = "moderate"; advice = `You're averaging ${perMinute.toFixed(1)} fillers per minute. This is noticeable but not distracting. Try replacing "um" with a brief pause — silence sounds more confident than a filler word.`; }
  else if (perMinute < 7) { rating = "high"; advice = `At ${perMinute.toFixed(1)} fillers per minute, your audience is definitely noticing. The #1 technique: practice pausing instead of filling. Record yourself and listen back — awareness is the first step.`; }
  else { rating = "excessive"; advice = `At ${perMinute.toFixed(1)} fillers per minute, filler words are significantly undermining your credibility. Try this exercise: speak very slowly and deliberately, inserting a full 2-second pause wherever you'd normally say "um." With practice, the pauses will replace the fillers.`; }

  return { count, perMinute: Math.round(perMinute * 10) / 10, rating, advice };
}

// === OVERALL COACHING REPORT ===

export interface CoachingReport {
  pitch: PitchAnalysis;
  volume: VolumeAnalysis;
  pace: PaceAnalysis;
  pauses: PauseAnalysis;
  fillers: FillerAnalysis;
  overallScore: number;          // 0-100
  overallRating: string;
  topStrengths: string[];
  topImprovements: string[];
}

export function generateCoachingReport(
  timeline: ProsodyFrame[],
  wpm: number,
  fillerCount: number,
  durationSeconds: number,
  sessionType: string
): CoachingReport {
  const pitch = analyzePitch(timeline);
  const volume = analyzeVolume(timeline);
  const pace = analyzePace(wpm, sessionType);
  const pauses = analyzePauses(timeline, durationSeconds);
  const fillers = analyzeFillers(fillerCount, durationSeconds);

  // Weighted score
  const pitchScore = pitch.rating === "good" ? 90 : pitch.rating === "expressive" ? 95 : pitch.rating === "low-variety" ? 60 : pitch.rating === "monotone" ? 30 : 70;
  const volumeScore = volume.projectionRating === "good" ? 85 : volume.projectionRating === "quiet" ? 55 : volume.projectionRating === "too-quiet" ? 25 : volume.projectionRating === "loud" ? 70 : 50;
  const dynamicsScore = volume.dynamicsRating === "good" ? 90 : volume.dynamicsRating === "dramatic" ? 80 : volume.dynamicsRating === "low" ? 50 : 25;
  const paceScore = pace.rating === "optimal" ? 95 : pace.rating === "slow" || pace.rating === "fast" ? 65 : 35;
  const pauseScore = pauses.rating === "good" ? 90 : pauses.rating === "too-few" ? 50 : pauses.rating === "too-many" ? 50 : 30;
  const fillerScore = fillers.rating === "excellent" ? 100 : fillers.rating === "good" ? 85 : fillers.rating === "moderate" ? 60 : fillers.rating === "high" ? 35 : 15;

  const overallScore = Math.round(
    pitchScore * 0.2 + volumeScore * 0.15 + dynamicsScore * 0.1 + paceScore * 0.2 + pauseScore * 0.15 + fillerScore * 0.2
  );

  const overallRating = overallScore >= 85 ? "Excellent" : overallScore >= 70 ? "Good" : overallScore >= 50 ? "Developing" : "Needs Work";

  // Identify strengths and improvements
  const scores = [
    { name: "Pitch variety", score: pitchScore, analysis: pitch },
    { name: "Volume projection", score: volumeScore, analysis: volume },
    { name: "Dynamic range", score: dynamicsScore, analysis: volume },
    { name: "Speaking pace", score: paceScore, analysis: pace },
    { name: "Pause usage", score: pauseScore, analysis: pauses },
    { name: "Filler word control", score: fillerScore, analysis: fillers },
  ];

  scores.sort((a, b) => b.score - a.score);
  const topStrengths = scores.slice(0, 2).filter((s) => s.score >= 70).map((s) => s.name);
  const topImprovements = scores.slice(-2).filter((s) => s.score < 70).map((s) => s.name);

  return { pitch, volume, pace, pauses, fillers, overallScore, overallRating, topStrengths, topImprovements };
}
