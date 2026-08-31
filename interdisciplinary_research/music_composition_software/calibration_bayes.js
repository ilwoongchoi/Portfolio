// ─────────────────────────────────────────────────────────────
// calibration_bayes.js — Bayesian adaptive tile-picking identifier.
//
// Jointly infers 4 latent variables purely from tile picks (no time/
// location/name input):
//   1. MBTI×Blood×Gender profile (128)
//   2. rh_layer  (4)  ─ A/B/C/D energy layer
//   3. phase_offset (4) ─ handles unknown geographic timezone offset
//   4. friction bias (2) ─ handles ST/A vs FLOW distinction that colors picks
//
// Total hypotheses: 128 × 4 × 4 × 2 = 4096
//
// Each round:
//   - Present K tiles picked to MAXIMIZE MUTUAL INFORMATION between the
//     user's pick and the remaining hypothesis posterior.
//   - Update posterior via P(H | pick) ∝ P(H) · softmax_affinity(H, tiles).
//
// Stop when posterior entropy < STOP_ENTROPY OR after MAX_ROUNDS.
// Output: MAP hypothesis + posterior confidence.
//
// Same profile at different times / different profiles at different
// times can produce identical single picks → we disambiguate over
// multiple rounds because the WHOLE PICK TRAJECTORY is unique per H.
// ─────────────────────────────────────────────────────────────

const MBTIS = ['ENFJ','ENFP','ENTJ','ENTP','ESFJ','ESFP','ESTJ','ESTP',
               'INFJ','INFP','INTJ','INTP','ISFJ','ISFP','ISTJ','ISTP'];
const BLOODS = ['O','A','B','AB'];
const GENDERS = ['M','F'];
const LAYERS = ['A','B','C','D'];
const PHASE_OFFSETS = [0, 6, 12, 18]; // hours; handles unknown timezone
const FRICTION_MODES = ['flow', 'hold']; // FLOW vs FRICTION_HOLD
const FLIP = { E:'I', I:'E', N:'S', S:'N', T:'F', F:'T', J:'P', P:'J' };
const BLOOD_NEXT = { O:'A', A:'B', B:'AB', AB:'O' };
const DIMS = ['r','h','d','p','s','gamma','g','nu'];
const STOP_ENTROPY = 3.5;    // bits, ~1 in 11 remaining hypotheses
const MAX_ROUNDS = 6;
const TILES_PER_ROUND = 8;
const AFFINITY_SIGMA = 0.35;

function baselineFromMBTI(mbti) {
  // Deterministic baseline 8D from MBTI letters (each axis touches ~2 dims)
  const [e, n, t, j] = mbti.split('');
  let r = e === 'E' ? 0.70 : 0.30;
  let h = n === 'N' ? 0.70 : 0.30;
  let d = t === 'T' ? 0.65 : 0.35;
  let p = j === 'J' ? 0.70 : 0.30;
  return { r, h, d, p, s:0.5, gamma:0.5, g:0.5, nu:0.5 };
}

function applyBlood(vec, blood) {
  const v = { ...vec };
  if (blood === 'A')       { v.g = 0.75; v.s = 0.40; }
  else if (blood === 'B')  { v.g = 0.40; v.s = 0.65; v.gamma = 0.60; }
  else if (blood === 'AB') { v.nu = 0.75; v.gamma = 0.65; }
  else /* O */             { v.s = 0.85; v.nu = 0.30; }
  return v;
}

function applyGender(vec, gender) {
  const v = { ...vec };
  if (gender === 'F') { v.r = Math.min(1, v.r * 1.08); v.h = Math.min(1, v.h * 1.08); }
  else                { v.d = Math.min(1, v.d * 1.08); v.p = Math.min(1, v.p * 1.08); }
  return v;
}

function layerBflip(mbti) { return mbti.split('').map(c => FLIP[c]).join(''); }

function applyLayer(mbti, blood, layer) {
  // Returns effective (mbti, blood) after RH layer transformation
  if (layer === 'A') return [mbti, blood];
  if (layer === 'B') return [layerBflip(mbti), blood];
  if (layer === 'C') return [mbti, BLOOD_NEXT[blood]];
  if (layer === 'D') return [layerBflip(mbti), BLOOD_NEXT[blood]];
  return [mbti, blood];
}

// phase_owner(t): 128-slot circadian → peak/distant dim boost
function phaseOwnerFromLocalHour(hourFloat) {
  const slot = Math.floor((hourFloat / 24) * 128) + 1;
  if (slot <= 16)  return { peak:['p','s','nu'],   distant:['g','gamma'] };
  if (slot <= 48)  return { peak:['g','gamma'],    distant:['p','nu']    };
  if (slot <= 80)  return { peak:['r','d'],        distant:['nu','gamma']};
  if (slot <= 112) return { peak:['h','d'],        distant:['nu','p']    };
  return             { peak:['nu','gamma'],   distant:['r','d']     };
}

function applyPhase(vec, phase) {
  const v = { ...vec };
  const B = 1.28, A = 0.60;
  phase.peak.forEach(k => { if (k in v) v[k] = Math.min(1, v[k] * B); });
  phase.distant.forEach(k => { if (k in v) v[k] = Math.max(0, v[k] * A); });
  return v;
}

function applyFriction(vec, mode) {
  const v = { ...vec };
  if (mode === 'hold') {
    // Friction-hold biases pick toward higher-tension / lower-clean vecs
    v.d = Math.min(1, v.d * 1.10);
    v.r = Math.min(1, v.r * 1.06);
  }
  return v;
}

// Ideal preferred vec for hypothesis H given wall clock UTC ms
function idealVec(H, wallMs) {
  const [effMbti, effBlood] = applyLayer(H.mbti, H.blood, H.layer);
  let v = baselineFromMBTI(effMbti);
  v = applyBlood(v, effBlood);
  v = applyGender(v, H.gender);
  const localHour = (new Date(wallMs).getUTCHours() + H.phaseOffset) % 24;
  v = applyPhase(v, phaseOwnerFromLocalHour(localHour));
  v = applyFriction(v, H.friction);
  return v;
}

// Squared Euclidean over 8D
function distSq(a, b) {
  let s = 0;
  for (const k of DIMS) { const d = (a[k] ?? 0.5) - (b[k] ?? 0.5); s += d * d; }
  return s;
}
function affinity(H, tileVec, wallMs) {
  const ideal = idealVec(H, wallMs);
  return Math.exp(-distSq(ideal, tileVec) / (AFFINITY_SIGMA * AFFINITY_SIGMA * DIMS.length));
}

// Build hypothesis enumeration (index -> H)
function buildHypotheses() {
  const hs = [];
  for (const mbti of MBTIS) for (const blood of BLOODS) for (const gender of GENDERS)
    for (const layer of LAYERS) for (const phaseOffset of PHASE_OFFSETS)
      for (const friction of FRICTION_MODES) {
        hs.push({ mbti, blood, gender, layer, phaseOffset, friction });
      }
  return hs;
}

// Shannon entropy of posterior (bits)
function entropyBits(post) {
  let e = 0;
  for (const p of post) if (p > 1e-12) e -= p * Math.log2(p);
  return e;
}

// ── Tile pool: 20 musically-distinct archetypal 8D vectors ───
// Each represents a real genre/mood the circuit maps to. These are
// pinpointed on circuit-node semantics (universe-prose.md) so that
// they span the hypothesis space well AND sound musically real —
// avoiding harsh cube-corners that were info-optimal but ugly.
//   [r, h, d, p, s, γ, g, ν]
const ARCHETYPE_POOL = [
  { name:'ambient_pad',     midi:57, vec:[0.20,0.75,0.25,0.75,0.45,0.85,0.70,0.35] },
  { name:'deep_techno',     midi:52, vec:[0.85,0.30,0.45,0.90,0.65,0.30,0.35,0.50] },
  { name:'free_jazz',       midi:59, vec:[0.60,0.85,0.75,0.20,0.55,0.55,0.65,0.40] },
  { name:'drone_dark',      midi:48, vec:[0.15,0.35,0.85,0.90,0.20,0.85,0.90,0.85] },
  { name:'neo_classical',   midi:60, vec:[0.45,0.85,0.30,0.70,0.55,0.75,0.75,0.60] },
  { name:'idm_glitch',      midi:62, vec:[0.75,0.60,0.65,0.35,0.85,0.40,0.30,0.75] },
  { name:'hip_hop_female',  midi:55, vec:[0.75,0.35,0.40,0.85,0.50,0.35,0.35,0.55] },
  { name:'britpop_indie',   midi:64, vec:[0.55,0.50,0.30,0.75,0.70,0.50,0.40,0.30] },
  { name:'witch_house',     midi:53, vec:[0.35,0.40,0.85,0.40,0.80,0.65,0.55,0.75] },
  { name:'folk_acoustic',   midi:62, vec:[0.40,0.65,0.25,0.65,0.40,0.55,0.65,0.30] },
  { name:'cinematic',       midi:60, vec:[0.50,0.85,0.55,0.60,0.90,0.95,0.55,0.50] },
  { name:'noise_experim',   midi:56, vec:[0.65,0.55,0.90,0.15,0.70,0.35,0.20,0.85] },
  { name:'synthwave',       midi:60, vec:[0.60,0.55,0.40,0.75,0.85,0.55,0.40,0.50] },
  { name:'baroque_piano',   midi:65, vec:[0.65,0.90,0.35,0.85,0.50,0.70,0.75,0.60] },
  { name:'gabba_hardcore',  midi:52, vec:[0.95,0.30,0.65,0.90,0.90,0.30,0.30,0.40] },
  { name:'boards_of_canada',midi:58, vec:[0.45,0.75,0.50,0.55,0.55,0.65,0.60,0.65] },
  { name:'post_rock',       midi:61, vec:[0.55,0.80,0.55,0.65,0.65,0.75,0.65,0.55] },
  { name:'trap_808',        midi:50, vec:[0.85,0.30,0.35,0.85,0.75,0.40,0.30,0.60] },
  { name:'shoegaze',        midi:59, vec:[0.50,0.65,0.40,0.60,0.75,0.80,0.70,0.45] },
  { name:'minimal_dub',     midi:54, vec:[0.60,0.35,0.30,0.85,0.45,0.80,0.55,0.40] }
];

function generateCandidatePool() {
  return ARCHETYPE_POOL.map(a => {
    const v = {};
    DIMS.forEach((k, i) => v[k] = a.vec[i]);
    v._name = a.name;
    v._midi = a.midi;
    return v;
  });
}

// Expected info gain of a tile set (K tiles) given current posterior
// Approximate via marginal-entropy of the pick distribution
function expectedInfoGain(tiles, post, hypotheses, wallMs) {
  // For each hypothesis, compute its pick distribution over the K tiles
  // (softmax of affinity). Aggregate pick marginal, compute its entropy,
  // and compute expected posterior entropy under each pick outcome.
  const K = tiles.length;
  const perH_dist = hypotheses.map(H => {
    const aff = tiles.map(t => affinity(H, t, wallMs));
    const sum = aff.reduce((a,b)=>a+b, 0) || 1;
    return aff.map(a => a / sum);
  });
  // Marginal pick prob for each tile
  const pickMarginal = new Array(K).fill(0);
  for (let h=0; h<hypotheses.length; h++) {
    for (let k=0; k<K; k++) pickMarginal[k] += post[h] * perH_dist[h][k];
  }
  // Marginal entropy H(pick)
  let Hpick = 0;
  for (const p of pickMarginal) if (p > 1e-12) Hpick -= p * Math.log2(p);
  // Expected conditional entropy E_pick[ H(H | pick) ]
  let Hcond = 0;
  for (let k=0; k<K; k++) {
    if (pickMarginal[k] < 1e-12) continue;
    // posterior given pick = k
    let normalizer = 0;
    const newPost = new Array(hypotheses.length);
    for (let h=0; h<hypotheses.length; h++) {
      newPost[h] = post[h] * perH_dist[h][k];
      normalizer += newPost[h];
    }
    if (normalizer < 1e-12) continue;
    let He = 0;
    for (let h=0; h<hypotheses.length; h++) {
      const p = newPost[h] / normalizer;
      if (p > 1e-12) He -= p * Math.log2(p);
    }
    Hcond += pickMarginal[k] * He;
  }
  // Info gain = H(H) - E_pick[H(H|pick)] ≡ H(pick) - E_pick[H(pick|H)]  (equivalent)
  const Hprior = entropyBits(post);
  return Hprior - Hcond;
}

// Greedy selection of K tiles maximizing info gain
function selectTilesGreedy(pool, K, post, hypotheses, wallMs) {
  const selected = [];
  const remaining = [...pool];
  while (selected.length < K && remaining.length) {
    let bestIdx = 0, bestGain = -Infinity;
    for (let i=0; i<remaining.length; i++) {
      const candidate = [...selected, remaining[i]];
      const g = expectedInfoGain(candidate, post, hypotheses, wallMs);
      if (g > bestGain) { bestGain = g; bestIdx = i; }
    }
    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }
  return selected;
}

// Update posterior given user's picks (subset of tile indices)
function updatePosterior(post, tiles, picks, hypotheses, wallMs) {
  const K = tiles.length;
  const newPost = new Array(hypotheses.length);
  let norm = 0;
  for (let h=0; h<hypotheses.length; h++) {
    const H = hypotheses[h];
    const aff = tiles.map(t => affinity(H, t, wallMs));
    const sum = aff.reduce((a,b)=>a+b, 0) || 1;
    const dist = aff.map(a => a / sum);
    // Likelihood: product of pick prob for chosen, (1 - pick prob) for not chosen
    // Robust: use pick-probability directly for picked; use complement penalty for not-picked
    let lik = 1;
    for (let k=0; k<K; k++) {
      if (picks.includes(k)) lik *= (0.1 + dist[k]);        // reward affinity
      else                   lik *= (0.1 + (1 - dist[k])); // reward non-affinity
    }
    newPost[h] = post[h] * lik;
    norm += newPost[h];
  }
  if (norm < 1e-30) return post; // guard
  for (let h=0; h<newPost.length; h++) newPost[h] /= norm;
  return newPost;
}

// Marginalize posterior to 128 profile only
function marginalizeToProfile(post, hypotheses) {
  const profileScore = new Map();
  for (let h=0; h<hypotheses.length; h++) {
    const H = hypotheses[h];
    const key = `${H.mbti}_${H.blood}_${H.gender}`;
    profileScore.set(key, (profileScore.get(key) || 0) + post[h]);
  }
  return profileScore; // Map(profile_key -> probability)
}

function argmaxHypothesis(post, hypotheses) {
  let best = 0;
  for (let i=1; i<post.length; i++) if (post[i] > post[best]) best = i;
  return { H: hypotheses[best], p: post[best] };
}

// ── Public API ───────────────────────────────────────────────
export class BayesCalibrator {
  constructor() {
    this.hypotheses = buildHypotheses();
    this.pool = generateCandidatePool();
    this.reset();
  }
  reset() {
    const n = this.hypotheses.length;
    this.posterior = new Array(n).fill(1 / n);
    this.round = 0;
    this.wallMs = 0;
  }
  currentEntropy() { return entropyBits(this.posterior); }
  isDone() {
    return this.round >= MAX_ROUNDS || this.currentEntropy() < STOP_ENTROPY;
  }
  // Return array of 8D vectors for this round
  nextRound() {
    this.wallMs = this.round * 60000;
    this.round += 1;
    // Round 1: uniform prior → any tile equally informative; use 8 corner vectors
    // (fast, no greedy). Round 2+: Bayesian greedy from full pool.
    if (this.round === 1) {
      return this.pool.slice(0, TILES_PER_ROUND);
    }
    return selectTilesGreedy(this.pool, TILES_PER_ROUND, this.posterior, this.hypotheses, this.wallMs);
  }
  // picks: array of tile indices user chose (0..7)
  submitPicks(tiles, picks) {
    if (!picks.length) return;
    this.posterior = updatePosterior(this.posterior, tiles, picks, this.hypotheses, this.wallMs);
  }
  // Final profile inference
  finalize() {
    const best = argmaxHypothesis(this.posterior, this.hypotheses);
    const profileMarg = marginalizeToProfile(this.posterior, this.hypotheses);
    // Top-3 profiles for reporting confidence
    const sorted = [...profileMarg.entries()].sort((a,b) => b[1]-a[1]);
    return {
      hypothesis: best.H,
      hypothesisProb: best.p,
      profileTop: sorted.slice(0, 3),
      entropy: this.currentEntropy(),
      rounds: this.round
    };
  }
}

export { DIMS, MBTIS, BLOODS, GENDERS, LAYERS, PHASE_OFFSETS };
