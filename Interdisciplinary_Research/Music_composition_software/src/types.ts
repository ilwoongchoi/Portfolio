// 8D vector: the core psychological/perceptual state
export interface Vector8D {
  r: number; // rhythm/attack/tempo (0-1)
  h: number; // harmonic overtone complexity (0-1)
  d: number; // dissonance/darkness (0-1)
  p: number; // predictability/pattern repeat (0-1)
  s: number; // brightness/mass (0-1)
  gamma: number; // spatial expansion/reverb (0-1)
  g: number; // binding density/seal (0-1)
  nu: number; // self-similarity/fractal (0-1)
}

// Toroidal phase: 5 stages of circadian cycle
export type Phase = 'AB_spark' | 'A_accumulate' | 'O_store' | 'B_compress' | 'AB_integrate';

export const PHASES: { id: Phase; name: string; timeRange: string; sphere: string; color: string }[] = [
  { id: 'AB_spark',       name: 'AB Spark',       timeRange: '0-3h',   sphere: 'Sun→Earth',     color: '#ef4444' },
  { id: 'A_accumulate',   name: 'A Accumulate',   timeRange: '3-9h',   sphere: 'Earth→Moon',    color: '#f59e0b' },
  { id: 'O_store',        name: 'O Store',        timeRange: '9-15h',  sphere: 'Moon→CoMag',    color: '#10b981' },
  { id: 'B_compress',     name: 'B Compress',     timeRange: '15-21h', sphere: 'CoMag→Barnard', color: '#6366f1' },
  { id: 'AB_integrate',   name: 'AB Integrate',   timeRange: '21-3h',  sphere: 'Barnard→Sun',   color: '#8b5cf6' },
];

// Tile: a musical unit that can be slotted into a composition bar
export interface Tile {
  id: string;
  name: string;
  vector: Vector8D;
  phase: Phase;
  // Audio synthesis params derived from vector
  waveform: OscillatorType;
  baseFreq: number;       // Hz
  duration: number;       // seconds
  adsr: { attack: number; decay: number; sustain: number; release: number };
  filterFreq: number;     // Hz
  reverbAmount: number;   // 0-1
  detune: number;         // cents
  noiseAmount: number;    // 0-1
  genreLabel: string;
  color: string;
}

// Composition slot: a position in one of the 5 bars
export interface Slot {
  id: string;
  barIndex: number;       // 0-4 (5 bars = 5 phases)
  slotIndex: number;      // position within bar
  tile: Tile | null;
}

// Profile: MBTI × Blood × Gender = 128 types
export interface Profile {
  mbti: string;
  blood: 'O' | 'A' | 'B' | 'AB';
  gender: 'M' | 'F';
  layer: 'A' | 'B' | 'C' | 'D';
  baseVector: Vector8D;
}

// 8D dimension metadata
export interface DimensionInfo {
  key: keyof Vector8D;
  label: string;
  color: string;
  receptor: string;
  musicParam: string;
  genreForward: string;
  genreReverse: string;
}

export const DIMENSIONS: DimensionInfo[] = [
  { key: 'r',     label: 'r',     color: '#ef4444', receptor: 'GABA-A (F)',         musicParam: 'Rhythm/Attack/Tempo',     genreForward: 'HIPHOP, GLUON, drum machine',     genreReverse: 'free jazz, fragmentation' },
  { key: 'h',     label: 'h',     color: '#f59e0b', receptor: 'GABA-B1/B2 (F)',     musicParam: 'Harmonic overtone',       genreForward: 'Boards of Canada, neo-classical', genreReverse: 'ambient, minimalistic' },
  { key: 'd',     label: 'd',     color: '#6366f1', receptor: 'GABA-B (M)',         musicParam: 'Dissonance/Darkness',     genreForward: 'DRONE, dark ambient',             genreReverse: 'noise, power electronics' },
  { key: 'p',     label: 'p',     color: '#8b5cf6', receptor: 'DRD2 tonic',         musicParam: 'Predictability/Pattern',  genreForward: 'INDIE FOLK, BRITPOP',              genreReverse: 'free jazz, avant-garde' },
  { key: 's',     label: 's',     color: '#ec4899', receptor: 'D1/D5 complex',      musicParam: 'Brightness/Mass',         genreForward: 'hyperpop, witch house',            genreReverse: 'dark ambient, electronic exp.' },
  { key: 'gamma', label: 'γ',     color: '#06b6d4', receptor: 'DRD2 (Right D2)',    musicParam: 'Spatial expansion/Reverb',genreForward: 'HANS ZIMMER, CINEMATIC',           genreReverse: 'post-rock, orchestral' },
  { key: 'g',     label: 'g',     color: '#10b981', receptor: 'Cortisol/Clay gouge',musicParam: 'Binding density/Seal',    genreForward: 'PIANO, ambient, clarity',          genreReverse: 'DRONE, transparency' },
  { key: 'nu',    label: 'ν',     color: '#f97316', receptor: 'Lower mantle/Basin', musicParam: 'Self-similarity/Fractal', genreForward: 'PIANO, DRONE, fractal',            genreReverse: 'free jazz fragmentation' },
];
