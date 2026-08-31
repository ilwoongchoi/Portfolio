// ─────────────────────────────────────────────────────────────
// circuit_composer.js — Deterministic music composition engine
// Grounded in: docs/circuit-music-mapping.md (Parts 1-21)
//
// All musical decisions are derived from an 8D vector and a
// deterministic seed. No Math.random(), no genre tables.
// ─────────────────────────────────────────────────────────────

// ── 0. UTILITIES ─────────────────────────────────────────────
const clamp01 = v => Math.max(0, Math.min(1, v));
const clamp11 = v => Math.max(-1, Math.min(1, v));

function hash01(seed, index) {
  const s = (seed + index * 374761393) % 2147483647;
  const x = Math.sin(s * 12.9898 + index * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function stableSeed(input) {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    let hash = 0;
    for (const ch of input) hash = (hash * 131 + ch.charCodeAt(0)) % 2147483647;
    return hash;
  }
  return 0;
}

function smoothstep(x, edge0, edge1) {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// ── 1. MUSICAL CONSTANTS ─────────────────────────────────────
const KEYS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const SEMITONES_PER_KEY = { C:0, 'C#':1, D:2, 'D#':3, E:4, F:5, 'F#':6, G:7, 'G#':8, A:9, 'A#':10, B:11 };
const SCALES = {
  major: [0,2,4,5,7,9,11],
  minor: [0,2,3,5,7,8,10],
  'harmonic minor': [0,2,3,5,7,8,11],
  'melodic minor': [0,2,3,5,7,9,11],
  dorian: [0,2,3,5,7,9,10],
  phrygian: [0,1,3,5,7,8,10],
  lydian: [0,2,4,6,7,9,11],
  mixolydian: [0,2,4,5,7,9,10],
  locrian: [0,1,3,5,6,8,10],
  pentatonic: [0,2,4,7,9],
  'minor pentatonic': [0,3,5,7,10],
  blues: [0,3,5,6,7,10],
  'whole tone': [0,2,4,6,8,10],
  diminished: [0,2,3,5,6,8,9,11],
  augmented: [0,3,4,7,8,11]
};

// ── 2. 8D VECTOR CATALOG (from circuit-music-mapping.md) ─────
const VECTORS = {
  // Scales (Part 1)
  major:        { r:0.55, h:0.65, d:0.22, p:0.70, s:0.50, gamma:0.42, g:0.62, nu:0.38 },
  minor:          { r:0.42, h:0.45, d:0.48, p:0.55, s:0.45, gamma:0.30, g:0.42, nu:0.32 },
  'harmonic minor': { r:0.45, h:0.50, d:0.55, p:0.60, s:0.48, gamma:0.28, g:0.45, nu:0.38 },
  'melodic minor': { r:0.48, h:0.58, d:0.40, p:0.62, s:0.52, gamma:0.35, g:0.50, nu:0.42 },
  dorian:         { r:0.45, h:0.55, d:0.35, p:0.58, s:0.50, gamma:0.40, g:0.50, nu:0.40 },
  phrygian:       { r:0.42, h:0.42, d:0.60, p:0.50, s:0.55, gamma:0.28, g:0.38, nu:0.45 },
  lydian:         { r:0.50, h:0.72, d:0.28, p:0.45, s:0.58, gamma:0.65, g:0.55, nu:0.48 },
  mixolydian:     { r:0.55, h:0.60, d:0.35, p:0.58, s:0.55, gamma:0.50, g:0.50, nu:0.42 },
  locrian:        { r:0.35, h:0.32, d:0.68, p:0.40, s:0.52, gamma:0.25, g:0.30, nu:0.55 },
  pentatonic:     { r:0.48, h:0.55, d:0.30, p:0.62, s:0.52, gamma:0.45, g:0.48, nu:0.42 },
  'minor pentatonic': { r:0.45, h:0.48, d:0.42, p:0.60, s:0.50, gamma:0.35, g:0.42, nu:0.40 },
  blues:          { r:0.55, h:0.50, d:0.45, p:0.55, s:0.55, gamma:0.38, g:0.42, nu:0.45 },
  'whole tone':   { r:0.38, h:0.65, d:0.35, p:0.25, s:0.60, gamma:0.68, g:0.42, nu:0.60 },
  diminished:     { r:0.35, h:0.42, d:0.62, p:0.32, s:0.55, gamma:0.30, g:0.35, nu:0.58 },
  augmented:      { r:0.35, h:0.55, d:0.35, p:0.25, s:0.52, gamma:0.80, g:0.38, nu:0.52 },
  // Chords (Part 2)
  'major triad':  { r:0.55, h:0.65, d:0.22, p:0.70, s:0.50, gamma:0.42, g:0.62, nu:0.38 },
  'minor triad':  { r:0.42, h:0.48, d:0.45, p:0.55, s:0.45, gamma:0.32, g:0.42, nu:0.32 },
  'dominant 7th': { r:0.50, h:0.52, d:0.40, p:0.55, s:0.52, gamma:0.48, g:0.45, nu:0.40 },
  'major 7th':    { r:0.55, h:0.70, d:0.33, p:0.30, s:0.58, gamma:0.65, g:0.70, nu:0.50 },
  'minor 7th':    { r:0.45, h:0.48, d:0.42, p:0.55, s:0.48, gamma:0.38, g:0.45, nu:0.38 },
  'diminished 7th': { r:0.28, h:0.25, d:0.70, p:0.22, s:0.55, gamma:0.18, g:0.22, nu:0.62 },
  sus2:           { r:0.48, h:0.52, d:0.32, p:0.48, s:0.55, gamma:0.45, g:0.42, nu:0.35 },
  sus4:           { r:0.46, h:0.55, d:0.32, p:0.45, s:0.58, gamma:0.42, g:0.45, nu:0.38 },
  'augmented triad': { r:0.35, h:0.55, d:0.35, p:0.25, s:0.52, gamma:0.80, g:0.38, nu:0.52 },
  add9:           { r:0.46, h:0.65, d:0.38, p:0.32, s:0.60, gamma:0.70, g:0.60, nu:0.48 },
  '6th':          { r:0.50, h:0.58, d:0.30, p:0.55, s:0.52, gamma:0.48, g:0.55, nu:0.40 },
  '6/9':          { r:0.48, h:0.62, d:0.30, p:0.40, s:0.55, gamma:0.62, g:0.58, nu:0.45 },
  'half-diminished': { r:0.32, h:0.32, d:0.62, p:0.35, s:0.52, gamma:0.22, g:0.28, nu:0.45 },
  'minor-major 7th': { r:0.40, h:0.52, d:0.48, p:0.42, s:0.52, gamma:0.52, g:0.48, nu:0.42 },
  'dominant 7th b5': { r:0.38, h:0.42, d:0.55, p:0.42, s:0.50, gamma:0.40, g:0.35, nu:0.45 },
  'power chord':  { r:0.60, h:0.35, d:0.20, p:0.75, s:0.55, gamma:0.30, g:0.60, nu:0.30 },
  // Cadences (Part 4)
  authentic:      { r:0.55, h:0.65, d:0.22, p:0.70, s:0.50, gamma:0.42, g:0.62, nu:0.38 },
  plagal:         { r:0.48, h:0.58, d:0.28, p:0.55, s:0.52, gamma:0.45, g:0.55, nu:0.40 },
  deceptive:      { r:0.42, h:0.45, d:0.48, p:0.52, s:0.48, gamma:0.30, g:0.40, nu:0.32 },
  // Sections/Forms (Parts 9-10)
  intro:        { r:0.32, h:0.55, d:0.32, p:0.38, s:0.48, gamma:0.62, g:0.42, nu:0.42 },
  verse:        { r:0.48, h:0.55, d:0.35, p:0.60, s:0.50, gamma:0.42, g:0.50, nu:0.40 },
  prechorus:    { r:0.52, h:0.55, d:0.42, p:0.48, s:0.55, gamma:0.55, g:0.48, nu:0.45 },
  chorus:       { r:0.62, h:0.68, d:0.30, p:0.65, s:0.60, gamma:0.72, g:0.65, nu:0.48 },
  bridge:       { r:0.45, h:0.60, d:0.45, p:0.32, s:0.55, gamma:0.58, g:0.42, nu:0.55 },
  breakdown:    { r:0.28, h:0.48, d:0.32, p:0.35, s:0.42, gamma:0.55, g:0.35, nu:0.38 },
  outro:        { r:0.30, h:0.58, d:0.28, p:0.72, s:0.42, gamma:0.38, g:0.68, nu:0.32 },
  // Roles
  establish:    { r:0.48, h:0.60, d:0.25, p:0.72, s:0.48, gamma:0.40, g:0.60, nu:0.35 },
  expand:       { r:0.52, h:0.62, d:0.32, p:0.58, s:0.52, gamma:0.52, g:0.55, nu:0.42 },
  stress:       { r:0.55, h:0.52, d:0.48, p:0.48, s:0.55, gamma:0.55, g:0.48, nu:0.48 },
  fracture:     { r:0.42, h:0.42, d:0.55, p:0.30, s:0.50, gamma:0.50, g:0.35, nu:0.55 },
  suspend:      { r:0.35, h:0.62, d:0.35, p:0.42, s:0.62, gamma:0.72, g:0.48, nu:0.50 },
  discharge:    { r:0.72, h:0.55, d:0.40, p:0.58, s:0.68, gamma:0.55, g:0.52, nu:0.45 },
  resolve:      { r:0.45, h:0.68, d:0.22, p:0.72, s:0.48, gamma:0.45, g:0.65, nu:0.38 },
};

const ROLE_TRANSITIONS = {
  establish: ['expand', 'stress', 'resolve'],
  expand: ['stress', 'resolve'],
  stress: ['fracture', 'discharge', 'resolve'],
  fracture: ['suspend', 'discharge'],
  suspend: ['resolve'],
  discharge: ['resolve', 'establish'],
  resolve: ['establish']
};

const SECTION_ROLES = {
  intro: ['establish', 'suspend'],
  verse: ['establish', 'expand'],
  prechorus: ['expand', 'stress'],
  chorus: ['resolve', 'establish'],
  bridge: ['fracture', 'suspend', 'resolve'],
  breakdown: ['suspend', 'establish'],
  outro: ['resolve', 'establish']
};

const FORM_TEMPLATES = {
  verse_chorus: ['intro','verse','prechorus','chorus','verse','chorus','bridge','chorus','outro'],
  aaba: ['intro','verse','verse','bridge','verse','outro'],
  binary: ['intro','verse','bridge','verse','outro'],
  ternary: ['intro','verse','bridge','verse','outro'],
  through: ['intro','verse','bridge','verse','bridge','outro'],
  strophic: ['intro','verse','verse','verse','outro'],
  sonata: ['intro','exposition','development','recapitulation','coda'],
  rondo: ['intro','verse','episode','verse','episode','verse','outro'],
  loop: ['intro','build','drop','break','build','drop','outro'],
  twelve_bar_blues: ['intro','i','i','i','i','iv','iv','i','i','v','iv','i','v','outro']
};

// ── 3. MUSICAL STATE DERIVATION ──────────────────────────────
function disulfideBondNAND(vec) {
  const g = clamp01(vec.g ?? 0.5);
  const h = clamp01(vec.h ?? 0.5);
  const nandOut = clamp01(1 - g * h);
  const isBoundary = Math.abs(nandOut - 0.5) < 0.12;
  const isLow = nandOut < 0.5;
  return { nandOut, isBoundary, isLow };
}

function musicalState(vec) {
  const g = clamp01(vec.g ?? 0.5);
  const p = clamp01(vec.p ?? 0.5);
  const d = clamp01(vec.d ?? 0.5);
  const h = clamp01(vec.h ?? 0.5);
  const r = clamp01(vec.r ?? 0.5);
  const s = clamp01(vec.s ?? 0.5);
  const gamma = clamp01(vec.gamma ?? 0.5);
  const nu = clamp01(vec.nu ?? 0.5);
  const nand = disulfideBondNAND(vec);

  const closure = clamp01(g * 0.5 + p * 0.3 + (nand.isLow ? 0.2 : 0));
  const tension = clamp01(d * 0.5 + (1 - p) * 0.3 + h * 0.2);
  const motion = clamp01(r * 0.6 + p * 0.4);
  const brightness = clamp01(s * 0.7 + gamma * 0.3);
  const space = clamp01(gamma * 0.7 + (1 - g) * 0.3);
  const recurrence = clamp01(nu * 0.6 + p * 0.4);
  const density = clamp01(g * 0.7 + r * 0.3);
  const direction = clamp11((h - d) * 0.7 + (nand.isBoundary ? 0 : 0.3 * Math.sign(h - d || 0.001)));
  const cadenceEligibility = clamp01(closure * 0.5 + (1 - tension) * 0.3 + recurrence * 0.2);

  return { closure, tension, motion, brightness, space, recurrence, density, direction, cadenceEligibility };
}

// ── 4. SCALES & CHORDS ───────────────────────────────────────
function scaleByVector(vec) {
  // Find closest scale vector
  let best = 'major', bestDist = Infinity;
  for (const [name, target] of Object.entries(VECTORS)) {
    if (!SCALES[name]) continue;
    const dist = euclidean8D(vec, target);
    if (dist < bestDist) { bestDist = dist; best = name; }
  }
  return { name: best, intervals: SCALES[best] };
}

const CHORD_INTERVALS = {
  'major triad': [0,4,7],
  'minor triad': [0,3,7],
  'augmented triad': [0,4,8],
  'diminished triad': [0,3,6],
  'diminished 7th': [0,3,6,9],
  'dominant 7th': [0,4,7,10],
  'major 7th': [0,4,7,11],
  'minor 7th': [0,3,7,10],
  'half-diminished': [0,3,6,10],
  'minor-major 7th': [0,3,7,11],
  'dominant 7th b5': [0,4,6,10],
  sus2: [0,2,7],
  sus4: [0,5,7],
  add9: [0,4,7,14],
  '6th': [0,4,7,9],
  '6/9': [0,4,7,9,14],
  'power chord': [0,7],
};

function chordNameFromVector(vec) {
  let best = 'major triad', bestDist = Infinity;
  for (const [name, target] of Object.entries(VECTORS)) {
    if (!CHORD_INTERVALS[name]) continue;
    const dist = euclidean8D(vec, target);
    if (dist < bestDist) { bestDist = dist; best = name; }
  }
  return best;
}

function chordNotes(rootMidi, chordName) {
  const intervals = CHORD_INTERVALS[chordName] || CHORD_INTERVALS['major triad'];
  return intervals.map(iv => rootMidi + iv);
}

function getScaleDegreeOffset(scale, degreeIndex) {
  const intervals = scale && Array.isArray(scale.intervals) ? scale.intervals : scale;
  const len = intervals.length;
  const wrapped = ((degreeIndex % len) + len) % len;
  const octave = Math.floor(degreeIndex / len);
  return intervals[wrapped] + octave * 12;
}

function chordFromScaleDegree(scale, scaleRoot, degree, qualityOverride) {
  const diatonicQualities = {
    major: ['major triad','minor triad','minor triad','major triad','major triad','minor triad','diminished triad'],
    minor: ['minor triad','diminished triad','major triad','minor triad','minor triad','major triad','major triad'],
    dorian: ['minor triad','minor triad','major triad','major triad','minor triad','diminished triad','major triad'],
    phrygian: ['minor triad','major triad','major triad','minor triad','diminished triad','major triad','minor triad'],
    lydian: ['major triad','major triad','minor triad','diminished triad','major triad','minor triad','minor triad'],
    mixolydian: ['major triad','minor triad','diminished triad','major triad','minor triad','minor triad','major triad'],
    locrian: ['diminished triad','major triad','minor triad','minor triad','major triad','major triad','minor triad']
  };
  const deg = ((degree % 7) + 7) % 7;
  const root = scaleRoot + getScaleDegreeOffset(scale, deg);
  const quality = qualityOverride || diatonicQualities[scale.name]?.[deg] || 'major triad';
  return { root, notes: chordNotes(root, quality), quality };
}

// ── 5. PROGRESSIONS ──────────────────────────────────────────
const PROGRESSIONS = {
  'I-IV-V-I': [0,3,4,0],
  'I-vi-IV-V': [0,5,3,4],
  'ii-V-I': [1,4,0],
  'vi-IV-I-V': [5,3,0,4],
  'I-V-vi-IV': [0,4,5,3],
  'i-bVII-bVI-V': [0,6,5,4],
  'I-III-vi-IV': [0,2,5,3],
  'circle': [0,3,6,2,5,1,4,0]
};

function progressionFromVector(vec, seed) {
  const state = musicalState(vec);
  const bucket = state.tension < 0.35 ? 'low' : state.tension < 0.65 ? 'mid' : 'high';
  const library = Object.entries(PROGRESSIONS).filter(([k]) => {
    if (bucket === 'low') return ['I-IV-V-I','I-vi-IV-V','I-V-vi-IV'].includes(k);
    if (bucket === 'mid') return ['ii-V-I','vi-IV-I-V','I-III-vi-IV'].includes(k);
    return ['i-bVII-bVI-V','circle'];
  });
  const idx = Math.floor(hash01(seed, 101) * library.length) % library.length;
  return library[idx];
}

// ── 6. RHYTHM ────────────────────────────────────────────────
function euclideanPattern(pulses, steps) {
  if (pulses <= 0) return new Array(steps).fill(false);
  if (pulses >= steps) return new Array(steps).fill(true);
  let groups = Array.from({ length: pulses }, () => [true]);
  let remainder = Array.from({ length: steps - pulses }, () => [false]);
  while (remainder.length > 1) {
    const n = Math.min(groups.length, remainder.length);
    const newGroups = [];
    for (let i = 0; i < n; i++) newGroups.push(groups[i].concat(remainder[i]));
    const leftoverGroups = groups.slice(n);
    const leftoverRemainder = remainder.slice(n);
    groups = newGroups;
    remainder = leftoverGroups.length ? leftoverGroups : leftoverRemainder;
    if (!leftoverGroups.length) break;
  }
  return groups.concat(remainder).flat();
}

function rhythmFromVector(vec, seed) {
  const r = clamp01(vec.r ?? 0.5);
  const p = clamp01(vec.p ?? 0.5);
  const s = clamp01(vec.s ?? 0.5);
  const nu = clamp01(vec.nu ?? 0.5);

  const steps = 16;
  const kickPulses = Math.max(1, Math.round(1 + r * (steps - 1)));
  const kickBase = euclideanPattern(kickPulses, steps);
  const kickChaos = 1 - p;
  const kickSeed = seed + 1;
  const kickPattern = kickBase.map((hit, i) => {
    const flip = hash01(kickSeed, i) < kickChaos * 0.5;
    return flip ? !hit : hit;
  });

  const hihatDensity = 0.3 + s * 0.5;
  const hihatPulses = Math.max(1, Math.round(steps * hihatDensity));
  const hihatBase = euclideanPattern(hihatPulses, steps);
  const hihatPattern = hihatBase.map((hit, i) => {
    const flip = hash01(seed + 2, i) < (1 - nu) * 0.4;
    return flip ? !hit : hit;
  });

  const snarePattern = kickPattern.map((kick, i) => {
    if (kick) return false;
    return hash01(seed + 3, i) < r * 0.3;
  });

  return { steps, kick: kickPattern, snare: snarePattern, hihat: hihatPattern };
}

// ── 7. MELODY & BASS ─────────────────────────────────────────
function melodyFromVector({ vec, scale, scaleRoot, bars, stepsPerBar, seed, progression, role }) {
  const totalSteps = bars * stepsPerBar;
  const sequence = new Array(totalSteps).fill(null);
  const baseOctave = scaleRoot + 12;

  const roleMotifs = {
    establish: [0, null, 2, null, 4, null, 2, null],
    expand: [0, 1, 2, 4, 5, 4, 2, 1],
    stress: [4, 3, 4, 5, 6, 5, 4, 3],
    fracture: [0, 7, null, 4, null, 9, null, 2],
    suspend: [0, null, 3, null, 7, null, 10, null],
    discharge: [7, 6, 5, 4, 3, 2, 1, 0],
    resolve: [4, 2, 0, null, 0, null, 0, null]
  };
  const motif = roleMotifs[role] || roleMotifs.establish;

  for (let bar = 0; bar < bars; bar++) {
    const chordOffset = progression[bar % progression.length];
    for (let step = 0; step < stepsPerBar; step++) {
      const idx = bar * stepsPerBar + step;
      const degree = motif[step % motif.length];
      if (degree == null) continue;
      let note = baseOctave + getScaleDegreeOffset(scale, degree) + chordOffset;
      const r = hash01(seed + bar, idx) - 0.5;
      if (role === 'fracture') note += (r > 0 ? 12 : -12);
      sequence[idx] = note;
    }
  }
  return sequence;
}

function bassFromVector({ vec, scale, scaleRoot, totalSteps, seed, progression }) {
  const r = clamp01(vec.r ?? 0.5);
  const d = clamp01(vec.d ?? 0.5);
  const p = clamp01(vec.p ?? 0.5);
  const bassRoot = scaleRoot - 12;
  const fifth = getScaleDegreeOffset(scale, 4);

  const bassHits = Math.max(1, Math.round(1 + r * (totalSteps - 1)));
  const bassPattern = euclideanPattern(bassHits, totalSteps);
  const moveProb = (1 - p) * 0.6;
  const seq = [];
  let current = bassRoot;

  for (let i = 0; i < totalSteps; i++) {
    if (!bassPattern[i]) { seq.push(null); continue; }
    const bar = Math.floor(i / (totalSteps / progression.length));
    const chordOffset = progression[bar % progression.length];
    const options = [bassRoot + chordOffset, bassRoot + chordOffset + fifth, bassRoot + chordOffset + 12];
    if (d > 0.55) options.push(bassRoot + chordOffset + 3);
    if (d > 0.75) options.push(bassRoot + chordOffset + 6);
    const shouldMove = hash01(seed + 7, i * 3) < moveProb;
    if (shouldMove) {
      const idx = Math.floor(hash01(seed + 8, i * 7) * options.length);
      current = options[Math.min(idx, options.length - 1)];
    } else if (i === 0 || hash01(seed + 9, i) < 0.3) {
      current = options[0];
    }
    seq.push(current);
  }
  return seq;
}

// ── 8. SYNTHESIS PARAMETERS (Part 12.4 / Part 19) ─────────────
function synthesisParams(vec) {
  const r = clamp01(vec.r ?? 0.5);
  const s = clamp01(vec.s ?? 0.5);
  const gamma = clamp01(vec.gamma ?? 0.5);
  const g = clamp01(vec.g ?? 0.5);
  const d = clamp01(vec.d ?? 0.5);
  const p = clamp01(vec.p ?? 0.5);

  return {
    bpm: 52 + Math.round(128 * r),
    meter: (p >= 0.55 && clamp01(vec.nu ?? 0.5) < 0.5) ? '4/4' : (gamma >= 0.55 && p >= 0.35 && p <= 0.55) ? '3/4' : (clamp01(vec.nu ?? 0.5) >= 0.6) ? '5/4' : 'free',
    cutoffHz: 250 + 10500 * s * (0.55 + 0.45 * gamma),
    decaySec: 0.25 + 8 * gamma * (1 - g * 0.45),
    drive: Math.max(0, 0.70 * d + 0.30 * r - 0.35 * g),
    width: 0.10 + 0.85 * gamma * (1 - 0.35 * g),
    padGain: gamma * (1 - r) * 0.8,
    leadGain: 0.35 + 0.45 * s,
    kickDensity: 0.15 + 0.55 * r + (p >= 0.55 ? 0.25 : 0),
    snareGhost: Math.max(0, d - 0.45),
    hatSubdiv: 4 + Math.round(12 * s),
    swingOffset: Math.min(0.18, Math.max(0, (0.55 - p) * 0.35)),
    reverbSend: -24 + 18 * gamma
  };
}

// ── 9. COMPOSITION PLAN BUILDER ──────────────────────────────
function euclidean8D(a, b) {
  let sum = 0;
  for (const k of ['r','h','d','p','s','gamma','g','nu']) {
    const da = (a[k] ?? 0.5) - (b[k] ?? 0.5);
    sum += da * da;
  }
  return Math.sqrt(sum);
}

function lerpVec(a, b, t) {
  const out = {};
  for (const k of ['r','h','d','p','s','gamma','g','nu']) out[k] = (a[k] ?? 0.5) + ((b[k] ?? 0.5) - (a[k] ?? 0.5)) * t;
  return out;
}

function selectRole(state, prevRole, vec) {
  const nand = disulfideBondNAND(vec);
  const suspend = (nand.isBoundary ? 1 : 0) * smoothstep(vec.s ?? 0.5, 0.55, 0.75) * smoothstep(vec.gamma ?? 0.5, 0.55, 0.8);
  if (suspend > 0.45) return 'suspend';
  if (state.cadenceEligibility > 0.6) return 'resolve';

  const scores = {
    establish: state.closure * 0.8 + (1 - state.tension) * 0.2,
    expand: state.motion * 0.5 + (1 - state.tension) * 0.3 + state.density * 0.2,
    stress: state.tension * 0.7 + state.motion * 0.3,
    fracture: state.tension * 0.6 + (1 - state.recurrence) * 0.4,
    suspend: (1 - Math.abs(state.direction)) * 0.5 + (nand.isBoundary ? 0.5 : 0),
    discharge: (1 - state.closure) * 0.6 + state.motion * 0.4,
    resolve: state.cadenceEligibility * 0.8 + state.closure * 0.2
  };

  // transitions
  if (prevRole && ROLE_TRANSITIONS[prevRole]) {
    for (const r of ROLE_TRANSITIONS[prevRole]) scores[r] = (scores[r] ?? 0) + 0.08;
  }

  let best = 'establish', bestScore = -Infinity;
  for (const [role, sc] of Object.entries(scores)) {
    if (sc > bestScore) { bestScore = sc; best = role; }
  }
  return best;
}

function composeBar({ vec, scale, scaleRoot, seed, prevRole, barIdx, section }) {
  const state = musicalState(vec);
  const role = selectRole(state, prevRole, vec);
  const params = synthesisParams(vec);
  const stepsPerBar = params.meter === '3/4' ? 12 : 16;

  const progression = progressionFromVector(vec, seed)[1];
  const progOffsets = progression.map(deg => getScaleDegreeOffset(scale, deg));
  const bass = bassFromVector({ vec, scale, scaleRoot, totalSteps: stepsPerBar, seed: seed + 100, progression: progOffsets });
  const melody = melodyFromVector({ vec, scale, scaleRoot, bars: 1, stepsPerBar, seed, progression: progOffsets, role });

  // Build chord pad
  const chord = chordFromScaleDegree(scale, scaleRoot, progression[0], chordNameFromVector(vec));

  return {
    barIdx,
    section,
    role,
    vec,
    state,
    params,
    chord,
    progression,
    bass,
    melody,
    rhythm: rhythmFromVector(vec, seed + 200)
  };
}

export function compose({ profile, form = 'verse_chorus', seed = 0, baseVec, key = 'C', scale = 'major' }) {
  const root = SEMITONES_PER_KEY[key] ?? 0;
  const scaleObj = SCALES[scale] ? { name: scale, intervals: SCALES[scale] } : scaleByVector(baseVec || VECTORS.major);
  const base = baseVec || (profile ? profileToBaseVec(profile) : VECTORS.major);
  const baseSeed = stableSeed(seed);

  const template = FORM_TEMPLATES[form] || FORM_TEMPLATES.verse_chorus;
  let prevRole = null;
  const bars = [];

  for (let i = 0; i < template.length; i++) {
    const section = template[i];
    const sectionVec = VECTORS[section] || VECTORS.verse;
    const vec = lerpVec(base, sectionVec, 0.6);
    const barSeed = baseSeed + i * 7919;
    const bar = composeBar({ vec, scale: scaleObj, scaleRoot: root + 60, seed: barSeed, prevRole, section });
    bars.push(bar);
    prevRole = bar.role;
  }

  return { form, seed: baseSeed, scale: scaleObj, bars };
}

// Profile → base 8D vector placeholder; can be replaced by music_map.json lookup
function profileToBaseVec(profile) {
  // Use blood/MBTI/gender to pick a circuit-music vector
  const blood = (profile.blood || profile.abo || 'O').toUpperCase();
  const mbti = (profile.mbti || 'INTJ').toUpperCase();
  const gender = (profile.gender || 'M').toUpperCase();

  const bloodVec = {
    O: { r:0.55, h:0.55, d:0.35, p:0.65, s:0.50, gamma:0.40, g:0.55, nu:0.35 },
    A: { r:0.50, h:0.60, d:0.30, p:0.55, s:0.48, gamma:0.45, g:0.60, nu:0.40 },
    B: { r:0.45, h:0.50, d:0.45, p:0.45, s:0.55, gamma:0.50, g:0.50, nu:0.45 },
    AB: { r:0.42, h:0.55, d:0.40, p:0.35, s:0.58, gamma:0.60, g:0.55, nu:0.50 }
  }[blood] || VECTORS.major;

  const dimAdjust = {};
  if (mbti[1] === 'N') { dimAdjust.h = 0.1; dimAdjust.nu = 0.05; dimAdjust.p = -0.05; }
  if (mbti[1] === 'S') { dimAdjust.r = 0.05; dimAdjust.p = 0.05; dimAdjust.gamma = -0.05; }
  if (mbti[2] === 'F') { dimAdjust.h = 0.08; dimAdjust.g = 0.05; }
  if (mbti[2] === 'T') { dimAdjust.d = 0.05; dimAdjust.s = 0.05; }
  if (mbti[3] === 'P') { dimAdjust.p = -0.1; dimAdjust.nu = 0.1; }
  if (mbti[3] === 'J') { dimAdjust.p = 0.1; dimAdjust.g = 0.05; }
  if (gender === 'F') { dimAdjust.gamma = 0.05; dimAdjust.s = -0.05; }

  const out = { ...bloodVec };
  for (const [k, v] of Object.entries(dimAdjust)) out[k] = clamp01((out[k] ?? 0.5) + v);
  return out;
}

// ── 10. PUBLIC API ────────────────────────────────────────────
export {
  clamp01,
  hash01,
  stableSeed,
  smoothstep,
  disulfideBondNAND,
  musicalState,
  SCALES,
  VECTORS,
  CHORD_INTERVALS,
  scaleByVector,
  chordNameFromVector,
  chordNotes,
  getScaleDegreeOffset,
  chordFromScaleDegree,
  progressionFromVector,
  euclideanPattern,
  rhythmFromVector,
  melodyFromVector,
  bassFromVector,
  synthesisParams,
  euclidean8D,
  lerpVec,
  selectRole,
  FORM_TEMPLATES,
  ROLE_TRANSITIONS
};

// Expose to global window for non-module composer_v3.html
if (typeof window !== 'undefined') {
  window.CircuitComposer = {
    clamp01,
    hash01,
    stableSeed,
    smoothstep,
    disulfideBondNAND,
    musicalState,
    SCALES,
    VECTORS,
    CHORD_INTERVALS,
    scaleByVector,
    chordNameFromVector,
    chordNotes,
    getScaleDegreeOffset,
    chordFromScaleDegree,
    progressionFromVector,
    euclideanPattern,
    rhythmFromVector,
    melodyFromVector,
    bassFromVector,
    synthesisParams,
    euclidean8D,
    lerpVec,
    selectRole,
    compose,
    FORM_TEMPLATES,
    ROLE_TRANSITIONS
  };
}
