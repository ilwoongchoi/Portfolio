// ─────────────────────────────────────────────────────────────
// composition.js — Circuit-grounded composition grammar engine
//
// This module translates the deterministic 8D vector + attractor context
// into a fully specified CompositionPlan. The audio engine should ONLY
// render this plan; it must not invent new musical structure locally.
//
// Pipeline:
//   circuit profile → 8D vector → musical state (intent) →
//   form/cadence automaton → composition role → bar-level grammar → plan
//
// All randomness is replaced with hash01(seed,index) so that identical
// inputs produce bit-identical plans. The musical rules come from
// universe-prose.md §§1-6 (2026.07 re-interpretation).
// ─────────────────────────────────────────────────────────────

import {
  disulfideBondNAND,
  uncertaintyCorrection,
  scaleFromABO,
  chordExtensionFromH,
  bassLineFromVector,
  tileLengthFromGamma,
  layerCountFromG,
  bpmFromR,
  instrumentFromVector,
  rhythmEmphasisFromGender,
  rhythmFromVector,
  drumFromVector,
  reverbFromVector,
  envelopeFromVector,
  timbreFromVector,
  fmFromVector,
  voicingFromVector,
  dissonanceFromVector,
  octaveLayersFromVector,
  tremoloFromVector,
  melodicContourFromPhase,
  patternDepthFromNu
} from './engine.js';

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────
const clamp01 = v => Math.max(0, Math.min(1, v));
const clamp11 = v => Math.max(-1, Math.min(1, v));

function stableSeed(input) {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 131 + input.charCodeAt(i)) % 2147483647;
    }
    return hash;
  }
  return 0;
}

function hash01(seed, index) {
  const s = (seed + index * 374761393) % 2147483647;
  const x = Math.sin(s * 12.9898 + index * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function smoothstep(x, edge0, edge1) {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function scaleDegreeOffset(scaleIntervals, degreeIndex) {
  const len = scaleIntervals.length || 7;
  const wrapped = ((degreeIndex % len) + len) % len;
  const octave = Math.floor(degreeIndex / len);
  return scaleIntervals[wrapped] + octave * 12;
}

// ─────────────────────────────────────────────────────────────
// 1. Musical State
// ─────────────────────────────────────────────────────────────
export function musicalStateFromVector(vec, nandState = disulfideBondNAND(vec)) {
  const g = clamp01(vec.g ?? 0.5);
  const p = clamp01(vec.p ?? 0.5);
  const d = clamp01(vec.d ?? 0.5);
  const h = clamp01(vec.h ?? 0.5);
  const r = clamp01(vec.r ?? 0.5);
  const s = clamp01(vec.s ?? 0.5);
  const gamma = clamp01(vec.gamma ?? 0.5);
  const nu = clamp01(vec.nu ?? 0.5);

  const closure = clamp01(g * 0.5 + p * 0.3 + (nandState.nandOutput === 'low' ? 0.2 : 0));
  const tension = clamp01(d * 0.5 + (1 - p) * 0.3 + h * 0.2);
  const motion = clamp01(r * 0.6 + p * 0.4);
  const brightness = clamp01(s * 0.7 + gamma * 0.3);
  const space = clamp01(gamma * 0.7 + (1 - g) * 0.3);
  const recurrence = clamp01(nu * 0.6 + p * 0.4);
  const density = clamp01(g * 0.7 + r * 0.3);
  const directionBase = clamp11((h - d) * 0.7);
  const direction = clamp11(directionBase + (nandState.isBoundary ? 0 : 0.3 * Math.sign(directionBase || 0.0001)));
  const cadenceEligibility = clamp01(closure * 0.5 + (1 - tension) * 0.3 + recurrence * 0.2);

  return {
    closure,
    tension,
    motion,
    brightness,
    space,
    recurrence,
    density,
    direction,
    cadenceEligibility
  };
}

// ─────────────────────────────────────────────────────────────
// 2. Form / Cadence Automaton
// ─────────────────────────────────────────────────────────────
const CADENCE_THRESHOLD = 0.6;
const CADENCE_HYSTERESIS = 0.08;
const SUSPEND_THRESHOLD = 0.35;

function computeAutomaton(state, nandState, vec, context = {}) {
  const cadenceIndex = clamp01(state.closure * 0.5 + (1 - state.tension) * 0.3 + state.recurrence * 0.2);
  const prevAllow = context.prevCadence ?? 0;
  let cadenceAllow = prevAllow;
  if (cadenceIndex >= CADENCE_THRESHOLD + CADENCE_HYSTERESIS) cadenceAllow = 1;
  else if (cadenceIndex <= CADENCE_THRESHOLD - CADENCE_HYSTERESIS) cadenceAllow = 0;

  const suspendStrength = (nandState.isBoundary ? 1 : 0) * smoothstep(vec.s ?? 0.5, 0.55, 0.75) * smoothstep(vec.gamma ?? 0.5, 0.55, 0.8);

  let latch;
  if (suspendStrength > SUSPEND_THRESHOLD) latch = 'suspend';
  else if (cadenceAllow >= 0.5) latch = 'resolve';
  else latch = 'open';

  return {
    cadenceIndex,
    cadenceAllow,
    latch,
    suspendStrength
  };
}

// ─────────────────────────────────────────────────────────────
// 3. Role grammar scaffolding
// ─────────────────────────────────────────────────────────────
const ROLE_PRIORS = {
  energy:      { establish: 0.1, expand: 0.05, resolve: 0.05 },
  information: { expand: 0.08, stress: 0.08 },
  repair:      { stress: 0.05, fracture: 0.1, discharge: 0.05 },
  interface:   { suspend: 0.15, fracture: 0.05 },
  integration: { resolve: 0.15, establish: 0.05 }
};

const ROLE_TRANSITIONS = {
  establish: ['expand', 'resolve'],
  expand:    ['stress', 'establish'],
  stress:    ['fracture', 'discharge'],
  fracture:  ['suspend', 'discharge'],
  suspend:   ['resolve'],
  discharge: ['resolve', 'expand'],
  resolve:   ['establish']
};

const ROLE_MELODIC_MOTIFS = {
  establish: [0, 2, 4, 2, 0, null, 4, null],
  expand:    [0, 1, 2, 4, 5, 4, 2, null],
  stress:    [4, 3, 4, 5, 6, 5, 4, null],
  fracture:  [0, 7, null, 4, null, 9, null, 2],
  suspend:   [0, null, 3, null, 7, null, 10, null],
  discharge: [7, 6, 5, 4, 3, 2, 1, 0],
  resolve:   [4, 2, 0, null, 0, null, 0, null]
};

const ROLE_CHORD_DEGREES = {
  establish: [[0, 0, 0, 0]],
  expand:    [[0, 3, 0, 0], [0, 5, 3, 0]],
  stress:    [[3, 4, 3, 4], [1, 4, 1, 4]],
  fracture:  [[4, 5, 4, 5], [4, 5, 3, 5]],
  suspend:   [[0, 0, 0, 0]],
  discharge: [[4, 0, 4, 0], [4, 0, 0, 0]],
  resolve:   [[4, 0, 3, 0], [4, 0, 4, 0]]
};

const ROLE_RHYTHM_OVERRIDES = {
  suspend: pattern => pattern.map((_, i) => (i === 0 ? true : false)),
  fracture: pattern => pattern.map((hit, i) => (i % 2 === 0 ? hit : !hit)),
  discharge: pattern => pattern.map((hit, i) => (hit || i % 2 === 0)),
  resolve: pattern => pattern.map((hit, i) => (i >= pattern.length - 2 ? true : hit))
};

const ROLE_DRUM_GAINS = {
  suspend: 0.3,
  establish: 0.6,
  expand: 0.8,
  stress: 1.0,
  fracture: 0.9,
  discharge: 1.0,
  resolve: 0.7
};

function scoreRoles(state, nandState, automaton, attractor = 'energy', context = {}) {
  const baseScores = {
    establish: state.closure * 0.8 + (1 - state.tension) * 0.2,
    expand: state.motion * 0.5 + (1 - state.tension) * 0.3 + state.density * 0.2,
    stress: state.tension * 0.7 + state.motion * 0.3,
    fracture: state.tension * 0.6 + (1 - state.recurrence) * 0.4,
    suspend: (1 - Math.abs(state.direction)) * 0.5 + (nandState.isBoundary ? 0.5 : 0),
    discharge: (1 - state.closure) * 0.6 + state.motion * 0.4,
    resolve: state.cadenceEligibility * 0.8 + state.closure * 0.2
  };

  const priors = ROLE_PRIORS[attractor] || {};
  Object.keys(priors).forEach(role => {
    baseScores[role] = (baseScores[role] ?? 0) + priors[role];
  });

  if (context.prevRole && ROLE_TRANSITIONS[context.prevRole]) {
    ROLE_TRANSITIONS[context.prevRole].forEach(r => {
      baseScores[r] = (baseScores[r] ?? 0) + 0.05;
    });
  }

  if (automaton.latch === 'suspend') {
    return 'suspend';
  }
  if (automaton.latch === 'resolve') {
    return 'resolve';
  }

  let bestRole = 'establish';
  let bestScore = -Infinity;
  for (const [role, score] of Object.entries(baseScores)) {
    if (score > bestScore) {
      bestScore = score;
      bestRole = role;
    }
  }
  return bestRole;
}

function chooseChordProgression(role, scaleIntervals, bars, seed) {
  const library = ROLE_CHORD_DEGREES[role] || ROLE_CHORD_DEGREES.establish;
  const idx = Math.floor(hash01(seed, bars) * library.length);
  const template = library[Math.min(idx, library.length - 1)];
  const progression = [];
  for (let i = 0; i < bars; i++) {
    const degree = template[i % template.length];
    progression.push(scaleDegreeOffset(scaleIntervals, degree));
  }
  return progression;
}

function applyRoleRhythm(role, basePattern) {
  const override = ROLE_RHYTHM_OVERRIDES[role];
  if (!override) return basePattern.slice();
  return override(basePattern.slice());
}

function applyRoleDrums(role, drums) {
  const gainMul = ROLE_DRUM_GAINS[role] ?? 0.8;
  return {
    steps: drums.steps,
    kick: { ...drums.kick, pattern: drums.kick.pattern.slice(), gain: drums.kick.gain * gainMul },
    snare: { ...drums.snare, pattern: drums.snare.pattern.slice(), gain: drums.snare.gain * gainMul },
    hihat: { ...drums.hihat, pattern: drums.hihat.pattern.slice(), gain: drums.hihat.gain * gainMul }
  };
}

function buildMelodySequence({ role, scaleIntervals, scaleRoot, bars, stepsPerBar, vec, progression, seed, nandState, phase }) {
  const motif = ROLE_MELODIC_MOTIFS[role] || ROLE_MELODIC_MOTIFS.establish;
  const contour = melodicContourFromPhase(phase || role);
  const depth = patternDepthFromNu(vec.nu ?? 0.5);
  const totalSteps = bars * stepsPerBar;
  const sequence = new Array(totalSteps).fill(null);
  const baseOctave = scaleRoot + 12; // lead in higher register

  for (let bar = 0; bar < bars; bar++) {
    for (let step = 0; step < stepsPerBar; step++) {
      const globalIndex = bar * stepsPerBar + step;
      const motifIdx = step % motif.length;
      const degree = motif[motifIdx];
      if (degree == null) continue;
      const octaveBias = (role === 'fracture') ? 1 : 0;
      const offset = scaleDegreeOffset(scaleIntervals, degree + octaveBias * Math.floor(step / depth));
      let note = baseOctave + offset;
      const rand = hash01(seed + bar, globalIndex) - 0.5;
      if (role === 'fracture') note += (rand > 0 ? 12 : -12);
      if (contour === 'ascending') note += Math.floor(step / 2);
      else if (contour === 'descending') note -= Math.floor(step / 2);
      sequence[globalIndex] = note;
    }
  }
  return sequence;
}

function buildBassSequence(role, vec, scaleRoot, scaleIntervals, totalSteps, stepsPerBar, seed) {
  const seq = bassLineFromVector(vec, scaleRoot, scaleIntervals, totalSteps).map(n => n);
  if (role === 'suspend') {
    for (let i = 0; i < seq.length; i++) {
      seq[i] = (i % stepsPerBar === 0) ? (scaleRoot - 12) : null;
    }
  } else if (role === 'fracture') {
    for (let i = 0; i < seq.length; i++) {
      if (hash01(seed, i) > 0.6) seq[i] = null;
    }
  } else if (role === 'discharge') {
    for (let i = 0; i < seq.length; i++) {
      if (seq[i] != null) seq[i] -= 12 * Math.floor(i / stepsPerBar);
    }
  }
  return seq;
}

// ─────────────────────────────────────────────────────────────
// 4. Build Composition Plan
// ─────────────────────────────────────────────────────────────
export function buildCompositionPlan(tile, options = {}) {
  const baseVec = tile?.vec || {};
  const vec = uncertaintyCorrection(baseVec);
  const nandState = disulfideBondNAND(vec);
  const state = musicalStateFromVector(vec, nandState);
  const attractor = (options.attractor || tile?.attractor || tile?.type || 'energy').toLowerCase();
  const automaton = computeAutomaton(state, nandState, vec, { prevCadence: options.prevCadence });
  const role = scoreRoles(state, nandState, automaton, attractor, { prevRole: options.prevRole });

  const abo = (options.abo || tile?.abo || tile?.blood || tile?.profile?.blood || 'O').toUpperCase();
  const gender = (options.gender || tile?.gender || tile?.profile?.gender || 'M').toUpperCase();
  const scale = scaleFromABO(abo);
  const scaleRoot = Math.round(tile?.midiRoot ?? tile?.rootMidi ?? tile?.midi ?? 60);

  const length = tileLengthFromGamma(vec.gamma ?? 0.5);
  const bars = Math.max(4, Math.min(8, length.bars));
  const bpm = bpmFromR(vec.r ?? 0.5);
  const beatDuration = 60 / bpm;
  const barDuration = beatDuration * 4;
  const stepsPerBar = 8;
  const totalSteps = bars * stepsPerBar;

  const seed = options.seed ?? stableSeed(tile?.id ?? `${attractor}-${scaleRoot}-${abo}`);
  const progression = chooseChordProgression(role, scale.intervals, bars, seed);
  const chordIntervals = chordExtensionFromH(vec.h ?? 0.5, [0, 4, 7], nandState);
  const padChords = progression.map(offset => chordIntervals.map(iv => scaleRoot + offset + iv));

  const rhythmBase = rhythmFromVector(vec);
  const rhythmPattern = applyRoleRhythm(role, rhythmBase.pattern);
  const drums = applyRoleDrums(role, drumFromVector(vec));
  const bass = buildBassSequence(role, vec, scaleRoot, scale.intervals, totalSteps, stepsPerBar, seed);
  const melody = buildMelodySequence({
    role,
    scaleIntervals: scale.intervals,
    scaleRoot,
    bars,
    stepsPerBar,
    vec,
    progression,
    seed,
    nandState,
    phase: tile?.phase
  });

  const layerCount = layerCountFromG(vec.g ?? 0.5);
  const instruments = instrumentFromVector(vec);
  const rhythmEmphasis = rhythmEmphasisFromGender(gender);
  const reverb = reverbFromVector(vec);
  const envelope = envelopeFromVector(vec);
  const timbre = timbreFromVector(vec);
  const fm = fmFromVector(vec);
  const voicing = voicingFromVector(vec);
  const dissonance = dissonanceFromVector(vec);
  const octaves = octaveLayersFromVector(vec);
  const tremolo = tremoloFromVector(vec);

  return {
    id: tile?.id,
    role,
    attractor,
    abo,
    gender,
    vec,
    state,
    automaton,
    nand: nandState,
    scale: { ...scale, rootMidi: scaleRoot },
    bpm,
    beatDuration,
    barDuration,
    bars,
    stepsPerBar,
    totalSteps,
    duration: barDuration * bars,
    chordIntervals,
    chordProgression: progression,
    padChords,
    rhythm: { pattern: rhythmPattern, steps: stepsPerBar, gate: rhythmBase.gate },
    drums,
    bass,
    melody,
    layerCount,
    instruments,
    rhythmEmphasis,
    reverb,
    envelope,
    timbre,
    fm,
    voicing,
    dissonance,
    octaves,
    tremolo,
    seed
  };
}

export default {
  musicalStateFromVector,
  buildCompositionPlan
};
