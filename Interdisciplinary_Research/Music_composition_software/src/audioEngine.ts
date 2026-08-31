import type { Vector8D, Tile, Phase } from './types';

// Convert 8D vector to Web Audio synthesis parameters
export function vectorToAudioParams(v: Vector8D) {
  // r → tempo/attack: high r = fast attack, short decay
  const attack = 0.001 + (1 - v.r) * 0.1;
  const decay = 0.05 + (1 - v.r) * 0.3;
  
  // p → predictability: high p = stable sustain, low p = noisy
  const sustain = 0.3 + v.p * 0.5;
  const release = 0.1 + v.p * 0.4;
  
  // s → brightness: high s = brighter (higher filter cutoff)
  const filterFreq = 200 + v.s * 6000;
  
  // gamma → spatial expansion: high gamma = more reverb
  const reverbAmount = v.gamma * 0.8;
  
  // d → dissonance: high d = more detune + noise
  const detune = v.d * 100;
  const noiseAmount = v.d * 0.5;
  
  // h → harmonic complexity: high h = richer waveform
  const waveform: OscillatorType = v.h > 0.66 ? 'sawtooth' : v.h > 0.33 ? 'triangle' : 'sine';
  
  // g → binding density: high g = tighter, more focused
  // nu → self-similarity: high nu = longer duration, recursive feel
  const baseFreq = 110 + v.g * 220 + v.nu * 110;
  const duration = 0.5 + v.nu * 3.5 + v.g * 1;

  return {
    waveform,
    baseFreq,
    duration,
    adsr: { attack, decay, sustain, release },
    filterFreq,
    reverbAmount,
    detune,
    noiseAmount,
  };
}

// Determine genre label from dominant dimensions
export function vectorToGenre(v: Vector8D): string {
  const entries = Object.entries(v) as [keyof Vector8D, number][];
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const top = sorted[0][0];
  const second = sorted[1][0];
  
  const genreMap: Record<string, string> = {
    r: 'HIPHOP/GLUON',
    h: 'Neo-classical',
    d: 'DRONE/Noise',
    p: 'INDIE FOLK',
    s: 'Hyperpop/Witch House',
    gamma: 'CINEMATIC',
    g: 'PIANO/Ambient',
    nu: 'Fractal/DRONE',
  };
  
  if (top === 'r' && second === 's') return 'Hyperpop/Deconstructed';
  if (top === 'h' && second === 'gamma') return 'Cinematic/Orchestral';
  if (top === 'd' && second === 'gamma') return 'Noise/Post-rock';
  if (top === 'p' && second === 'nu') return 'Fractal/PIANO';
  if (top === 'd' && second === 'nu') return 'Dark Ambient/Free Jazz';
  if (top === 'h' && second === 'nu') return 'Dream Pop/Ambient';
  
  return genreMap[top] || 'Ambient';
}

// Get color from dominant dimension
export function vectorToColor(v: Vector8D): string {
  const entries = Object.entries(v) as [keyof Vector8D, number][];
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const top = sorted[0][0];
  const colorMap: Record<string, string> = {
    r: '#ef4444', h: '#f59e0b', d: '#6366f1', p: '#8b5cf6',
    s: '#ec4899', gamma: '#06b6d4', g: '#10b981', nu: '#f97316',
  };
  return colorMap[top] || '#6366f1';
}

let tileIdCounter = 0;
export function createTileFromVector(v: Vector8D, phase: Phase, name?: string): Tile {
  const params = vectorToAudioParams(v);
  const genre = vectorToGenre(v);
  const color = vectorToColor(v);
  
  return {
    id: `tile-${tileIdCounter++}`,
    name: name || `${genre} ${tileIdCounter}`,
    vector: { ...v },
    phase,
    ...params,
    genreLabel: genre,
    color,
  };
}

// Generate a base vector for a given circadian phase
export function phaseToBaseVector(phase: Phase): Vector8D {
  const base: Record<Phase, Vector8D> = {
    AB_spark:      { r: 0.9, h: 0.4, d: 0.2, p: 0.8, s: 0.7, gamma: 0.3, g: 0.5, nu: 0.3 },
    A_accumulate:  { r: 0.5, h: 0.7, d: 0.3, p: 0.6, s: 0.5, gamma: 0.4, g: 0.6, nu: 0.4 },
    O_store:       { r: 0.4, h: 0.5, d: 0.3, p: 0.7, s: 0.6, gamma: 0.5, g: 0.7, nu: 0.5 },
    B_compress:    { r: 0.3, h: 0.3, d: 0.8, p: 0.3, s: 0.4, gamma: 0.6, g: 0.4, nu: 0.6 },
    AB_integrate:  { r: 0.4, h: 0.5, d: 0.4, p: 0.5, s: 0.4, gamma: 0.4, g: 0.5, nu: 0.8 },
  };
  return base[phase];
}

// Generate tile variations by perturbing the base vector
export function generateTileSuggestions(baseVector: Vector8D, phase: Phase, count: number = 6): Tile[] {
  const tiles: Tile[] = [];
  const dims: (keyof Vector8D)[] = ['r', 'h', 'd', 'p', 's', 'gamma', 'g', 'nu'];
  
  for (let i = 0; i < count; i++) {
    const v: Vector8D = { ...baseVector };
    // Each suggestion emphasizes a different dimension
    const emphasisDim = dims[i % dims.length];
    v[emphasisDim] = Math.min(1, v[emphasisDim] + 0.25);
    // Slightly randomize others
    dims.forEach(d => {
      if (d !== emphasisDim) {
        v[d] = Math.max(0, Math.min(1, v[d] + (Math.random() - 0.5) * 0.15));
      }
    });
    tiles.push(createTileFromVector(v, phase));
  }
  return tiles;
}

// Calculate similarity between two vectors (for recommendation scoring)
export function vectorSimilarity(a: Vector8D, b: Vector8D): number {
  const dims: (keyof Vector8D)[] = ['r', 'h', 'd', 'p', 's', 'gamma', 'g', 'nu'];
  let dot = 0, magA = 0, magB = 0;
  dims.forEach(d => {
    dot += a[d] * b[d];
    magA += a[d] * a[d];
    magB += b[d] * b[d];
  });
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
