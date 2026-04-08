/**
 * Rhubarb Lip Sync Integration
 *
 * Integrates with Rhubarb Lip Sync (https://github.com/DanielSWolf/rhubarb-lip-sync)
 * to generate viseme/mouth-shape data from audio files.
 *
 * Rhubarb must be installed and available in PATH (like FFmpeg).
 *
 * Viseme shapes (A-X):
 *   A = Closed mouth (M, B, P)
 *   B = Slightly open (most consonants)
 *   C = Open (EH, AE)
 *   D = Wide open (AA)
 *   E = Rounded (AO)
 *   F = Puckered (OO, W)
 *   G = Upper teeth on lower lip (F, V)
 *   H = Tongue visible (L, TH)
 *   X = Idle/rest position
 */

import { invoke } from '@/lib/tauri-api';

// ── Types ──────────────────────────────────────────────────────────────

export type VisemeShape = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'X';

export interface MouthCue {
  start: number;  // seconds
  end: number;    // seconds
  value: VisemeShape;
}

export interface LipSyncResult {
  soundFile: string;
  duration: number;
  mouthCues: MouthCue[];
}

export interface LipSyncOptions {
  /** Path to audio file (WAV preferred, also OGG/MP3) */
  audioPath: string;
  /** Optional dialog text to improve accuracy */
  dialogText?: string;
  /** Recognizer type: phonetic (faster) or dataBased (more accurate) */
  recognizer?: 'phonetic' | 'dataBased';
  /** Output format for file export */
  exportFormat?: 'json' | 'xml' | 'tsv';
}

/** Viseme descriptions for UI display */
export const VISEME_DESCRIPTIONS: Record<VisemeShape, { name: string; description: string; mouthShape: string }> = {
  A: { name: 'Chiusa', description: 'Bocca chiusa (M, B, P)', mouthShape: '—' },
  B: { name: 'Semiaperta', description: 'Leggermente aperta (consonanti)', mouthShape: '⊂' },
  C: { name: 'Aperta', description: 'Aperta (EH, AE)', mouthShape: '○' },
  D: { name: 'Spalancata', description: 'Molto aperta (AA)', mouthShape: '◎' },
  E: { name: 'Arrotondata', description: 'Arrotondata (AO)', mouthShape: '◯' },
  F: { name: 'Arricciata', description: 'Labbra arricciate (OO, W)', mouthShape: '●' },
  G: { name: 'Denti-labbro', description: 'Denti su labbro inferiore (F, V)', mouthShape: '⊏' },
  H: { name: 'Lingua', description: 'Lingua visibile (L, TH)', mouthShape: '⊔' },
  X: { name: 'Riposo', description: 'Posizione neutra/inattiva', mouthShape: '·' },
};

/** Color mapping for viseme visualization */
export const VISEME_COLORS: Record<VisemeShape, string> = {
  A: '#6366f1', // indigo
  B: '#8b5cf6', // violet
  C: '#a855f7', // purple
  D: '#d946ef', // fuchsia
  E: '#ec4899', // pink
  F: '#f43f5e', // rose
  G: '#f97316', // orange
  H: '#eab308', // yellow
  X: '#6b7280', // gray
};

// ── Rhubarb CLI Integration ────────────────────────────────────────────

/**
 * Check if Rhubarb is available in the system PATH.
 */
export async function checkRhubarbAvailable(): Promise<boolean> {
  try {
    const available = await invoke<boolean>('check_rhubarb_available');
    return available;
  } catch {
    return false;
  }
}

/**
 * Generate lip sync data from an audio file using Rhubarb.
 * Requires Rhubarb to be installed and in PATH.
 */
export async function generateLipSync(options: LipSyncOptions): Promise<LipSyncResult> {
  const { audioPath, dialogText, recognizer = 'phonetic' } = options;

  try {
    const result = await invoke<LipSyncResult>('generate_lip_sync', {
      audioPath,
      dialogText: dialogText || null,
      recognizer,
    });
    return result;
  } catch (e) {
    throw new Error(`Errore generazione lip sync: ${e}`);
  }
}

/**
 * Export lip sync data to a specific format file.
 */
export async function exportLipSync(
  result: LipSyncResult,
  outputPath: string,
  format: 'json' | 'xml' | 'tsv' = 'json'
): Promise<string> {
  if (format === 'json') {
    const json = JSON.stringify({
      metadata: { soundFile: result.soundFile, duration: result.duration },
      mouthCues: result.mouthCues,
    }, null, 2);
    await invoke('write_text_file', { path: outputPath, content: json });
    return outputPath;
  }

  if (format === 'tsv') {
    const lines = result.mouthCues.map(c => `${c.start.toFixed(2)}\t${c.end.toFixed(2)}\t${c.value}`);
    const tsv = `start\tend\tviseme\n${lines.join('\n')}`;
    await invoke('write_text_file', { path: outputPath, content: tsv });
    return outputPath;
  }

  if (format === 'xml') {
    const cues = result.mouthCues.map(c =>
      `  <cue start="${c.start.toFixed(2)}" end="${c.end.toFixed(2)}" value="${c.value}" />`
    ).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<lipSync soundFile="${result.soundFile}" duration="${result.duration.toFixed(2)}">
${cues}
</lipSync>`;
    await invoke('write_text_file', { path: outputPath, content: xml });
    return outputPath;
  }

  throw new Error(`Formato non supportato: ${format}`);
}

// ── Unity / Unreal Compatibility ───────────────────────────────────────

/** Unity blend shape mapping (standard naming) */
export interface UnityVisemeMapping {
  visemeShape: VisemeShape;
  blendShapeName: string;
  blendShapeIndex: number;
}

/** Standard Unity Oculus LipSync viseme mapping */
export const UNITY_VISEME_MAP: UnityVisemeMapping[] = [
  { visemeShape: 'X', blendShapeName: 'viseme_sil', blendShapeIndex: 0 },
  { visemeShape: 'C', blendShapeName: 'viseme_aa', blendShapeIndex: 1 },
  { visemeShape: 'E', blendShapeName: 'viseme_ao', blendShapeIndex: 2 },
  { visemeShape: 'B', blendShapeName: 'viseme_ch', blendShapeIndex: 3 },
  { visemeShape: 'D', blendShapeName: 'viseme_dd', blendShapeIndex: 4 },
  { visemeShape: 'C', blendShapeName: 'viseme_eh', blendShapeIndex: 5 },
  { visemeShape: 'G', blendShapeName: 'viseme_ff', blendShapeIndex: 6 },
  { visemeShape: 'A', blendShapeName: 'viseme_pp', blendShapeIndex: 7 },
  { visemeShape: 'F', blendShapeName: 'viseme_ou', blendShapeIndex: 8 },
  { visemeShape: 'H', blendShapeName: 'viseme_th', blendShapeIndex: 9 },
];

/**
 * Convert Rhubarb lip sync result to Unity AnimationClip-compatible JSON.
 * This generates keyframe data that can be imported into Unity's animation system.
 */
export function convertToUnityAnimation(result: LipSyncResult, fps: number = 30): object {
  const keyframes: Array<{ time: number; viseme: string; weight: number }> = [];

  for (const cue of result.mouthCues) {
    const mapping = UNITY_VISEME_MAP.find(m => m.visemeShape === cue.value);
    const blendShape = mapping?.blendShapeName || 'viseme_sil';

    // Add keyframe at start (weight 1) and end (weight 0)
    keyframes.push({ time: cue.start, viseme: blendShape, weight: 1.0 });
    keyframes.push({ time: cue.end, viseme: blendShape, weight: 0.0 });
  }

  return {
    format: 'unity_viseme_keyframes',
    version: '1.0',
    fps,
    duration: result.duration,
    soundFile: result.soundFile,
    keyframes: keyframes.sort((a, b) => a.time - b.time),
    blendShapes: UNITY_VISEME_MAP.map(m => m.blendShapeName),
  };
}

/** Unreal Engine FaceFX / MetaHuman viseme mapping */
export const UNREAL_VISEME_MAP: Record<VisemeShape, string> = {
  A: 'MBP',        // Lips closed
  B: 'CH_J_SH',    // Consonant position
  C: 'EH_AE',      // Open mid
  D: 'AA',         // Open wide
  E: 'AO',         // Rounded
  F: 'OO_UW',      // Puckered
  G: 'F_V',        // Teeth on lip
  H: 'TH_L',       // Tongue
  X: 'SILENCE',    // Rest
};

/**
 * Convert Rhubarb lip sync result to Unreal Engine FaceFX-compatible format.
 */
export function convertToUnrealFaceFX(result: LipSyncResult): object {
  const phonemes = result.mouthCues.map(cue => ({
    time: cue.start,
    duration: cue.end - cue.start,
    phoneme: UNREAL_VISEME_MAP[cue.value] || 'SILENCE',
    viseme: cue.value,
    intensity: cue.value === 'X' ? 0.0 : 1.0,
  }));

  return {
    format: 'unreal_facefx',
    version: '1.0',
    duration: result.duration,
    soundFile: result.soundFile,
    phonemes,
    visemeMapping: UNREAL_VISEME_MAP,
  };
}

// ── Analysis Utilities ─────────────────────────────────────────────────

/**
 * Get statistics about a lip sync result.
 */
export function analyzeLipSync(result: LipSyncResult): {
  totalCues: number;
  duration: number;
  avgCueDuration: number;
  visemeDistribution: Record<VisemeShape, number>;
  silenceRatio: number;
  speechRatio: number;
} {
  const distribution: Record<string, number> = {};
  let silenceDuration = 0;

  for (const cue of result.mouthCues) {
    const dur = cue.end - cue.start;
    distribution[cue.value] = (distribution[cue.value] || 0) + 1;
    if (cue.value === 'X') silenceDuration += dur;
  }

  const totalDuration = result.duration || (result.mouthCues.length > 0
    ? result.mouthCues[result.mouthCues.length - 1].end
    : 0);

  return {
    totalCues: result.mouthCues.length,
    duration: totalDuration,
    avgCueDuration: result.mouthCues.length > 0
      ? totalDuration / result.mouthCues.length
      : 0,
    visemeDistribution: distribution as Record<VisemeShape, number>,
    silenceRatio: totalDuration > 0 ? silenceDuration / totalDuration : 0,
    speechRatio: totalDuration > 0 ? 1 - (silenceDuration / totalDuration) : 0,
  };
}

/**
 * Get the active viseme at a specific time point.
 */
export function getVisemeAtTime(result: LipSyncResult, time: number): MouthCue | null {
  for (const cue of result.mouthCues) {
    if (time >= cue.start && time < cue.end) return cue;
  }
  return null;
}
