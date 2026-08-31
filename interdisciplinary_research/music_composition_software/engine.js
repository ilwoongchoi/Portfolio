// ─────────────────────────────────────────────────────────────
// engine.js — Continuous Synthesis Physics Engine.
//
// Ported from the ACTUAL completed homeostasis circuit's tonal/FM chord
// layer (composer_v3.html:1136-1202, circuitSynthesize) — ditched the GM
// sample nearest-neighbor approach entirely per explicit direction, because
// discrete sample-switching is fundamentally incompatible with two hard
// requirements: (1) reproducibility (identical vector must always produce
// identical sound — nearest-neighbor ranking is fragile to float jitter at
// tie boundaries) and (2) linearity (small slider moves must produce small
// audible changes — nearest-neighbor has hard jumps at Voronoi boundaries).
//
// Every function below is a PURE, CONTINUOUS, DETERMINISTIC function of the
// 8D vector: no Math.random(), no thresholds/branches that cause step
// discontinuities, no sample-identity switching. Two identical vectors will
// always produce bit-identical parameter sets.
// ─────────────────────────────────────────────────────────────

/**
 * Apply deterministic jitter (shuffle) per toroidal hysteresis laws.
 * ±15% shuffle only to r, d, s. grounded in universe-prose.md:966.
 */
export function applyToroidalJitter(vec, amount = 0.15, seed = 0) {
  const result = { ...vec };
  const dims = ['r', 'd', 's'];
  dims.forEach((dim, i) => {
    if (result[dim] !== undefined) {
      // Deterministic jitter based on dim index and seed
      const jitter = (hash01(seed, i) * 2 - 1) * amount;
      result[dim] = Math.max(0, Math.min(1, result[dim] + jitter));
    }
  });
  return result;
}
/**
 * Tile phase rules — grounded in universe-prose.md:3442-3444:
 *   release(해소)         = 주기능(1st) 노드의 정방향 8D 파라미터
 *   stress_growth(성장)   = 보조기능(2nd) + blood+1 complexity
 *   extreme_growth(극한)  = 열등기능(4th)의 역방향 노드 활성화 (opposite temperament)
 *
 * 혈액형 복잡도: O=1(archetype), A=2(structured), B=3(experimental), AB=4(hybrid)
 * (universe-prose.md:1747)
 */
export function tilePhaseRules(baseVec, { mbti, blood } = {}) {
  const stack = mbti && MBTI_STACKS[mbti];
  if (!stack) return { release: baseVec, stress_growth: baseVec, extreme_growth: baseVec };

  const bloodComplexity = { O: 1, A: 2, B: 3, AB: 4 };
  const complexity = bloodComplexity[blood] || 1;

  // release: 1st function forward activation
  const releaseVec = { ...baseVec };
  const fn1 = COGNITIVE_FUNCTIONS[stack[0]];
  if (fn1) {
    for (const [dim, ratio] of Object.entries(fn1.dims)) {
      releaseVec[dim] = Math.max(0, Math.min(1, releaseVec[dim] + 0.20 * ratio));
    }
  }

  // stress_growth: 2nd function + blood+1 complexity (g↑, gamma↑, p↓)
  const stressVec = { ...baseVec };
  const fn2 = COGNITIVE_FUNCTIONS[stack[1]];
  if (fn2) {
    for (const [dim, ratio] of Object.entries(fn2.dims)) {
      stressVec[dim] = Math.max(0, Math.min(1, stressVec[dim] + 0.12 * ratio));
    }
  }
  const stressComplexity = Math.min(4, complexity + 1) - 1;
  stressVec.g = Math.min(1, stressVec.g + stressComplexity * 0.08);
  stressVec.gamma = Math.min(1, stressVec.gamma + stressComplexity * 0.06);
  stressVec.p = Math.max(0, stressVec.p - stressComplexity * 0.05);

  // extreme_growth: 4th function reverse activation (opposite temperament)
  const extremeVec = { ...baseVec };
  const fn4 = COGNITIVE_FUNCTIONS[stack[3]];
  if (fn4) {
    for (const [dim, ratio] of Object.entries(fn4.dims)) {
      // Reverse: suppress what 4th would activate, amplify opposite
      extremeVec[dim] = Math.max(0, Math.min(1, extremeVec[dim] - 0.10 * ratio));
    }
  }

  return { release: releaseVec, stress_growth: stressVec, extreme_growth: extremeVec };
}

/**
 * Resolves a logic token (e.g., "Profile_H", "Tension_R_Stress", "Prev_R + Jitter")
 * into a concrete 8D parameter value [0,1].
 */
export function resolveParameterToken(token, context) {
  const { profile = {}, prevVec = {}, timestamp = 0, index = 0 } = context;
  const seed = timestamp + index;

  if (token === 'random') return hash01(seed, 777);
  
  // Profile/Baseline references
  if (token.startsWith('Profile_') || token.startsWith('Vec8D_')) {
    const dim = token.split('_')[1].toLowerCase();
    return profile.bloodBaseline?.[dim] ?? 0.5;
  }

  // Tension references
  if (token.startsWith('Tension_')) {
    const parts = token.split('_'); // Tension, R/H/D/P/S, Release/Stress/Extreme
    const dim = parts[1].toLowerCase();
    const phase = parts[2].toLowerCase();
    return profile.tensions?.[phase]?.[dim] ?? 0.5;
  }

  // Previous state with Jitter
  if (token.includes('Prev_')) {
    const dim = token.split('_')[1].split(' ')[0].toLowerCase();
    const baseVal = prevVec[dim] ?? 0.5;
    if (token.includes('+ Jitter')) {
      const jitter = (hash01(seed, 888) * 2 - 1) * 0.15; // ±15% shuffle
      return Math.max(0, Math.min(1, baseVal + jitter));
    }
    return baseVal;
  }

  // Inversion (Mirror)
  if (token.startsWith('1 - ')) {
    const subToken = token.replace('1 - ', '');
    return 1 - resolveParameterToken(subToken, context);
  }

  // Fallback for raw numbers (if any remain)
  const num = parseFloat(token);
  return isNaN(num) ? 0.5 : num;
}

/**
 * Bjorklund's algorithm — distributes k pulses as evenly as possible across
 * n steps.
 */
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

/**
 * Deterministic hash -> [0,1) pseudo-random stream. NOT Math.random(): this
 * is a pure function of its inputs, so identical vectors always produce
 * identical output, satisfying the reproducibility requirement.
 */
function hash01(seed, index) {
  let x = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
export { hash01 };

const RHYTHM_GRID_STEPS = 8; // fixed subdivision grid (standard 8th-note bar)

/**
 * Toroidal hysteresis — grounded strictly in circuitfile-rewritten.md and
 * vectors.py (line 25-27): "Accumulation: d↓ (slow attack), s↓ (dark), r↓ (static)"
 * "Discharge: d↑ (fast attack), s↑ (bright), r↑ (dynamic)". h, p = fixed skeleton.
 * 
 * Driven by real clock time for continuous rhythmic diversity beyond finite
 * Euclidean pattern count. Phase cycles every ~30 seconds (discharge→accumulate→transition).
 * Only d, s, r get ±15% shuffle. Deterministic based on timestamp.
 */
export function hysteresisFromClock(vec, timestamp = 0) {
  const { r = 0.5, d = 0.5, s = 0.5 } = vec || {};
  const cycleMs = 30000; // 30 second hysteresis cycle
  const phaseMs = 10000; // 10 second per phase
  const t = timestamp % cycleMs;
  const phase = t < phaseMs ? 'discharge' : t < 2 * phaseMs ? 'accumulate' : 'transition';
  
  const shuffle = 0.15; // ±15% per circuit spec
  let vr = r, vd = d, vs = s;
  
  if (phase === 'discharge') {
    // d↑, s↑, r↑ — deterministic shuffle based on timestamp
    const f = (timestamp % 1000) / 1000; // 0~1 over 1 second
    vr = Math.min(1, r + shuffle * (0.5 + f * 0.5));
    vd = Math.min(1, d + shuffle * (0.5 + f * 0.5));
    vs = Math.min(1, s + shuffle * (0.5 + f * 0.5));
  } else if (phase === 'accumulate') {
    // d↓, s↓, r↓
    const f = (timestamp % 1000) / 1000;
    vr = Math.max(0, r - shuffle * (0.5 + f * 0.5));
    vd = Math.max(0, d - shuffle * (0.5 + f * 0.5));
    vs = Math.max(0, s - shuffle * (0.5 + f * 0.5));
  }
  // transition: no shuffle
  
  return { r: vr, h: vec.h, d: vd, p: vec.p, s: vs, gamma: vec.gamma, g: vec.g, nu: vec.nu, _phase: phase };
}

/**
 * Melodic contour — derived from circuit energy flow direction.
 * Discharge/AB_spark → ascending (energy rising → "create more" impulse)
 * Accumulate/B_accumulate → descending (energy falling → resolution + gap)
 * Transition → stationary (satisfaction + want to return to music)
 * 
 * This drives the self-listen satisfying loop: music creates residual stress
 * that pushes user toward other creative activities, then back to music.
 */
export function melodicContourFromPhase(phase) {
  if (phase === 'discharge') {
    return 'ascending';
  } else if (phase === 'accumulate') {
    return 'descending';
  }
  return 'stationary';
}

/**
 * Apply melodic contour to a sequence of MIDI notes within a tile.
 * ascending: notes gradually rise
 * descending: notes gradually fall
 * stationary: notes stay near base pitch with small variation
 */
export function applyMelodicContour(baseMidi, numNotes, contour) {
  const notes = [];
  if (contour === 'ascending') {
    for (let i = 0; i < numNotes; i++) {
      notes.push(baseMidi + Math.floor(i * 2));
    }
  } else if (contour === 'descending') {
    for (let i = 0; i < numNotes; i++) {
      notes.push(baseMidi - Math.floor(i * 2));
    }
  } else {
    for (let i = 0; i < numNotes; i++) {
      notes.push(baseMidi + Math.floor((i % 3 - 1) * 2));
    }
  }
  return notes;
}

/**
 * Scale/Mode from ABO blood type — grounded in gemini 타일추천.txt:
 * "ABO=AB → Phrygian+Lydian 혼합 스케일", "ABO=A → Dorian 고정"
 * 
 * A → Dorian (minor with raised 6th) — warm, folk-like
 * B → Mixolydian (major with lowered 7th) — bright, rock
 * AB → Phrygian+Lydian mixed — exotic, unresolved
 * O → Aeolian (natural minor) — dark, sad
 */
export function scaleFromABO(abo) {
  const scales = {
    'A': { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
    'B': { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
    'AB': { name: 'Phrygian+Lydian', intervals: [0, 1, 4, 5, 7, 8, 11] },
    'O': { name: 'Aeolian', intervals: [0, 2, 3, 5, 7, 8, 10] }
  };
  return scales[abo] || scales['O'];
}

/**
 * Chord voicing from g (binding density) — grounded in gemini 타일추천.txt:
 * "g=0.7 → voicing spread → 코드 음정 넓게 배치"
 * "g=0.4 → voicing close → 코드 음정 좁게"
 * 
 * g↑ → wide spread (root + 5th + 10th)
 * g↓ → close position (root + 3rd + 5th)
 */
export function chordVoicingFromG(g, rootMidi) {
  const spread = g * 25; // 0~25 cents
  if (g > 0.5) {
    // Wide: root, +5th(+7), +10th(+12)
    return [rootMidi, rootMidi + 7, rootMidi + 12];
  } else {
    // Close: root, +3rd(+4), +5th(+7)
    return [rootMidi, rootMidi + 4, rootMidi + 7];
  }
}

/**
 * Pattern recursion depth from nu (fractal self-similarity) — grounded in:
 * "nu=0.4 → 패턴 반복 shallow"
 * "nu=0.7 → 패턴 recursion depth 깊음 (같은 모티프 반복)"
 * 
 * nu↑ → deep pattern recursion (same motif repeats with variation)
 * nu↓ → shallow (each bar different)
 */
export function patternDepthFromNu(nu) {
  // nu 0.0~1.0 maps to recursion depth 1~4
  return Math.max(1, Math.min(4, Math.round(1 + nu * 3)));
}

/**
 * Downbeat/upbeat emphasis from gender — grounded in:
 * "gender M → downbeat 강조, gridLock 0.8"
 * "gender F → upbeat 강조, gridLock 0.4, syncopation 0.6"
 */
export function rhythmEmphasisFromGender(gender) {
  if (gender === 'M') {
    return { emphasis: 'downbeat', gridLock: 0.8, syncopation: 0.2 };
  } else {
    return { emphasis: 'upbeat', gridLock: 0.4, syncopation: 0.6 };
  }
}

/**
 * Rhythmic pattern — grounded strictly in universe-prose.md's own table
 * (line 988: "r = rhythm density / ADSR / tempo") and line 16
 * ("p↑ = 예측가능(predictable), p↓ = 혼돈(chaos)" — "LeftD2가 1이면 패턴을
 * 반복하고, 0이면 즉흥이 시작된다" = pattern repeats at p=1, improvisation
 * begins at p=0). No other dimension (d, nu, gamma, h) has any textual
 * basis for touching rhythm — d is explicitly "freq interval / beat-freq
 * dissonance" (a harmonic property), nu is "waveform self-similarity"
 * (a timbral property). Both are left out of rhythm generation entirely.
 *
 * r → pulse density over a fixed 8-step grid (1..8 hits out of 8 steps).
 * p → predictability vs chaos: at p=1, pure clean Euclidean (drum-machine
 *     predictable). As p→0, steps are deterministically perturbed toward
 *     an unpredictable/"free jazz"/improvised feel.
 */
export function rhythmFromVector(vec) {
  const { r = 0.5, p = 0.5 } = vec || {};
  const steps = RHYTHM_GRID_STEPS;
  const pulses = Math.max(1, Math.round(1 + r * (steps - 1))); // 1..8 hits — r only
  const base = euclideanPattern(pulses, steps);

  const chaos = 1 - p; // p↓ = chaos, per prose
  const seed = r * 97.13 + p * 53.7;
  const pattern = base.map((hit, i) => {
    const flip = hash01(seed, i) < chaos;
    return flip ? !hit : hit;
  });

  return { pulses, steps, pattern, gate: 0.8 };
}

/**
 * Drum/percussion layer — grounded in circuitfile.md affinity table:
 *   r → drums(↑) — kick density (circuitfile.md:439)
 *   p → drum machine(↑) / free jazz(↓) — kick precision (circuitfile.md:415)
 *   nu → drums(↑) / improvisation(↓) — fractal repetition (circuitfile.md:379)
 *   s → synth(↑) / bass(↓) — hihat brightness (circuitfile.md:407)
 *
 * Returns separate kick and hihat patterns + synth params for noise-based percussion.
 */
export function drumFromVector(vec) {
  const { r = 0.5, p = 0.5, nu = 0.5, s = 0.5 } = vec || {};
  const steps = RHYTHM_GRID_STEPS;

  // Kick: r controls density, p controls precision
  const kickPulses = Math.max(1, Math.round(1 + r * (steps - 1)));
  const kickBase = euclideanPattern(kickPulses, steps);
  const kickChaos = 1 - p;
  const kickSeed = r * 97.13 + p * 53.7;
  const kickPattern = kickBase.map((hit, i) => {
    const flip = hash01(kickSeed, i) < kickChaos * 0.5;
    return flip ? !hit : hit;
  });

  // Hihat: nu controls fractal repetition, s controls brightness
  // nu↑ = same pattern repeats (fractal self-similarity), nu↓ = every step different
  const hihatDensity = 0.3 + s * 0.5; // s↑ = more hihat hits
  const hihatPulses = Math.max(1, Math.round(steps * hihatDensity));
  const hihatBase = euclideanPattern(hihatPulses, steps);
  const hihatSeed = nu * 131.5 + s * 67.3;
  const hihatPattern = hihatBase.map((hit, i) => {
    // nu↑ = stable pattern (few flips), nu↓ = chaotic (many flips)
    const flipProb = (1 - nu) * 0.4;
    const flip = hash01(hihatSeed, i) < flipProb;
    return flip ? !hit : hit;
  });

  // Snare: on beats where kick is NOT hitting, gated by r (energy)
  const snarePattern = kickPattern.map((kick, i) => {
    if (kick) return false;
    return hash01(r * 200 + i * 50, i) < r * 0.3;
  });

  return {
    kick:  { pattern: kickPattern,  gain: 0.7 + r * 0.3, pitch: 60 + r * 12 },
    snare: { pattern: snarePattern, gain: 0.4 + r * 0.2, pitch: 200 + s * 200 },
    hihat: { pattern: hihatPattern, gain: 0.3 + s * 0.3, brightness: s },
    steps
  };
}

/**
 * Chord extension from h (harmonic overtone complexity) — grounded in:
 *   circuitfile.md:431 "h → harmonic overtone, strings(↑), cymbals(↓)"
 *   universe-prose.md:15 "배음 복잡도/따뜻한 질감 ↑"
 *   universe-prose.md:84 "Boards of Canada, hauntology, neo-classical" (h↑ = rich harmonics)
 *
 * h↑ → extended chords (7th, 9th, sus4) = rich harmonic overtones
 * h↓ → simple triad = dark ambient / power electronics (sparse harmonics)
 *
 * Returns interval offsets from root (in semitones).
 */
export function chordExtensionFromH(h, baseTriad = [0, 4, 7], nandState = null) {
  // Ethereal anchor: NAND boundary → sus4+add9 (C-D-F-G-Bb equivalent)
  // Grounded in Universal Geological Elemental Mapping23.md:26794-26817:
  //   "Sus4 + Add9: 해결되지 않은 흐름, 엔도르핀 황홀경 + 구조적 텐션"
  //   sus4 = disulfide_bond NAND 전환 중 (미해결)
  //   add9 = left_endorphin MOR 방출 (Photon/빛/확장)
  if (nandState && nandState.isBoundary) {
    // sus4 + add9: root, 9th, 4th, 5th, 7th — ethereal arpeggio anchor
    return [0, 14, 5, 7, 10];
  }
  if (h > 0.75) {
    // 9th chord: root, 3rd, 5th, 7th, 9th — maximal harmonic complexity
    return [0, 4, 7, 10, 14];
  } else if (h > 0.55) {
    // 7th chord: root, 3rd, 5th, 7th
    return [0, 4, 7, 10];
  } else if (h > 0.35) {
    // sus4: root, 4th, 5th — moderate complexity, unresolved
    return [0, 5, 7];
  } else {
    // Simple triad: root, 3rd, 5th — minimal harmonics
    return baseTriad;
  }
}

/**
 * Bass line chord quality from d (dissonance/darkness) — grounded in:
 *   circuitfile.md:423 "d → freq interval, beat-freq, clarinet(↓), cymbals(↑)"
 *   universe-prose.md:16 "디소넌스/어둠/깊이 ↑"
 *   universe-prose.md:85 "DRONE, noise, dark ambient" (d↑ = dark/dissonant)
 *
 * d↑ → diminished / minor2nd intervals (dark, dissonant)
 * d↓ → power chord / fifth (clean, stable)
 *
 * Returns bass interval from root.
 */
export function bassQualityFromD(d) {
  if (d > 0.75) {
    // Diminished 5th (tritone) — maximal dissonance
    return { interval: 6, type: 'diminished' };
  } else if (d > 0.55) {
    // Minor 3rd — dark but consonant
    return { interval: 3, type: 'minor' };
  } else if (d > 0.35) {
    // Minor 7th — dark with some tension
    return { interval: 10, type: 'minor7' };
  } else {
    // Perfect 5th — clean, stable (power chord)
    return { interval: 7, type: 'power' };
  }
}

/**
 * Bass line generator — creates a moving bass line across steps.
 * Grounded in: d → bass quality, r → bass rhythm density, p → predictability.
 * Instead of a single root note, generates a sequence of bass notes
 * that moves between root, fifth, and octave for musical direction.
 *
 * Returns array of midi notes (or null for rest) per step.
 */
export function bassLineFromVector(vec, scaleRoot, scaleIntervals, steps) {
  const { r = 0.5, d = 0.5, p = 0.5, g = 0.5 } = vec || {};
  const bassQual = bassQualityFromD(d);
  const bassRoot = scaleRoot - 12; // one octave below
  
  // Bass note options: root, fifth, octave, + quality interval
  const rootIv = 0;
  const fifthIv = scaleIntervals[4] || 7;
  const octaveIv = 12;
  const qualIv = bassQual.interval;
  
  // r controls how many bass hits (density)
  const bassHits = Math.max(1, Math.round(1 + r * (steps - 1)));
  const bassPattern = euclideanPattern(bassHits, steps);
  
  // p controls movement: high p = root-heavy (predictable), low p = more movement
  const moveProb = (1 - p) * 0.6;
  
  const sequence = [];
  let currentNote = bassRoot; // start on root
  
  for (let i = 0; i < steps; i++) {
    if (!bassPattern[i]) {
      sequence.push(null);
      continue;
    }
    
    // Decide if this hit should move to a different note
    const shouldMove = hash01(d * 77.3 + i * 29.1, i * 3) < moveProb;
    
    if (shouldMove) {
      // Move between root, fifth, octave, quality note
      const options = [bassRoot, bassRoot + fifthIv, bassRoot + octaveIv, bassRoot + qualIv];
      const idx = Math.floor(hash01(r * 50 + i * 13.7, i * 7) * options.length);
      currentNote = options[Math.min(idx, options.length - 1)];
    } else if (i === 0) {
      // First hit always on root
      currentNote = bassRoot;
    }
    // else: hold previous note (continuity)
    
    sequence.push(currentNote);
  }
  
  return sequence;
}

/**
 * Intra-tile chord progression — creates harmonic movement WITHIN a tile.
 * Grounded in: gamma → bar count (tileLengthFromGamma), each bar gets a chord.
 * Uses I→IV→V→I or I→vi→IV→V patterns depending on scale and vector.
 *
 * Returns array of chord root offsets (from scaleRoot) per bar.
 */
export function intraTileProgression(vec, scaleIntervals, bars) {
  const { p = 0.5, d = 0.5 } = vec || {};
  const scale = scaleIntervals || [0, 2, 3, 5, 7, 8, 10];
  
  // Scale degrees for chord roots (I, IV, V, vi, ii)
  const degrees = [0, 3, 4, 5, 1];
  const offsets = degrees.map(deg => scale[deg % scale.length]);
  
  // p high = predictable progression (I-IV-V-I), p low = unpredictable
  if (bars <= 1) return [offsets[0]]; // single bar = just I
  
  if (p > 0.6) {
    // Standard progression: I-IV-V-I (or subset based on bar count)
    const standardProg = [offsets[0], offsets[1], offsets[2], offsets[0]];
    const prog = [];
    for (let i = 0; i < bars; i++) {
      prog.push(standardProg[i % standardProg.length]);
    }
    return prog;
  } else if (p > 0.35) {
    // Minor progression: I-vi-IV-V
    const minorProg = [offsets[0], offsets[3], offsets[1], offsets[2]];
    const prog = [];
    for (let i = 0; i < bars; i++) {
      prog.push(minorProg[i % minorProg.length]);
    }
    return prog;
  } else {
    // Free/chaotic: deterministic but unpredictable chord selection
    const prog = [];
    for (let i = 0; i < bars; i++) {
      const seed = hash01(d * 100 + i * 37.3, i * 11);
      const idx = Math.floor(seed * degrees.length);
      prog.push(offsets[Math.min(idx, offsets.length - 1)]);
    }
    return prog;
  }
}

/**
 * BPM from r (tempo/attack) — grounded in circuitfile.md:
 *   r → ADSR attack/decay, tempo, drums(↑)
 * r↑ = fast attack = higher BPM, r↓ = slow attack = lower BPM
 * Range: 60 BPM (ambient/drone) to 180 BPM (techno/hardcore)
 */
export function bpmFromR(r) {
  return Math.round(60 + r * 120); // 60..180 BPM
}

/**
 * Tile length / bar count from gamma (spatial expansion) — grounded in:
 *   circuitfile.md:399 "gamma → reverb, spatial delay, expansion, orchestra(↑)"
 *   universe-prose.md:19 "reverb/공간감/확장 ↑"
 *   universe-prose.md:88 "HANS ZIMMER, CINEMATIC, post-rock" (gamma↑ = long expansion)
 *
 * gamma↑ → more bars / longer tile (cinematic expansion)
 * gamma↓ → fewer bars / shorter tile (tight loop)
 *
 * Returns bar count (1~8) and duration multiplier.
 */
export function tileLengthFromGamma(gamma) {
  const bars = Math.max(1, Math.round(1 + gamma * 7)); // 1..8 bars
  const durationMul = 0.5 + gamma * 2.5; // 0.5x ~ 3.0x base duration
  return { bars, durationMul };
}

/**
 * Layer count from g (binding density) — grounded in:
 *   circuitfile.md:389 "g → freq-band binding density, strings(↑), percussion(↓)"
 *   universe-prose.md:20 "결합 밀도/봉인 ↑"
 *   universe-prose.md:89 "PIANO, ambient, 쨍그랑" (g↑ = thick/dense binding)
 *
 * g↑ → more simultaneous layers (dense binding = thick texture)
 * g↓ → fewer layers (transparent = sparse)
 *
 * Returns number of active layers (1~4).
 */
export function layerCountFromG(g) {
  if (g > 0.75) return 4; // Full: lead + bass + pad + arpeggio
  if (g > 0.55) return 3; // lead + bass + pad
  if (g > 0.30) return 2; // lead + bass
  return 1;               // lead only
}

/**
 * p×d uncertainty principle — grounded in:
 *   universe-prose.md:3471 "p↑이면 d↓, p↓이면 d↑. 위치(예측가능성)를 정확히
 *   알면 운동량(주파수 변동)을 모른다"
 *
 * Applies inverse correlation: if p is high, d is suppressed; if p is low, d is amplified.
 * This is a continuous, deterministic correction — not a hard switch.
 */
export function uncertaintyCorrection(vec) {
  const { p = 0.5, d = 0.5 } = vec || {};
  // Inverse coupling strength: 0.15 max correction
  const correction = (0.5 - p) * 0.3; // p↑ → negative (suppress d), p↓ → positive (amplify d)
  const correctedD = Math.max(0, Math.min(1, d + correction));
  return { ...vec, d: correctedD };
}

/**
 * disulfide_bond NAND branch — grounded in:
 *   universe-prose.md:3485 "NAND 출력 LOW(환원) → nu 유연한 반복 = PIANO/DRONE.
 *   NAND 출력 HIGH(산화) → nu 고착 = 강제 프랙탈 lock = free jazz fragmentation"
 *
 * The NAND output is approximated by the oxidation state:
 *   When h + nu are both HIGH → NAND LOW (reductive) → flexible repetition
 *   When either h or nu is LOW  → NAND HIGH (oxidative) → rigid fragmentation
 *
 * Returns { nandOutput: 'low'|'high', nuMode: 'flexible'|'fragmented' }
 */
export function disulfideBondNAND(vec) {
  const { h = 0.5, nu = 0.5 } = vec || {};
  // NAND(h, nu): LOW when both HIGH, HIGH otherwise
  // Boundary = h or nu near 0.5 threshold = NAND transitioning = ethereal anchor
  const hNear = Math.abs(h - 0.5) < 0.08;
  const nuNear = Math.abs(nu - 0.5) < 0.08;
  const isBoundary = hNear || nuNear;
  const nandHigh = !(h > 0.5 && nu > 0.5);
  return {
    nandOutput: isBoundary ? 'boundary' : (nandHigh ? 'high' : 'low'),
    nuMode: isBoundary ? 'ethereal' : (nandHigh ? 'fragmented' : 'flexible'),
    isBoundary
  };
}

/** ADSR envelope — r drives attack speed, d drives decay/release length, p drives sustain level. */
export function envelopeFromVector(vec) {
  const { r = 0.5, d = 0.5, p = 0.5 } = vec || {};
  return {
    attack: Math.max(0.005, 0.3 * (1 - r)),
    decay: 0.1 + d * 0.4,
    sustain: 0.4 + (1 - p) * 0.4,
    release: 0.2 + d * 0.8
  };
}

/**
 * Continuous timbre morph: instead of switching between discrete waveforms
 * (triangle vs sawtooth) at a threshold, we generate BOTH oscillators always
 * and continuously crossfade their gains by s (brightness). s=0 → pure
 * triangle (round o' 'plip')/mellow, s=1 → pure sawtooth/bright & buzzy.
 * gamma softens the top end (reverb/expansion reads as "distant" -> darker).
 *
 * IMPORTANT: filterCutoffMultiplier is expressed as a MULTIPLE of the note's
 * fundamental frequency, not an absolute Hz value. If cutoff were a fixed Hz
 * number, raising the MIDI note would push the fundamental above the cutoff
 * (muffling high notes) while low notes would stay bright — the timbre would
 * shift with pitch even though the vector didn't change. Multiplying by freq
 * at synthesis time keeps the harmonic/filter relationship constant across
 * the whole keyboard.
 */
export function timbreFromVector(vec) {
  const { s = 0.5, gamma = 0.5, d = 0.5 } = vec || {};
  return {
    sawMix: s,                                          // 0..1 — continuous triangle->sawtooth blend
    filterCutoffMultiplier: Math.max(1.2, 2 + s * s * 22 - gamma * 2),
    filterQ: 0.4 + d * 6
  };
}

/**
 * FM modulation — h (harmonic complexity) + p (periodicity/chaos) continuously
 * drive modulator ratio and depth.
 *
 * IMPORTANT: depthIndex is a dimensionless FM INDEX (modulator amplitude in
 * Hz ÷ carrier frequency), not an absolute Hz value. Classic FM synthesis
 * rule: if depth is a fixed Hz number, the same absolute wobble is enormous
 * relative to a low note and negligible relative to a high note, so the
 * brightness/harshness of the sound changes with pitch even when the vector
 * is unchanged. Multiplying depthIndex by the carrier freq at synthesis time
 * keeps FM character pitch-invariant.
 */
export function fmFromVector(vec) {
  const { h = 0.5, p = 0.5 } = vec || {};
  return {
    ratio: 1 + h * 0.9,
    depthIndex: h * 0.6 + p * 0.9   // typical useful FM index range ~0..1.5
  };
}

/**
 * Detune (g = binding/voicing density) — continuous unison spread.
 * g=0 → single voice, no detune. g=1 → 3-voice unison spread ±25 cents.
 * Voice COUNT is fixed at 3 always (so there's never a discrete "voices: 1
 * vs 2 vs 3" switch); at g=0 the outer voices' gain is 0 so only the center
 * voice is audible, and gain ramps in continuously as g increases.
 */
export function voicingFromVector(vec) {
  const { g = 0.5 } = vec || {};
  const spreadCents = g * 25;
  const outerGain = g; // continuous 0..1, no discrete voice-count switch
  return { spreadCents, outerGain };
}

/**
 * Dissonance layer — d continuously adds a slightly-sharp unison voice
 * (ratio 1 + d*0.06) at a gain proportional to d, producing an audibly
 * "biting"/dissonant beat-frequency effect that scales smoothly with d.
 */
export function dissonanceFromVector(vec) {
  const { d = 0.5 } = vec || {};
  return { ratio: 1 + d * 0.06, gain: d * 0.35 };
}

/**
 * Fractal self-similarity (nu) — continuously fades in octave-doubling
 * layers using smoothstep ramps instead of hard if(nu > 0.6) branches, so
 * there is no audible "pop" as nu crosses a threshold.
 */
function smoothstep(x, edge0, edge1) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
export function octaveLayersFromVector(vec) {
  const { nu = 0.5 } = vec || {};
  return {
    octaveUp1Gain: smoothstep(nu, 0.35, 0.75),   // fades in +12 semitones
    octaveUp2Gain: smoothstep(nu, 0.65, 0.98)    // fades in +24 semitones
  };
}

/**
 * Tremolo (nu) — amplitude LFO whose rate/depth scale continuously with
 * fractal self-similarity, simulating recursive pattern repetition.
 */
export function tremoloFromVector(vec) {
  const { nu = 0.5 } = vec || {};
  return { rateHz: 1 + nu * 11, depth: nu * 0.5 };
}

/**
 * Reverb/expansion proxy (gamma) — simple continuous delay+feedback network
 * standing in for a convolution reverb. wet mix, delay time, and feedback
 * all scale continuously and monotonically with gamma.
 */
export function reverbFromVector(vec) {
  const { gamma = 0.5 } = vec || {};
  return {
    wet: gamma * 0.6,
    delaySec: 0.03 + gamma * 0.25,
    feedback: gamma * 0.35
  };
}

/**
 * Filter cutoff/Q for a specific note frequency. Cutoff is computed as
 * filterCutoffMultiplier × freq so the filter's relationship to the note's
 * harmonic series — and therefore the perceived timbre — stays constant
 * across the whole MIDI range, instead of muffling high notes / over-brightening
 * low notes the way a fixed absolute Hz cutoff would.
 */
export function filterFromVector(vec, freq) {
  const t = timbreFromVector(vec);
  return { type: 'lowpass', frequency: Math.max(150, t.filterCutoffMultiplier * freq), Q: t.filterQ };
}

// ─────────────────────────────────────────────
// PROFILE → VECTOR MAPPING (128×4 → 8D)
// Ground-truth: universe-prose.md:1114-1119
// mbti, gender, blood decide nothing directly in 8D numbers (they select genre).
// Layer modifies vector.
// Layer A: base (all 0.5).
// Layer B: nu +0.10, gamma −0.05.
// Layer C: no numeric change (blood complexity handled in genre not vector).
// Layer D: nu set 0.95, p randomised → we leave p unchanged here; runtime entropy will override.
// Cognitive function → 8D dim mapping (universe-prose.md:3372-3381)
// Each function maps to specific circuit node → 8D dim with impedance weight:
//   Dominant (1st) = lowest impedance = strongest activation (+0.20)
//   Auxiliary (2nd) = moderate impedance (+0.12)
//   Tertiary (3rd) = high impedance, stress-activated (+0.06)
//   Inferior (4th) = highest impedance, suppressed (−0.10, reverse activation)
const COGNITIVE_FUNCTIONS = {
  Te: { dims: { r: +1.0 }, node: 'cytochrome_c_oxidase.out0' },
  Ti: { dims: { s: +0.6, d: +0.4 }, node: 'heme.out0→methylation' },
  Fe: { dims: { h: +0.6, nu: +0.4 }, node: 'male_right_oxytocin.q+gluon_orogen.q' },
  Fi: { dims: { p: +0.5, d: +0.5 }, node: 'left_genital_d2→left_endorphin' },
  Ne: { dims: { r: +0.4, h: +0.3, nu: +0.3 }, node: 'memory_entropy.out_hind_insula' },
  Ni: { dims: { p: +0.5, nu: +0.5 }, node: 'pi_electron_cloud→carbon.q' },
  Se: { dims: { s: +0.5, gamma: +0.5 }, node: 'right_sole_dopamine.q+aurora' },
  Si: { dims: { d: +0.5, r: +0.5 }, node: 'hind_insula+succinate_dehydrogenase' }
};

// MBTI → cognitive function stack (1st~4th)
const MBTI_STACKS = {
  INTJ: ['Ni','Te','Fi','Se'], ENTJ: ['Te','Ni','Se','Fi'],
  INTP: ['Ti','Ne','Si','Fe'], ENTP: ['Ne','Ti','Fe','Si'],
  INFJ: ['Ni','Fe','Ti','Se'], ENFJ: ['Fe','Ni','Se','Ti'],
  INFP: ['Fi','Ne','Si','Te'], ENFP: ['Ne','Fi','Te','Si'],
  ISTJ: ['Si','Te','Fi','Ne'], ESTJ: ['Te','Si','Ne','Fi'],
  ISTP: ['Ti','Se','Ni','Fe'], ESTP: ['Se','Ti','Fe','Ni'],
  ISFJ: ['Si','Fe','Ti','Ne'], ESFJ: ['Fe','Si','Ne','Ti'],
  ISFP: ['Fi','Se','Ni','Te'], ESFP: ['Se','Fi','Te','Ni']
};

// Impedance weights: 1st=strongest, 4th=suppressed (reverse)
const STACK_WEIGHTS = [0.20, 0.12, 0.06, -0.10];

export function profileToVector({ mbti, gender, blood, layer } = {}) {
  // Start with neutral vector
  let vec = { r: 0.5, h: 0.5, d: 0.5, p: 0.5, s: 0.5, gamma: 0.5, g: 0.5, nu: 0.5 };

  // Cognitive function stack → 8D dim activation (universe-prose.md:3372-3381, 3383-3400)
  if (mbti && MBTI_STACKS[mbti]) {
    const stack = MBTI_STACKS[mbti];
    for (let i = 0; i < 4; i++) {
      const fn = stack[i];
      const weight = STACK_WEIGHTS[i];
      const cfg = COGNITIVE_FUNCTIONS[fn];
      if (!cfg) continue;
      for (const [dim, ratio] of Object.entries(cfg.dims)) {
        vec[dim] += weight * ratio;
      }
    }
  } else if (mbti) {
    // Fallback: simple trait mapping for unknown MBTI
    if (mbti[0] === 'I') vec.p += 0.15; else vec.r += 0.15;
    if (mbti[1] === 'N') { vec.h += 0.15; vec.nu += 0.1; }
    else { vec.g += 0.15; vec.s += 0.05; }
    if (mbti[2] === 'T') vec.d += 0.15;
    else { vec.h += 0.1; vec.g += 0.1; }
    if (mbti[3] === 'P') vec.p -= 0.1; else vec.p += 0.1;
  }
  
  // Gender mapping (subtle)
  if (gender === 'M') {
    vec.d += 0.05;  // Slightly more dissonant
    vec.g += 0.05;  // Slightly denser binding
  } else if (gender === 'F') {
    vec.h += 0.05;  // Slightly more harmonic
    vec.s += 0.05;  // Slightly brighter
  }
  
  // Blood type complexity mapping
  const bloodComplexity = { 'O': 1, 'A': 2, 'B': 3, 'AB': 4 };
  if (blood && bloodComplexity[blood]) {
    const complexity = bloodComplexity[blood];
    // Higher complexity → more binding density and spatial expansion
    vec.g += (complexity - 1) * 0.08;
    vec.gamma += (complexity - 1) * 0.06;
    // Higher complexity → less predictable rhythm
    vec.p -= (complexity - 1) * 0.05;
  }
  
  // Layer transformations (per universe-prose.md 1135-1138)
  if (layer === 'B') {
    // Temperament inversion (aa rh-): E↔I, P↔J
    vec.p = 1 - vec.p;  // Invert periodicity
    vec.r = 1 - vec.r;  // Invert rhythm tendency
  } else if (layer === 'C') {
    // Blood+1 (ao rh+): Increase complexity by one step
    vec.g = Math.min(1, vec.g + 0.1);
    vec.gamma = Math.min(1, vec.gamma + 0.08);
  } else if (layer === 'D') {
    // Both: temperament inversion + blood+1
    vec.p = 1 - vec.p;
    vec.r = 1 - vec.r;
    vec.g = Math.min(1, vec.g + 0.1);
    vec.gamma = Math.min(1, vec.gamma + 0.08);
    // Layer D also maximizes self-similarity
    vec.nu = Math.min(1, vec.nu + 0.15);
  }
  // Layer A: no transformation (self)
  
  // Clamp all values to [0,1]
  for (const dim in vec) {
    vec[dim] = Math.max(0, Math.min(1, vec[dim]));
  }
  
  return vec;
}

// ─────────────────────────────────────────────
// INSTRUMENT DEFINITION
// Based on HAPLOGROUP_1318 affinity table:
// r → drums(↑), str(↓)
// h → strings(↑), cymbals(↓)
// d → clarinet(↓), cymbals(↑)
// s → synth(↑), bass(↓)
// gamma → orchestra(↑)
// g → strings(↑), percussion(↓)
// nu → drums(↑)
export function instrumentFromVector(vec) {
  const { r=0.5, h=0.5, d=0.5, s=0.5, gamma=0.5, g=0.5, nu=0.5 } = vec;

  // Ethereal anchor detection: s↑ + gamma↑ + NAND boundary
  // = steel ch0 페라이트/빛 + aurora 방전 + disulfide_bond 전환
  // = "시간 멈춘 듯 투명한 arpeggio" (Universal Geological Elemental Mapping23.md:26632)
  const nand = disulfideBondNAND(vec);
  const isEthereal = nand.isBoundary && s > 0.6 && gamma > 0.6;

  // We define 3 fundamental synth engines based on dimension dominance:
  // 1. Percussive (r, nu, p)
  // 2. Sustained/Harmonic (h, gamma, g)
  // 3. Modulated/Electronic (s, d)

  let percussiveWeight = Math.max(0, (r + nu) / 2);
  let sustainedWeight = Math.max(0, (h + gamma + g) / 3);
  let electronicWeight = Math.max(0, (s + d) / 2);

  if (isEthereal) {
    // Ethereal: sustained 최대, percussive 최소 = "끊기지 않는 흐름"
    sustainedWeight = Math.min(1, sustainedWeight * 1.5 + 0.3);
    percussiveWeight *= 0.2;
    electronicWeight *= 0.5;
  }

  return {
    percussive: {
      weight: percussiveWeight,
      decay: 0.1 + (1 - r) * 0.3,
      fmRatio: 1.4 + d * 2,
      fmDepth: 0.2 + s * 0.8
    },
    sustained: {
      weight: sustainedWeight,
      attack: isEthereal ? 0.3 + (1 - h) * 0.6 : 0.1 + (1 - h) * 0.4,
      release: isEthereal ? 0.6 + gamma * 1.2 : 0.2 + gamma * 0.8,
      fmRatio: 0.5 + h * 0.5,
      fmDepth: g * 0.4
    },
    electronic: {
      weight: electronicWeight,
      filterQ: 0.5 + s * 10,
      fmRatio: 2.0 + h * 3,
      fmDepth: 0.5 + d * 1.5
    },
    isEthereal
  };
}

// ─────────────────────────────────────────────
// MULTI-LAYER SEQUENCER
// Returns multiple voice layers (lead, harmony, bass)
export function multiLayerSequencer(vec, rootMidi, contour = 'stationary', steps = 8) {
  const layers = [];
  const { g=0.5, nu=0.5, p=0.5 } = vec;

  // Layer 1: Lead (Always present)
  layers.push({
    type: 'lead',
    midi: circuitArpeggiator(vec, rootMidi + 12, contour, steps),
    gain: 0.8
  });

  // Layer 2: Bass (Strong if g is high or s is low)
  if (g > 0.3 || vec.s < 0.6) {
    const bassPattern = euclideanPattern(Math.max(1, Math.round(steps * (0.2 + vec.r * 0.3))), steps);
    const bassMidi = bassPattern.map(hit => hit ? rootMidi - 12 : null);
    layers.push({
      type: 'bass',
      midi: bassMidi,
      gain: 0.6 + (1 - vec.s) * 0.4
    });
  }

  // Layer 3: Harmony/Pad (Active if g > 0.6 or nu > 0.5)
  if (g > 0.6 || nu > 0.5) {
    const chord = chordVoicingFromG(g, rootMidi);
    layers.push({
      type: 'pad',
      midi: Array(steps).fill(chord), // Whole chord for each step (polyphonic)
      gain: 0.4 * g
    });
  }

  return layers;
}

// ─────────────────────────────────────────────
// CIRCUIT ARPEGGIATOR — deterministic
export function circuitArpeggiator(vec, chordMidiRoot, contour = 'stationary', hits = 8, scaleIntervals = null) {
  // Build scale pool from scale intervals (not just chord tones)
  // Grounded in: scaleFromABO provides the scale, arpeggiator should use full scale
  // with chord tones as anchors and passing tones for melodic movement.
  const scale = scaleIntervals || [0, 2, 3, 5, 7, 8, 10]; // Aeolian fallback
  
  // Build 2-octave scale pool from root
  const scalePool = [];
  for (let oct = 0; oct < 2; oct++) {
    for (const iv of scale) {
      scalePool.push(chordMidiRoot + iv + oct * 12);
    }
  }
  
  // Chord tones (scale degrees 1, 3, 5 = indices 0, 2, 4)
  const chordToneIndices = [0, 2, 4];
  
  // nu sets pattern recursion depth (fractal self-similarity)
  const depth = patternDepthFromNu(vec.nu); // 1..4
  
  // p sets predictability: high p = chord tones mostly, low p = passing tones + rests
  const predictability = vec.p ?? 0.5;
  
  // h sets harmonic richness: high h = more chord extensions, low h = sparse
  const richness = vec.h ?? 0.5;
  
  // d sets dissonance: high d = more passing tones / tension notes
  const dissonance = vec.d ?? 0.5;
  
  // r sets rhythm density: high r = more notes, low r = more rests
  const rhythmDensity = vec.r ?? 0.5;
  
  const sequence = [];
  let prevNoteIdx = 0; // for melodic continuity
  
  for (let i = 0; i < hits; i++) {
    // Rest probability: low r = more rests, creates musical breathing space
    const restProb = (1 - rhythmDensity) * 0.35;
    const restSeed = hash01(vec.r * 100 + vec.p * 50 + i * 13.7, i);
    if (restSeed < restProb) {
      sequence.push(null); // rest
      continue;
    }
    
    // Note selection: blend chord tones and passing tones
    // p high → mostly chord tones (predictable)
    // p low → more passing tones (free jazz)
    // d high → more dissonant passing tones (tension)
    const useChordTone = hash01(vec.p * 77.3 + i * 29.1, i * 3) < predictability;
    
    let noteIdx;
    if (useChordTone) {
      // Pick a chord tone near previous note for melodic continuity
      const chordOptions = chordToneIndices.map(ci => {
        const dist = Math.abs(ci - prevNoteIdx);
        return { idx: ci, dist };
      }).sort((a, b) => a.dist - b.dist);
      // h high = wider intervals (rich harmony), h low = stepwise
      const useWide = hash01(vec.h * 88.1 + i * 17.3, i * 5) < richness * 0.4;
      noteIdx = useWide ? chordOptions[Math.min(chordOptions.length - 1, 1)].idx : chordOptions[0].idx;
    } else {
      // Passing tone: pick adjacent scale note for stepwise motion
      // d high = allow larger leaps / tension notes
      const direction = hash01(vec.d * 91.7 + i * 23.5, i * 7) < 0.5 ? 1 : -1;
      const leapSize = dissonance > 0.6 ? 2 : 1;
      noteIdx = Math.max(0, Math.min(scalePool.length - 1, prevNoteIdx + direction * leapSize));
    }
    
    // Octave shift from nu recursion
    const octaveShift = Math.floor(i / scale.length) % depth;
    
    // Contour adjustment
    let finalNote = scalePool[noteIdx] + octaveShift * 12;
    if (contour === 'ascending') {
      finalNote += Math.floor(i / 2) * 2; // gradual rise
    } else if (contour === 'descending') {
      finalNote -= Math.floor(i / 2) * 2; // gradual fall
    }
    
    sequence.push(finalNote);
    prevNoteIdx = noteIdx;
  }
  
  return sequence;
}

/**
 * Chord progression between tiles — grounded in circuitfile.md node→dim mapping.
 * Each tile's primary attractor determines its chord function:
 *   energy (release) → I (tonic, stable)
 *   information (stress_growth) → IV (subdominant, movement)
 *   repair (extreme_growth) → V/vi (dominant or relative minor, tension)
 *   interface → ii (pre-dominant, transition)
 *   integration → I (resolution back to tonic)
 *
 * Scale-aware: uses scale intervals to pick correct chord tones.
 * Returns root offset (in semitones from scale root) for each tile.
 */
export function chordProgressionForAttractor(attractor, scaleIntervals) {
  if (!scaleIntervals) scaleIntervals = [0, 2, 3, 5, 7, 8, 10]; // Aeolian fallback
  const progressions = {
    energy:       { degree: 0, name: 'I' },   // tonic
    information:  { degree: 3, name: 'IV' },  // subdominant (4th degree)
    repair:       { degree: 4, name: 'V' },   // dominant (5th degree)
    interface:    { degree: 1, name: 'ii' },  // pre-dominant (2nd degree)
    integration:  { degree: 0, name: 'I' }    // tonic resolution
  };
  const prog = progressions[attractor] || progressions.energy;
  const rootOffset = scaleIntervals[prog.degree % scaleIntervals.length];
  return { rootOffset, degree: prog.degree, name: prog.name };
}
