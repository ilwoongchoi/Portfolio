// Circuit Simulation Engine — Knit Pattern Parameter Derivation
// Based on first-draft_annotated1.md (circuit homeostasis blueprint)
// Each node has: gate type, inputs, outputs, 8D dim mappings
// Signal propagation traces actual circuit pathways to derive 8D params per tile per type

const _c = (v) => Math.max(0, Math.min(1, v));

// Gate logic functions
function gateAND(inputs) {
  if (inputs.length === 0) return 0;
  return inputs.reduce((a, b) => a * b, 1);
}

function gateOR(inputs) {
  if (inputs.length === 0) return 0;
  return Math.min(1, inputs.reduce((a, b) => a + b, 0));
}

function gateXOR(inputs) {
  if (inputs.length < 2) return inputs[0] || 0;
  // Fuzzy XOR: |a - b| for 2 inputs, cascade for more
  let result = inputs[0];
  for (let i = 1; i < inputs.length; i++) {
    result = Math.abs(result - inputs[i]);
  }
  return result;
}

function gateXNOR(inputs) {
  if (inputs.length < 2) return inputs[0] || 0;
  return 1 - gateXOR(inputs);
}

function gateNAND(inputs) {
  return 1 - gateAND(inputs);
}

function gateNOR(inputs) {
  return 1 - gateOR(inputs);
}

function gateMUX(inputs, ctrl) {
  // ctrl selects between in0 (ctrl=0) and in1 (ctrl=1)
  if (inputs.length < 2) return inputs[0] || 0;
  return inputs[0] * (1 - ctrl) + inputs[1] * ctrl;
}

function gateTristate(in0, ctrl0, ctrl1) {
  // 2-channel tristate: ctrl0 selects ch0, ctrl1 selects ch1
  // If both ctrl high, blend; if both low, output = in0 * 0.5
  const ch0 = in0 * ctrl0;
  const ch1 = in0 * ctrl1;
  return _c(ch0 + ch1);
}

function gateDFF(d, clk, enable, preset, reset, prevQ) {
  // D flip-flop with preset/reset
  if (reset > 0.5) return 0;
  if (preset > 0.5) return 1;
  if (enable > 0.5 && clk > 0.5) return d;
  return prevQ;
}

function gateSRLatch(set, reset, enable, prevQ) {
  if (enable > 0.5) {
    if (set > reset) return 1;
    if (reset > set) return 0;
  }
  return prevQ;
}

// Node 8D dim mappings from universe-prose.md
// Each entry: { dims: [[dimName, channel], ...], weight }
// Using arrays to support duplicate dim entries (e.g. node contributes to same dim via multiple channels)
const NODE_DIM_MAP = {
  // Energy attractor nodes
  LeftD2: { dims: [['p', 0]], weight: 1.0 },
  left_endorphin_electron_neutrino: { dims: [['nu', 0]], weight: 0.8 },
  left_endorphin_non_observer: { dims: [['nu', 0]], weight: 0.6 },
  none_observer: { dims: [['nu', 0]], weight: 0.4 },
  co2: { dims: [['r', 0], ['d', 1]], weight: 0.9 },
  heme: { dims: [['s', 0], ['d', 1]], weight: 1.0 },
  cytochrome_c_oxidase: { dims: [['r', 0], ['d', 1]], weight: 1.0 },
  water_vapour: { dims: [['g', 0], ['g', 1]], weight: 0.9 },
  steel: { dims: [['s', 0], ['gamma', 1]], weight: 0.9 },
  clay_gouge: { dims: [['g', 0]], weight: 0.8 },
  quark_orogen_magma: { dims: [['nu', 0]], weight: 0.8 },
  sodium: { dims: [['r', 0], ['s', 1]], weight: 0.9 },
  NaCl: { dims: [['r', 0], ['d', 1]], weight: 0.8 },
  aurora: { dims: [['s', 0], ['gamma', 0]], weight: 0.9 },
  fold_belt: { dims: [['r', 0], ['gamma', 1]], weight: 0.9 },
  actomyosin: { dims: [['r', 0], ['d', 1]], weight: 0.8 },
  sulfur_iron_complex: { dims: [['r', 0], ['d', 1]], weight: 0.7 },
  ferritin: { dims: [['s', 0], ['s', 1]], weight: 0.7 },
  methylation: { dims: [['h', 0], ['h', 1]], weight: 0.8 },
  large_igneous_province: { dims: [['gamma', 0], ['gamma', 1]], weight: 0.7 },
  subduction_zone: { dims: [['gamma', 0], ['gamma', 1]], weight: 0.7 },
  outer_core_convection: { dims: [['gamma', 0]], weight: 0.6 },
  lower_mantle: { dims: [['r', 0], ['gamma', 1]], weight: 0.7 },
  basin: { dims: [['p', 0], ['p', 1]], weight: 0.6 },
  craton: { dims: [['p', 0], ['p', 1]], weight: 0.6 },
  plume: { dims: [['gamma', 0]], weight: 0.6 },
  gluon_orogen: { dims: [['nu', 0]], weight: 0.7 },
  nitrogenase: { dims: [['nu', 0], ['nu', 1]], weight: 0.7 },
  laterite: { dims: [['p', 0], ['p', 1]], weight: 0.6 },
  thorium: { dims: [['s', 0]], weight: 0.6 },
  magnetite: { dims: [['s', 0]], weight: 0.6 },
  oxidised_manganese: { dims: [['s', 0], ['s', 1]], weight: 0.7 },
  manganese_oxygen_complex: { dims: [['s', 0], ['s', 1]], weight: 0.7 },
  manganese_nodule: { dims: [['p', 0], ['p', 1]], weight: 0.6 },
  pi_electron_cloud: { dims: [['s', 0]], weight: 0.7 },
  monazite: { dims: [['gamma', 0]], weight: 0.5 },
  pyrite: { dims: [['r', 0], ['r', 1]], weight: 0.6 },
  chlorine_ion_pump: { dims: [['r', 0], ['r', 1]], weight: 0.7 },
  heath_aerenchyma: { dims: [['r', 0]], weight: 0.6 },
  mangrove_aerenchyma: { dims: [['r', 0]], weight: 0.5 },
  water: { dims: [['g', 0]], weight: 0.6 },

  // Information attractor nodes
  mc1r: { dims: [['p', 0]], weight: 1.0 },
  memory_entropy: { dims: [['r', 0], ['h', 0], ['nu', 0], ['p', 1], ['nu', 1]], weight: 1.0 },
  hind_insula: { dims: [['d', 0], ['s', 1]], weight: 1.0 },
  carbon: { dims: [['p', 0], ['nu', 1]], weight: 1.0 },
  glymphatic_system: { dims: [['g', 0]], weight: 0.9 },
  cysteine: { dims: [['s', 0]], weight: 0.9 },
  sulforaphane: { dims: [['g', 0], ['nu', 0]], weight: 0.9 },
  histosol: { dims: [['h', 0], ['h', 1]], weight: 0.9 },
  peonidine: { dims: [['s', 0], ['s', 1]], weight: 0.7 },
  pentose_phosphate: { dims: [['h', 0], ['h', 1]], weight: 0.7 },
  disulfide_bond: { dims: [['h', 0]], weight: 0.7 },
  collagen: { dims: [['h', 0]], weight: 0.9 },
  andosol: { dims: [['g', 0], ['nu', 0]], weight: 0.7 },
  cambisol: { dims: [['h', 0], ['g', 0], ['h', 1], ['g', 1]], weight: 0.7 },
  copper_iron_complex: { dims: [['h', 0], ['nu', 0]], weight: 0.8 },
  methionine: { dims: [['h', 0]], weight: 0.8 },
  adapter_protein: { dims: [['p', 0]], weight: 0.8 },
  right_acetylcholine: { dims: [['r', 0], ['r', 0]], weight: 0.7 },
  glp1: { dims: [['p', 0], ['p', 1]], weight: 0.6 },
  cck: { dims: [['r', 0]], weight: 0.6 },
  right_sole_dopamine: { dims: [['p', 0], ['p', 1]], weight: 0.7 },
  male_right_oxytocin: { dims: [['p', 0], ['p', 1]], weight: 0.7 },
  right_progesterone_pra: { dims: [['p', 0], ['p', 1]], weight: 0.5 },

  // Repair attractor nodes
  autophagy: { dims: [['r', 0], ['d', 0]], weight: 0.9 },
  substance_p: { dims: [['d', 0], ['nu', 0], ['d', 1], ['nu', 1]], weight: 0.9 },
  succinate_dehydrogenase: { dims: [['r', 0], ['d', 0], ['h', 1], ['g', 2], ['nu', 2]], weight: 1.0 },
  mycorradicin: { dims: [['nu', 0]], weight: 0.8 },
  lactate_dehydrogenase: { dims: [['r', 0], ['d', 0]], weight: 0.6 },
};

// Tile pathway definitions — each tile traces specific circuit nodes
// Energy tile: LeftD2 → Carbon → NaCl → Actomyosin → SDH → COX → heme → steel → water_vapour → clay_gouge
// Information tile: MC1R → Glymphatic → Cysteine → Memory_entropy → Hind_insula → Carbon → Sulforaphane → Histosol
// Repair tile: Substance_P → Autophagy → Collagen → Methionine → Copper_iron → Fold_belt → Mycorradicin → SDH
// Air cavity tile: heme ↔ memory_entropy boundary + clay_gouge ↔ actomyosin boundary
// Carbon integration tile: Carbon → all 3 attractor cross-points

const TILE_PATHWAYS = {
  energy: [
    'LeftD2', 'co2', 'carbon', 'NaCl', 'actomyosin',
    'succinate_dehydrogenase', 'cytochrome_c_oxidase', 'heme',
    'steel', 'water_vapour', 'clay_gouge', 'sodium', 'aurora',
    'fold_belt', 'ferritin', 'methylation', 'pi_electron_cloud'
  ],
  information: [
    'mc1r', 'glymphatic_system', 'cysteine', 'memory_entropy',
    'hind_insula', 'carbon', 'sulforaphane', 'histosol',
    'collagen', 'copper_iron_complex', 'methionine', 'adapter_protein',
    'peonidine', 'pentose_phosphate', 'disulfide_bond', 'andosol',
    'cambisol', 'male_right_oxytocin', 'right_acetylcholine'
  ],
  repair: [
    'substance_p', 'autophagy', 'collagen', 'methionine',
    'copper_iron_complex', 'fold_belt', 'mycorradicin',
    'succinate_dehydrogenase', 'histosol', 'sulforaphane',
    'glymphatic_system', 'cysteine', 'manganese_nodule',
    'oxidised_manganese', 'manganese_oxygen_complex', 'pyrite',
    'sulfur_iron_complex', 'lactate_dehydrogenase', 'gluon_orogen',
    'lower_mantle', 'basin', 'craton', 'right_sole_dopamine'
  ],
  interface: [
    'heme', 'memory_entropy', 'clay_gouge', 'actomyosin',
    'cytochrome_c_oxidase', 'hind_insula', 'sodium', 'NaCl',
    'aurora', 'fold_belt', 'succinate_dehydrogenase', 'carbon'
  ],
  integration: [
    'carbon', 'LeftD2', 'mc1r', 'autophagy',
    'succinate_dehydrogenase', 'memory_entropy', 'heme',
    'clay_gouge', 'actomyosin', 'sulforaphane', 'substance_p',
    'co2', 'water_vapour', 'steel', 'glymphatic_system'
  ]
};

// Profile → circuit initial conditions mapping
// MBTI determines temperament pathway biases
// Gender determines observer wiring strength (female = stronger non-observer)
// Blood determines carbon-state latch bias
// Layer determines depth of circuit perturbation

function profileToCircuitInit(profile) {
  const mbti = profile.mbti || 'INTJ';
  const blood = (profile.blood || 'O').toUpperCase();
  const gender = (profile.gender || 'M').toUpperCase();
  const layer = profile.layer || 'A';

  const e_i = mbti[0] === 'I' ? 0.6 : 0.4; // introvert = higher internal
  const s_n = mbti[1] === 'N' ? 0.7 : 0.3; // intuitive = higher information
  const t_f = mbti[2] === 'F' ? 0.7 : 0.3; // feeling = higher emotional
  const j_p = mbti[3] === 'P' ? 0.6 : 0.4; // perceiving = higher flexibility

  // LeftD2 tonic DA: SJ high (predictable), NP low (chaotic)
  let leftD2 = 0.5;
  if (mbti[1] === 'S' && mbti[3] === 'J') leftD2 = 0.8;
  else if (mbti[1] === 'N' && mbti[3] === 'P') leftD2 = 0.3;
  else if (mbti[1] === 'S') leftD2 = 0.65;
  else if (mbti[1] === 'N') leftD2 = 0.4;

  // Carbon state: blood type determines metabolic latch bias
  // O = archetype (balanced), A = structured (high q), B = experimental (high q_bar), AB = hybrid
  let carbonQ = 0.5;
  if (blood === 'A') carbonQ = 0.7;
  else if (blood === 'B') carbonQ = 0.3;
  else if (blood === 'AB') carbonQ = 0.5;
  else if (blood === 'O') carbonQ = 0.55;

  // MC1R state: NF types have higher cAMP/PKA (q ON), ST types lower
  let mc1rQ = 0.5;
  if (mbti[1] === 'N' && (mbti[2] === 'F' || mbti[3] === 'F')) mc1rQ = 0.7;
  else if (mbti[1] === 'S' && (mbti[2] === 'T' || mbti[3] === 'T')) mc1rQ = 0.3;

  // Observer wiring: female = stronger non-observer (more internal monitoring)
  const observerStrength = gender === 'F' ? 0.7 : 0.4;

  // Layer depth: A=surface, B=mid, C=deep, D=extreme
  const layerDepth = { A: 0.3, B: 0.5, C: 0.7, D: 0.9 }[layer] || 0.3;

  // Autophagy bias: NT/SP + B = higher repair stress
  let autophagyBias = 0.5;
  const isNF = mbti[1] === 'N' && (mbti[2] === 'F' || mbti[3] === 'F');
  const isSJ = mbti[1] === 'S' && mbti[3] === 'J';
  if (!isSJ && !isNF) autophagyBias = 0.65; // NT/SP
  if (blood === 'B') autophagyBias += 0.1;

  // SDH (hypoxia) bias: SJ + O = higher energy stress
  let sdhBias = 0.5;
  if (isSJ) sdhBias = 0.7;
  if (blood === 'O') sdhBias += 0.1;

  // Memory entropy bias: NF + AB = higher information stress
  let memEntropyBias = 0.5;
  if (isNF) memEntropyBias = 0.7;
  if (blood === 'AB') memEntropyBias += 0.1;
  if (gender === 'F') memEntropyBias += 0.05;

  // Substance P bias: stress-driven, higher in NT/SP + B
  let substancePBias = 0.5;
  if (!isSJ && !isNF) substancePBias = 0.65;
  if (blood === 'B') substancePBias += 0.1;

  // Heme bias: ST = higher HO-1 (s-channel), NF = higher ETC (d-channel)
  let hemeBias = 0.5;
  const isST = mbti[1] === 'S' && (mbti[2] === 'T' || mbti[3] === 'T');
  if (isST) hemeBias = 0.65;
  if (isNF) hemeBias = 0.35;

  // Clay gouge (fault seal): female = higher seal pressure
  let clayGougeBias = 0.5;
  if (gender === 'F') clayGougeBias = 0.7;

  // Actomyosin bias: ST-male = higher resistance
  let actomyosinBias = 0.5;
  if (isST && gender === 'M') actomyosinBias = 0.7;

  // CO2 bias: metabolic rate, SJ = higher
  let co2Bias = 0.5;
  if (isSJ) co2Bias = 0.65;

  // Sodium bias: E types = higher action potential frequency
  let sodiumBias = 0.5;
  if (mbti[0] === 'E') sodiumBias = 0.65;

  // Collagen bias: J types = higher structural stability
  let collagenBias = 0.5;
  if (mbti[3] === 'J') collagenBias = 0.65;

  // Sulforaphane (Nrf2) bias: female = higher Nrf2 activity
  let sulforaphaneBias = 0.5;
  if (gender === 'F') sulforaphaneBias = 0.65;

  // Iron/ferritin bias: blood O = higher iron storage
  let ferritinBias = 0.5;
  if (blood === 'O') ferritinBias = 0.65;

  return {
    leftD2,
    carbonQ,
    mc1rQ,
    observerStrength,
    layerDepth,
    autophagyBias,
    sdhBias,
    memEntropyBias,
    substancePBias,
    hemeBias,
    clayGougeBias,
    actomyosinBias,
    co2Bias,
    sodiumBias,
    collagenBias,
    sulforaphaneBias,
    ferritinBias,
    e_i, s_n, t_f, j_p,
    isST, isSJ, isNF,
    blood, gender, mbti, layer
  };
}

// Simulate a single node and return its output value [0,1]
// This is a simplified steady-state evaluation — not a full transient sim
function simulateNode(nodeName, init, prevOutputs, visiting) {
  // If already computed, return cached
  if (nodeName in prevOutputs) return prevOutputs[nodeName];

  const i = init;

  // Node simulation logic — each node computes from its inputs
  switch (nodeName) {
    case 'LeftD2':
      return i.leftD2;

    case 'co2': {
      // 2 tristate: respiratory (ch0) + metabolic (ch1)
      const vagalACh = getOrInput('right_acetylcholine', init, prevOutputs, visiting);
      const peonidine = getOrInput('peonidine', init, prevOutputs, visiting);
      const memEntropy = getOrInput('memory_entropy', init, prevOutputs, visiting);
      const ch0 = i.co2Bias * 0.6 + vagalACh * 0.4;
      const ch1 = peonidine * 0.5 + i.co2Bias * 0.5;
      const ctrl0 = memEntropy * 0.5 + 0.5; // hippocampal mismatch gates
      const val = ch0 * ctrl0 + ch1 * (1 - ctrl0) * 0.5;
      return _c(val);
    }

    case 'carbon': {
      // D flip-flop: metabolic carbon-state latch
      const d = getOrInput('hind_insula', init, prevOutputs, visiting);
      const clk = getOrInput('succinate_dehydrogenase', init, prevOutputs, visiting);
      const enable = i.leftD2;
      const preset = getOrInput('left_endorphin_electron_neutrino', init, prevOutputs, visiting);
      const reset = getOrInput('cytochrome_c_oxidase', init, prevOutputs, visiting);
      const q = gateDFF(d, clk, enable, preset, reset, i.carbonQ);
      return _c(q);
    }

    case 'mc1r': {
      // D flip-flop: MC1R receptor
      const d = getOrInput('manganese_nodule', init, prevOutputs, visiting);
      const clk = getOrInput('glp1', init, prevOutputs, visiting);
      const enable = getOrInput('substance_p', init, prevOutputs, visiting);
      const preset = getOrInput('methanogenesis', init, prevOutputs, visiting);
      const reset = getOrInput('fold_belt', init, prevOutputs, visiting);
      const q = gateDFF(d, clk, enable, preset, reset, i.mc1rQ, 0);
      return _c(q);
    }

    case 'heme': {
      // 2 tristate: HO-1 (ch0, s-dim) + ETC (ch1, d-dim)
      const clPump = getOrInput('chlorine_ion_pump', init, prevOutputs, visiting);
      const cox = getOrInput('cytochrome_c_oxidase', init, prevOutputs, visiting);
      const observer = i.observerStrength;
      const ch0 = gateXOR([clPump, observer]) * i.hemeBias;
      const ch1 = gateXOR([cox, observer]) * (1 - i.hemeBias);
      const ctrl0 = getOrInput('oxidised_manganese', init, prevOutputs, visiting);
      const ctrl1 = getOrInput('manganese_oxygen_complex', init, prevOutputs, visiting);
      return _c(ch0 * ctrl0 + ch1 * ctrl1);
    }

    case 'cytochrome_c_oxidase': {
      // 2 tristate: forward O2 (ch0, r-dim) + retrograde cyt-c (ch1, d-dim)
      const heath = getOrInput('heath_aerenchyma', init, prevOutputs, visiting);
      const ferritin = getOrInput('ferritin', init, prevOutputs, visiting);
      const observer = i.observerStrength;
      const cck = getOrInput('cck', init, prevOutputs, visiting);
      const ctrl0 = cck * i.leftD2 * getOrInput('oxidised_manganese', init, prevOutputs, visiting);
      const ch0 = gateXOR([heath, observer]) * ctrl0;
      const ch1 = gateXOR([ferritin, observer]) * (1 - ctrl0);
      return _c(ch0 + ch1);
    }

    case 'water_vapour': {
      // 2 tristate: tropospheric (ch0, g) + stratospheric (ch1, g)
      const steel = getOrInput('steel', init, prevOutputs, visiting);
      const clay = getOrInput('clay_gouge', init, prevOutputs, visiting);
      const observer = i.observerStrength;
      const ctrl0 = getOrInput('oxidised_manganese', init, prevOutputs, visiting);
      const ch0 = gateXOR([steel, observer]);
      const ch1 = gateXOR([clay, observer]);
      return _c(ch0 * ctrl0 + ch1 * (1 - ctrl0) * 0.7);
    }

    case 'steel': {
      // 2 tristate: ferritic (ch0, s/gamma) + austenitic (ch1, gamma)
      const piCloud = getOrInput('pi_electron_cloud', init, prevOutputs, visiting);
      const monazite = getOrInput('monazite', init, prevOutputs, visiting);
      const observer = i.observerStrength;
      const hemeOut = getOrInput('heme', init, prevOutputs, visiting);
      const ch0 = gateXOR([piCloud, observer]) * hemeOut;
      const ch1 = gateXOR([monazite, observer]) * i.leftD2;
      return _c(ch0 + ch1 * 0.5);
    }

    case 'clay_gouge': {
      // AND: LeftD2 + water_vapour
      const wv = getOrInput('water_vapour', init, prevOutputs, visiting);
      return _c(gateAND([i.leftD2, wv]) * i.clayGougeBias);
    }

    case 'sodium': {
      // 2 tristate: ECF (ch0, r/s) + AP (ch1, r/s)
      const wv = getOrInput('water_vapour', init, prevOutputs, visiting);
      const clPump = getOrInput('chlorine_ion_pump', init, prevOutputs, visiting);
      const observer = i.observerStrength;
      const aurora = getOrInput('aurora', init, prevOutputs, visiting);
      const hindInsula = getOrInput('hind_insula', init, prevOutputs, visiting);
      const ch0 = gateXOR([wv, observer]) * aurora;
      const ch1 = gateXOR([clPump, observer]) * hindInsula;
      return _c((ch0 + ch1) * i.sodiumBias);
    }

    case 'NaCl': {
      // 2 tristate: ionic (ch0, r/d) + evaporite (ch1, r/d)
      const autophagyR = getOrInput('autophagy', init, prevOutputs, visiting);
      const adapter = getOrInput('adapter_protein', init, prevOutputs, visiting);
      const observer = i.observerStrength;
      const sdh = getOrInput('succinate_dehydrogenase', init, prevOutputs, visiting);
      const ch0 = gateXOR([autophagyR, observer]) * sdh;
      const ch1 = gateXOR([adapter, observer]);
      return _c(ch0 * 0.6 + ch1 * 0.4);
    }

    case 'aurora': {
      // AND: sulforaphane.out1 + sodium.out1
      const sul = getOrInput('sulforaphane', init, prevOutputs, visiting);
      const sod = getOrInput('sodium', init, prevOutputs, visiting);
      return _c(gateAND([sul, sod]));
    }

    case 'fold_belt': {
      // 2 tristate: surficial (ch0, r/gamma) + deep (ch1, r/gamma)
      const carbonQBar = 1 - getOrInput('carbon', init, prevOutputs, visiting);
      const lactate = getOrInput('lactate_dehydrogenase', init, prevOutputs, visiting);
      const observer = i.observerStrength;
      const basin = getOrInput('basin', init, prevOutputs, visiting);
      const ch0 = gateXOR([carbonQBar, observer]) * (1 - basin);
      const ch1 = gateXOR([lactate, observer]) * getOrInput('oxidised_manganese', init, prevOutputs, visiting);
      return _c(ch0 * 0.6 + ch1 * 0.4);
    }

    case 'actomyosin': {
      // 2 tristate: contraction (ch0, r/d) + relaxation (ch1, r/d)
      const mycorr = getOrInput('mycorradicin', init, prevOutputs, visiting);
      const lateriteQBar = 1 - getOrInput('laterite', init, prevOutputs, visiting);
      const observer = i.observerStrength;
      const podzol = getOrInput('podzol', init, prevOutputs, visiting, 0.5);
      const caco3 = getOrInput('caco3', init, prevOutputs, visiting, 0.5);
      const ctrl0 = gateSRLatch(podzol, caco3, getOrInput('water', init, prevOutputs, visiting, 0.5), 0.5);
      const ch0 = gateXOR([mycorr, observer]) * ctrl0;
      const ch1 = gateXOR([lateriteQBar, observer]) * (1 - getOrInput('right_sole_dopamine', init, prevOutputs, visiting, 0.5));
      return _c((ch0 + ch1) * i.actomyosinBias);
    }

    case 'succinate_dehydrogenase': {
      // 3-output MUX: out0 (r/d), out1 (h), out2 (g/nu)
      const wv = getOrInput('water_vapour', init, prevOutputs, visiting);
      const actomyosin = getOrInput('actomyosin', init, prevOutputs, visiting);
      const caco3 = getOrInput('caco3', init, prevOutputs, visiting, 0.5);
      const out0 = gateMUX([wv, actomyosin], caco3);
      return _c(out0 * i.sdhBias);
    }

    case 'memory_entropy': {
      // 2-output decoder: hind_insula (r/h/nu) + co2 (p/nu)
      const cysteine = getOrInput('cysteine', init, prevOutputs, visiting);
      const mc1rQ = getOrInput('mc1r', init, prevOutputs, visiting);
      const actomyosin = getOrInput('actomyosin', init, prevOutputs, visiting);
      const logicHind = gateAND([actomyosin, cysteine]);
      const logicCo2 = gateAND([actomyosin, 1 - cysteine, mc1rQ]);
      // Blend both outputs
      return _c(logicHind * 0.6 + logicCo2 * 0.4 + i.memEntropyBias * 0.3);
    }

    case 'hind_insula': {
      // MUX: memory_entropy vs co2
      const memEntropy = getOrInput('memory_entropy', init, prevOutputs, visiting);
      const co2 = getOrInput('co2', init, prevOutputs, visiting);
      const sdh = getOrInput('succinate_dehydrogenase', init, prevOutputs, visiting);
      return _c(gateMUX([memEntropy, co2], sdh));
    }

    case 'glymphatic_system': {
      // AND: sulforaphane.out1 + mc1r_q
      const sul = getOrInput('sulforaphane', init, prevOutputs, visiting);
      const mc1rQ = getOrInput('mc1r', init, prevOutputs, visiting);
      return _c(gateAND([sul, mc1rQ]) * i.sulforaphaneBias);
    }

    case 'cysteine': {
      // AND: glymphatic + mc1r_q_bar
      const glymph = getOrInput('glymphatic_system', init, prevOutputs, visiting);
      const mc1rQBar = 1 - getOrInput('mc1r', init, prevOutputs, visiting);
      return _c(gateAND([glymph, mc1rQBar]));
    }

    case 'sulforaphane': {
      // 2 tristate: Nrf2 (ch0, g/nu) + GSH (ch1, g/nu)
      const histosol = getOrInput('histosol', init, prevOutputs, visiting);
      const oxytocin = getOrInput('male_right_oxytocin', init, prevOutputs, visiting, 0.5);
      const rsd = getOrInput('right_sole_dopamine', init, prevOutputs, visiting, 0.5);
      const sodium = getOrInput('sodium', init, prevOutputs, visiting);
      const ch0 = histosol * rsd;
      const ch1 = oxytocin * sodium;
      return _c((ch0 + ch1) * i.sulforaphaneBias);
    }

    case 'histosol': {
      // 2 tristate: peat (ch0, h) + fen (ch1, h)
      const foldBelt = getOrInput('fold_belt', init, prevOutputs, visiting);
      const piCloud = getOrInput('pi_electron_cloud', init, prevOutputs, visiting);
      const observer = i.observerStrength;
      const sul = getOrInput('sulforaphane', init, prevOutputs, visiting);
      const cambisol = getOrInput('cambisol', init, prevOutputs, visiting, 0.5);
      const ch0 = gateXOR([foldBelt, observer]) * sul;
      const ch1 = gateXOR([piCloud, observer]) * cambisol;
      return _c(ch0 * 0.6 + ch1 * 0.4);
    }

    case 'collagen': {
      // MUX: cambisol vs NaCl
      const cambisol = getOrInput('cambisol', init, prevOutputs, visiting, 0.5);
      const nacl = getOrInput('NaCl', init, prevOutputs, visiting);
      const sdh = getOrInput('succinate_dehydrogenase', init, prevOutputs, visiting);
      return _c(gateMUX([cambisol, nacl], sdh) * i.collagenBias);
    }

    case 'methionine': {
      // AND: collagen + copper_iron
      const coll = getOrInput('collagen', init, prevOutputs, visiting);
      const cuFe = getOrInput('copper_iron_complex', init, prevOutputs, visiting);
      return _c(gateAND([coll, cuFe]));
    }

    case 'copper_iron_complex': {
      // AND: histosol + cambisol
      const hist = getOrInput('histosol', init, prevOutputs, visiting);
      const camb = getOrInput('cambisol', init, prevOutputs, visiting, 0.5);
      return _c(gateAND([hist, camb]));
    }

    case 'cambisol': {
      // 2 tristate: young (ch0, h/g) + mature (ch1, h/g)
      const actomyosin = getOrInput('actomyosin', init, prevOutputs, visiting);
      const nitrogenase = getOrInput('nitrogenase', init, prevOutputs, visiting, 0.5);
      const observer = i.observerStrength;
      const lip = getOrInput('large_igneous_province', init, prevOutputs, visiting, 0.4);
      const ch0 = gateXOR([actomyosin, observer]) * lip;
      const ch1 = gateXOR([nitrogenase, observer]);
      return _c(ch0 * 0.5 + ch1 * 0.5);
    }

    case 'adapter_protein': {
      // D flip-flop: somatic signal adapter
      const d = getOrInput('methionine', init, prevOutputs, visiting);
      const clk = getOrInput('left_genital_d2', init, prevOutputs, visiting, 0.5);
      const enable = getOrInput('caco3', init, prevOutputs, visiting, 0.5);
      const preset = getOrInput('sodium', init, prevOutputs, visiting);
      const reset = getOrInput('right_sole_dopamine', init, prevOutputs, visiting, 0.5);
      return _c(gateDFF(d, clk, enable, preset, reset, 0.5));
    }

    case 'substance_p': {
      // 2-output decoder: mc1r (d/nu) + autophagy (d/nu)
      const met = getOrInput('methionine', init, prevOutputs, visiting);
      const adapter = getOrInput('adapter_protein', init, prevOutputs, visiting);
      const sdh = getOrInput('succinate_dehydrogenase', init, prevOutputs, visiting);
      const logicMc1r = gateAND([sdh, met]);
      const logicAutophagy = gateAND([sdh, 1 - met, 1 - adapter]);
      return _c(logicMc1r * 0.5 + logicAutophagy * 0.5 + i.substancePBias * 0.3);
    }

    case 'autophagy': {
      // tristate + SR latch + T flip-flop
      const mycorr = getOrInput('mycorradicin', init, prevOutputs, visiting);
      const mc1rQBar = 1 - getOrInput('mc1r', init, prevOutputs, visiting);
      const sp = getOrInput('substance_p', init, prevOutputs, visiting);
      const leftD2 = i.leftD2;
      // Bulk autophagy (ch0) vs SP-inflammatory
      const bulk = mycorr * mc1rQBar;
      const inflammatory = sp * (1 - leftD2);
      return _c(bulk * 0.6 + inflammatory * 0.4 + i.autophagyBias * 0.2);
    }

    case 'mycorradicin': {
      // 1 tristate: cambisol + carbon_q_bar
      const camb = getOrInput('cambisol', init, prevOutputs, visiting, 0.5);
      const carbonQBar = 1 - getOrInput('carbon', init, prevOutputs, visiting);
      return _c(camb * carbonQBar);
    }

    case 'ferritin': {
      // 2 tristate: storage (ch0) + mobilisation (ch1)
      const sulfurIron = getOrInput('sulfur_iron_complex', init, prevOutputs, visiting, 0.5);
      const disulfide = getOrInput('disulfide_bond', init, prevOutputs, visiting, 0.5);
      const observer = i.observerStrength;
      const laterite = getOrInput('laterite', init, prevOutputs, visiting, 0.5);
      const clPump = getOrInput('chlorine_ion_pump', init, prevOutputs, visiting, 0.5);
      const ch0 = gateXOR([sulfurIron, observer]) * laterite;
      const ch1 = gateXOR([disulfide, observer]) * clPump;
      return _c((ch0 + ch1) * i.ferritinBias);
    }

    case 'methylation': {
      // 2 tristate: SAM (ch0) + SAH (ch1)
      const ferritin = getOrInput('ferritin', init, prevOutputs, visiting);
      const heme = getOrInput('heme', init, prevOutputs, visiting);
      const observer = i.observerStrength;
      const ch0 = gateXOR([ferritin, observer]);
      const ch1 = gateXOR([heme, observer]) * i.leftD2;
      return _c(ch0 * 0.5 + ch1 * 0.5);
    }

    case 'pi_electron_cloud': {
      // MUX: thorium vs ferritin
      const thorium = getOrInput('thorium', init, prevOutputs, visiting, 0.4);
      const ferritin = getOrInput('ferritin', init, prevOutputs, visiting);
      return _c(gateMUX([thorium, ferritin], thorium));
    }

    case 'oxidised_manganese': {
      // SR latch + tristate
      const magnetite = getOrInput('magnetite', init, prevOutputs, visiting, 0.4);
      const heath = getOrInput('heath_aerenchyma', init, prevOutputs, visiting, 0.4);
      const co2 = getOrInput('co2', init, prevOutputs, visiting);
      const set = magnetite;
      const reset = heath;
      return _c(gateSRLatch(set, reset, co2, 0.5));
    }

    case 'manganese_oxygen_complex': {
      // 2 tristate: Mn-ROS (ch0) + Mn-peroxidase (ch1)
      const thorium = getOrInput('thorium', init, prevOutputs, visiting, 0.4);
      const histosol = getOrInput('histosol', init, prevOutputs, visiting);
      const methylation = getOrInput('methylation', init, prevOutputs, visiting);
      const foldBelt = getOrInput('fold_belt', init, prevOutputs, visiting);
      const ch0 = thorium * methylation;
      const ch1 = histosol * foldBelt;
      return _c(ch0 * 0.5 + ch1 * 0.5);
    }

    case 'manganese_nodule': {
      // SR latch: glymphatic sets, cambisol resets, gluon_orogen enables
      const glymph = getOrInput('glymphatic_system', init, prevOutputs, visiting);
      const cambisol = getOrInput('cambisol', init, prevOutputs, visiting, 0.5);
      const gluonOrogen = getOrInput('gluon_orogen', init, prevOutputs, visiting, 0.4);
      return _c(gateSRLatch(glymph, cambisol, gluonOrogen, 0.5));
    }

    case 'chlorine_ion_pump': {
      // tristate + SR latch
      const podzol = getOrInput('podzol', init, prevOutputs, visiting, 0.4);
      const mnO = getOrInput('manganese_oxygen_complex', init, prevOutputs, visiting);
      const sodium = getOrInput('sodium', init, prevOutputs, visiting);
      const water = getOrInput('water', init, prevOutputs, visiting, 0.5);
      const ch0 = podzol * (1 - mnO);
      return _c(ch0 * 0.7);
    }

    case 'heath_aerenchyma': {
      const clPump = getOrInput('chlorine_ion_pump', init, prevOutputs, visiting);
      const carbonQ = getOrInput('carbon', init, prevOutputs, visiting);
      return _c(clPump * carbonQ);
    }

    case 'sulfur_iron_complex': {
      // 2 tristate: FeS2 (ch0) + Fe-S oxidised (ch1)
      const pra = getOrInput('right_progesterone_pra', init, prevOutputs, visiting, 0.4);
      const actomyosin = getOrInput('actomyosin', init, prevOutputs, visiting);
      const oxytocinQBar = 1 - getOrInput('male_right_oxytocin', init, prevOutputs, visiting, 0.5);
      const disulfide = getOrInput('disulfide_bond', init, prevOutputs, visiting, 0.5);
      const ch0 = gateAND([pra, actomyosin]);
      const ch1 = oxytocinQBar * disulfide;
      return _c(ch0 * 0.6 + ch1 * 0.4);
    }

    case 'lactate_dehydrogenase': {
      // 3-input MUX
      const lowerMantleQBar = 1 - getOrInput('lower_mantle', init, prevOutputs, visiting, 0.5);
      const foldBelt = getOrInput('fold_belt', init, prevOutputs, visiting);
      const autophagy = getOrInput('autophagy', init, prevOutputs, visiting);
      const ctrl0 = getOrInput('left_genital_d2', init, prevOutputs, visiting, 0.5);
      const ctrl1 = i.observerStrength;
      // Simplified: blend based on ctrl states
      if (ctrl1 > 0.5) return _c(autophagy * 0.7);
      if (ctrl0 > 0.5) return _c(foldBelt * 0.7);
      return _c(lowerMantleQBar * 0.7);
    }

    case 'glp1': {
      // D flip-flop
      const d = getOrInput('sodium', init, prevOutputs, visiting);
      const clk = getOrInput('manganese_nodule', init, prevOutputs, visiting);
      const enable = i.observerStrength;
      const preset = getOrInput('pyrite', init, prevOutputs, visiting, 0.4);
      const reset = getOrInput('pi_electron_cloud', init, prevOutputs, visiting);
      return _c(gateDFF(d, clk, enable, preset, reset, 0.5));
    }

    case 'cck': {
      // MUX: ferritin-H vs pyrite
      const ferritin = getOrInput('ferritin', init, prevOutputs, visiting);
      const pyrite = getOrInput('pyrite', init, prevOutputs, visiting, 0.4);
      const glp1 = getOrInput('glp1', init, prevOutputs, visiting);
      return _c(gateMUX([ferritin, pyrite], glp1));
    }

    case 'right_sole_dopamine': {
      // D flip-flop
      const d = getOrInput('pyrite', init, prevOutputs, visiting, 0.4);
      const clk = getOrInput('left_genital_d2', init, prevOutputs, visiting, 0.5);
      const enable = getOrInput('subduction_zone', init, prevOutputs, visiting, 0.4);
      const preset = 1 - getOrInput('adapter_protein', init, prevOutputs, visiting);
      const reset = i.leftD2;
      return _c(gateDFF(d, clk, enable, preset, reset, 0.5));
    }

    case 'male_right_oxytocin': {
      // D flip-flop: rSMG moral corrector
      const d = getOrInput('peonidine', init, prevOutputs, visiting, 0.4);
      const clk = getOrInput('actomyosin', init, prevOutputs, visiting);
      const enable = getOrInput('left_genital_d2', init, prevOutputs, visiting, 0.5);
      const preset = getOrInput('succinate_dehydrogenase', init, prevOutputs, visiting);
      const reset = i.leftD2;
      return _c(gateDFF(d, clk, enable, preset, reset, 0.5));
    }

    case 'right_acetylcholine': {
      // MUX: COX vs right_sole_dopamine
      const cox = getOrInput('cytochrome_c_oxidase', init, prevOutputs, visiting);
      const rsd = getOrInput('right_sole_dopamine', init, prevOutputs, visiting, 0.5);
      const sdh = getOrInput('succinate_dehydrogenase', init, prevOutputs, visiting);
      return _c(gateMUX([cox, rsd], sdh));
    }

    case 'peonidine': {
      // 2 tristate: free anthocyanin (ch0) + conjugate (ch1)
      const cysteine = getOrInput('cysteine', init, prevOutputs, visiting);
      const disulfide = getOrInput('disulfide_bond', init, prevOutputs, visiting, 0.5);
      const observer = i.observerStrength;
      const mnNodule = getOrInput('manganese_nodule', init, prevOutputs, visiting);
      const methanogenesis = getOrInput('methanogenesis', init, prevOutputs, visiting, 0.4);
      const ch0 = gateXOR([cysteine, observer]) * mnNodule;
      const ch1 = gateXOR([disulfide, observer]) * methanogenesis;
      return _c(ch0 * 0.5 + ch1 * 0.5);
    }

    case 'pentose_phosphate': {
      // 2-output decoder
      const peonidine = getOrInput('peonidine', init, prevOutputs, visiting);
      const sul = getOrInput('sulforaphane', init, prevOutputs, visiting);
      const adapter = getOrInput('adapter_protein', init, prevOutputs, visiting);
      const logic1 = gateAND([adapter, peonidine]);
      const logic2 = gateAND([adapter, 1 - peonidine, sul]);
      return _c(logic1 * 0.5 + logic2 * 0.5);
    }

    case 'disulfide_bond': {
      // NAND: PPP + peonidine
      const ppp = getOrInput('pentose_phosphate', init, prevOutputs, visiting);
      const peonidine = getOrInput('peonidine', init, prevOutputs, visiting);
      return _c(gateNAND([ppp, peonidine]));
    }

    case 'methanogenesis': {
      // MUX: pyrite vs right_acetylcholine
      const pyrite = getOrInput('pyrite', init, prevOutputs, visiting, 0.4);
      const ach = getOrInput('right_acetylcholine', init, prevOutputs, visiting);
      const carbonQ = getOrInput('carbon', init, prevOutputs, visiting);
      return _c(gateMUX([pyrite, ach], carbonQ));
    }

    case 'pyrite': {
      // 2 tristate: framboidal (ch0) + massive (ch1)
      const collagen = getOrInput('collagen', init, prevOutputs, visiting);
      const lip = getOrInput('large_igneous_province', init, prevOutputs, visiting, 0.4);
      const observer = i.observerStrength;
      const ppp = getOrInput('pentose_phosphate', init, prevOutputs, visiting);
      const craton = getOrInput('craton', init, prevOutputs, visiting, 0.4);
      const ch0 = gateXOR([collagen, observer]) * ppp;
      const ch1 = gateXOR([lip, observer]) * craton;
      return _c(ch0 * 0.5 + ch1 * 0.5);
    }

    case 'water': {
      // MUX: sulfur_iron vs LIP
      const sulfurIron = getOrInput('sulfur_iron_complex', init, prevOutputs, visiting, 0.4);
      const lip = getOrInput('large_igneous_province', init, prevOutputs, visiting, 0.4);
      const autophagy = getOrInput('autophagy', init, prevOutputs, visiting);
      return _c(gateMUX([sulfurIron, lip], autophagy));
    }

    case 'large_igneous_province': {
      // 2 tristate
      const heme = getOrInput('heme', init, prevOutputs, visiting);
      const mnNoduleQBar = 1 - getOrInput('manganese_nodule', init, prevOutputs, visiting);
      const observer = i.observerStrength;
      const rsdQBar = 1 - getOrInput('right_sole_dopamine', init, prevOutputs, visiting, 0.5);
      const ch0 = gateXOR([heme, observer]);
      const ch1 = gateXOR([mnNoduleQBar, observer]) * rsdQBar;
      return _c(ch0 * 0.5 + ch1 * 0.5);
    }

    case 'subduction_zone': {
      // 2 tristate
      const lip = getOrInput('large_igneous_province', init, prevOutputs, visiting, 0.4);
      const monazite = getOrInput('monazite', init, prevOutputs, visiting, 0.4);
      const observer = i.observerStrength;
      const lowerMantle = getOrInput('lower_mantle', init, prevOutputs, visiting, 0.4);
      const basinQBar = 1 - getOrInput('basin', init, prevOutputs, visiting, 0.5);
      const ch0 = gateXOR([lip, observer]) * lowerMantle;
      const ch1 = gateXOR([monazite, observer]) * basinQBar;
      return _c(ch0 * 0.5 + ch1 * 0.5);
    }

    case 'lower_mantle': {
      // D flip-flop
      const d = getOrInput('basin', init, prevOutputs, visiting, 0.5);
      const clk = getOrInput('methylation', init, prevOutputs, visiting);
      const enable = getOrInput('gluon_orogen', init, prevOutputs, visiting, 0.4);
      const preset = getOrInput('plume', init, prevOutputs, visiting, 0.3);
      const reset = getOrInput('outer_core_convection', init, prevOutputs, visiting, 0.3);
      return _c(gateDFF(d, clk, enable, preset, reset, 0.5));
    }

    case 'basin': {
      // D flip-flop
      const d = getOrInput('quark_orogen_magma', init, prevOutputs, visiting, 0.4);
      const clk = getOrInput('male_right_oxytocin', init, prevOutputs, visiting, 0.5);
      const enable = 1 - getOrInput('lower_mantle', init, prevOutputs, visiting, 0.5);
      const preset = getOrInput('craton', init, prevOutputs, visiting, 0.4);
      const reset = getOrInput('subduction_zone', init, prevOutputs, visiting, 0.4);
      return _c(gateDFF(d, clk, enable, preset, reset, 0.5));
    }

    case 'craton': {
      // 2 tristate
      const glp1QBar = 1 - getOrInput('glp1', init, prevOutputs, visiting);
      const outerCore = getOrInput('outer_core_convection', init, prevOutputs, visiting, 0.3);
      const observer = i.observerStrength;
      const caco3 = getOrInput('caco3', init, prevOutputs, visiting, 0.5);
      const ch0 = gateXOR([glp1QBar, observer]);
      const ch1 = gateXOR([outerCore, observer]) * caco3;
      return _c(ch0 * 0.5 + ch1 * 0.5);
    }

    case 'gluon_orogen': {
      // D flip-flop
      const d = getOrInput('male_right_oxytocin', init, prevOutputs, visiting, 0.5);
      const clk = getOrInput('lactate_dehydrogenase', init, prevOutputs, visiting);
      const enable = getOrInput('quark_orogen_magma', init, prevOutputs, visiting, 0.4);
      const preset = getOrInput('subduction_zone', init, prevOutputs, visiting, 0.4);
      const reset = 1 - getOrInput('male_right_oxytocin', init, prevOutputs, visiting, 0.5);
      return _c(gateDFF(d, clk, enable, preset, reset, 0.5));
    }

    case 'quark_orogen_magma': {
      // 1 tristate
      const nitrogenase = getOrInput('nitrogenase', init, prevOutputs, visiting, 0.4);
      const piCloud = getOrInput('pi_electron_cloud', init, prevOutputs, visiting);
      return _c(nitrogenase * (1 - piCloud) * 0.7);
    }

    case 'nitrogenase': {
      // 2-output decoder
      const laterite = getOrInput('laterite', init, prevOutputs, visiting, 0.4);
      const cuFe = getOrInput('copper_iron_complex', init, prevOutputs, visiting);
      const basin = getOrInput('basin', init, prevOutputs, visiting, 0.5);
      const logic1 = gateAND([basin, laterite]);
      const logic2 = gateAND([basin, 1 - laterite, cuFe]);
      return _c(logic1 * 0.5 + logic2 * 0.5);
    }

    case 'laterite': {
      // D flip-flop
      const d = getOrInput('caco3', init, prevOutputs, visiting, 0.5);
      const clk = getOrInput('sodium', init, prevOutputs, visiting);
      const enable = getOrInput('steel', init, prevOutputs, visiting);
      const preset = getOrInput('magnetite', init, prevOutputs, visiting, 0.4);
      const reset = getOrInput('plume', init, prevOutputs, visiting, 0.3);
      return _c(gateDFF(d, clk, enable, preset, reset, 0.5));
    }

    case 'thorium': {
      // MUX: monazite vs oxidised_manganese
      const monazite = getOrInput('monazite', init, prevOutputs, visiting, 0.4);
      const mnO = getOrInput('oxidised_manganese', init, prevOutputs, visiting);
      const nacl = getOrInput('NaCl', init, prevOutputs, visiting);
      return _c(gateMUX([monazite, mnO], nacl));
    }

    case 'magnetite': {
      // MUX: methylation vs quark_orogen_magma
      const methylation = getOrInput('methylation', init, prevOutputs, visiting);
      const magma = getOrInput('quark_orogen_magma', init, prevOutputs, visiting, 0.4);
      const glymph = getOrInput('glymphatic_system', init, prevOutputs, visiting);
      return _c(gateMUX([methylation, magma], glymph));
    }

    case 'monazite': {
      // MUX: mangrove vs caco3
      const mangrove = getOrInput('mangrove_aerenchyma', init, prevOutputs, visiting, 0.3);
      const caco3 = getOrInput('caco3', init, prevOutputs, visiting, 0.5);
      const wv = getOrInput('water_vapour', init, prevOutputs, visiting);
      return _c(gateMUX([mangrove, caco3], wv));
    }

    case 'plume': {
      // MUX: left_endorphin vs water
      const endorphin = i.observerStrength;
      const water = getOrInput('water', init, prevOutputs, visiting, 0.4);
      const craton = getOrInput('craton', init, prevOutputs, visiting, 0.4);
      return _c(gateMUX([endorphin, water], craton));
    }

    case 'outer_core_convection': {
      // AND: subduction + water
      const sub = getOrInput('subduction_zone', init, prevOutputs, visiting, 0.4);
      const water = getOrInput('water', init, prevOutputs, visiting, 0.4);
      return _c(gateAND([sub, water]));
    }

    case 'left_genital_d2': {
      // MUX: aurora vs craton
      const aurora = getOrInput('aurora', init, prevOutputs, visiting);
      const craton = getOrInput('craton', init, prevOutputs, visiting, 0.4);
      return _c(gateMUX([aurora, craton], i.leftD2));
    }

    case 'caco3': {
      // MUX: pyrite vs lactate
      const pyrite = getOrInput('pyrite', init, prevOutputs, visiting, 0.4);
      const lactate = getOrInput('lactate_dehydrogenase', init, prevOutputs, visiting);
      return _c(gateMUX([pyrite, lactate], i.leftD2));
    }

    case 'mangrove_aerenchyma': {
      // AND: fold_belt + autophagy
      const foldBelt = getOrInput('fold_belt', init, prevOutputs, visiting);
      const autophagy = getOrInput('autophagy', init, prevOutputs, visiting);
      return _c(gateAND([foldBelt, autophagy]));
    }

    case 'podzol': {
      // MUX: lower_mantle vs andosol
      const lowerMantle = getOrInput('lower_mantle', init, prevOutputs, visiting, 0.4);
      const andosol = getOrInput('andosol', init, prevOutputs, visiting, 0.4);
      const sdh = getOrInput('succinate_dehydrogenase', init, prevOutputs, visiting);
      return _c(gateMUX([lowerMantle, andosol], sdh));
    }

    case 'andosol': {
      // MUX: fold_belt vs oxidised_manganese
      const foldBelt = getOrInput('fold_belt', init, prevOutputs, visiting);
      const mnO = getOrInput('oxidised_manganese', init, prevOutputs, visiting);
      const sdh = getOrInput('succinate_dehydrogenase', init, prevOutputs, visiting);
      return _c(gateMUX([foldBelt, mnO], sdh));
    }

    case 'right_progesterone_pra': {
      // 2-output decoder
      const met = getOrInput('methionine', init, prevOutputs, visiting);
      const cuFe = getOrInput('copper_iron_complex', init, prevOutputs, visiting);
      const methanogenesis = getOrInput('methanogenesis', init, prevOutputs, visiting, 0.4);
      const logic = gateAND([methanogenesis, 1 - met, cuFe]);
      return _c(logic);
    }

    case 'left_endorphin_electron_neutrino': {
      // AND: LeftD2 + left_genital_d2 + none_observer
      const lgd2 = getOrInput('left_genital_d2', init, prevOutputs, visiting, 0.5);
      return _c(gateAND([i.leftD2, 1 - lgd2, i.observerStrength]));
    }

    case 'left_endorphin_non_observer':
      return _c(gateAND([i.observerStrength, i.leftD2, 1 - i.carbonQ]));

    case 'none_observer':
      return _c(gateAND([i.observerStrength, i.co2Bias]));

    default:
      return 0.5;
  }
}

// Helper: get node output with fallback and cycle detection
// Uses a per-call visiting set to detect cycles in the circuit graph
// When a cycle is detected, cache the fallback so subsequent lookups don't re-enter
function getOrInput(nodeName, init, prevOutputs, visiting, fallback) {
  if (nodeName in prevOutputs) return prevOutputs[nodeName];
  const fb = fallback !== undefined ? fallback : _initDefault(nodeName, init);
  if (visiting.has(nodeName)) {
    prevOutputs[nodeName] = fb;
    return fb;
  }
  visiting.add(nodeName);
  const val = simulateNode(nodeName, init, prevOutputs, visiting);
  visiting.delete(nodeName);
  if (val === undefined || val === null || isNaN(val)) {
    prevOutputs[nodeName] = fb;
    return fb;
  }
  prevOutputs[nodeName] = val;
  return val;
}

// Provide init-based default values for nodes when cycles prevent full evaluation
// These are direction-based fallbacks: each node's default reflects the direction
// of its primary upstream input, not a flat 0.5
function _initDefault(nodeName, init) {
  const i = init;
  switch (nodeName) {
    // Core state nodes — use init directly
    case 'LeftD2': return i.leftD2;
    case 'carbon': return i.carbonQ;
    case 'mc1r': return i.mc1rQ;
    case 'co2': return i.co2Bias;
    case 'heme': return i.hemeBias;
    case 'sodium': return i.sodiumBias;
    case 'actomyosin': return i.actomyosinBias;
    case 'autophagy': return i.autophagyBias;
    case 'succinate_dehydrogenase': return i.sdhBias;
    case 'memory_entropy': return i.memEntropyBias;
    case 'substance_p': return i.substancePBias;
    case 'clay_gouge': return i.clayGougeBias;
    case 'collagen': return i.collagenBias;
    case 'sulforaphane': return i.sulforaphaneBias;
    case 'ferritin': return i.ferritinBias;
    case 'left_endorphin_non_observer': return i.observerStrength;
    case 'left_endorphin_electron_neutrino': return i.observerStrength * i.leftD2;
    case 'none_observer': return i.observerStrength * i.leftD2;

    // Energy pathway direction-based defaults
    case 'cytochrome_c_oxidase': return i.hemeBias * 0.7 + i.co2Bias * 0.3;
    case 'water_vapour': return i.clayGougeBias * 0.5 + i.sdhBias * 0.5;
    case 'steel': return i.hemeBias * 0.6 + i.leftD2 * 0.4;
    case 'NaCl': return i.autophagyBias * 0.4 + i.sdhBias * 0.6;
    case 'aurora': return i.sulforaphaneBias * i.sodiumBias;
    case 'fold_belt': return i.actomyosinBias * 0.5 + i.co2Bias * 0.5;
    case 'methylation': return i.ferritinBias * 0.5 + i.hemeBias * 0.5;
    case 'pi_electron_cloud': return i.ferritinBias * 0.6 + i.leftD2 * 0.4;
    case 'chlorine_ion_pump': return i.sodiumBias * 0.6;
    case 'heath_aerenchyma': return i.chlorine_ion_pump ? i.chlorine_ion_pump : (i.sodiumBias * i.carbonQ);
    case 'mangrove_aerenchyma': return i.actomyosinBias * i.autophagyBias;
    case 'water': return i.autophagyBias * 0.5 + i.sdhBias * 0.5;
    case 'large_igneous_province': return i.hemeBias * 0.5;
    case 'subduction_zone': return i.hemeBias * 0.4;
    case 'outer_core_convection': return i.hemeBias * 0.3;
    case 'lower_mantle': return i.sdhBias * 0.5;
    case 'basin': return i.leftD2 * 0.5;
    case 'craton': return i.leftD2 * 0.5 + i.carbonQ * 0.5;
    case 'plume': return i.observerStrength * 0.5;
    case 'gluon_orogen': return i.actomyosinBias * 0.5;
    case 'quark_orogen_magma': return i.autophagyBias * 0.5;
    case 'nitrogenase': return i.actomyosinBias * 0.5;
    case 'laterite': return i.carbonQ * 0.5 + i.sodiumBias * 0.5;
    case 'thorium': return i.ferritinBias * 0.4;
    case 'magnetite': return i.ferritinBias * 0.5;
    case 'monazite': return i.ferritinBias * 0.3;
    case 'oxidised_manganese': return i.ferritinBias * 0.5 + i.hemeBias * 0.5;
    case 'manganese_oxygen_complex': return i.ferritinBias * 0.4 + i.hemeBias * 0.4;
    case 'manganese_nodule': return i.sulforaphaneBias * 0.5;
    case 'pyrite': return i.collagenBias * 0.5;
    case 'sulfur_iron_complex': return i.actomyosinBias * 0.5;

    // Information pathway direction-based defaults
    case 'glymphatic_system': return i.sulforaphaneBias * i.mc1rQ;
    case 'cysteine': return i.sulforaphaneBias * (1 - i.mc1rQ);
    case 'hind_insula': return i.memEntropyBias * 0.6 + i.co2Bias * 0.4;
    case 'histosol': return i.sulforaphaneBias * 0.5;
    case 'copper_iron_complex': return i.collagenBias * 0.5;
    case 'methionine': return i.collagenBias * 0.6;
    case 'adapter_protein': return i.carbonQ * 0.5 + i.sodiumBias * 0.5;
    case 'peonidine': return i.sulforaphaneBias * 0.4;
    case 'pentose_phosphate': return i.sulforaphaneBias * 0.4;
    case 'disulfide_bond': return i.sulforaphaneBias * 0.3;
    case 'andosol': return i.actomyosinBias * 0.4;
    case 'cambisol': return i.actomyosinBias * 0.5;
    case 'right_acetylcholine': return i.hemeBias * 0.5;
    case 'glp1': return i.sodiumBias * 0.5;
    case 'cck': return i.ferritinBias * 0.5;
    case 'right_sole_dopamine': return i.leftD2 * 0.5;
    case 'male_right_oxytocin': return i.actomyosinBias * 0.5;
    case 'right_progesterone_pra': return i.collagenBias * 0.3;

    // Repair pathway direction-based defaults
    case 'lactate_dehydrogenase': return i.actomyosinBias * 0.4 + i.autophagyBias * 0.4;
    case 'mycorradicin': return i.autophagyBias * (1 - i.carbonQ);

    // Observer nodes
    case 'left_genital_d2': return i.leftD2 * 0.6;

    default: return 0.5;
  }
}

// Main export: simulate a tile pathway and derive 8D vector
// Uses iterative relaxation: initialize all nodes with init-based defaults,
// then iterate through pathway multiple times to propagate signals forward.
// This handles cyclic dependencies naturally without cutting paths.
export function simulateTilePathway(pathwayName, init) {
  const pathway = TILE_PATHWAYS[pathwayName] || TILE_PATHWAYS.energy;
  const outputs = {};
  const visiting = new Set();

  // Phase 1: Initialize all nodes with init-based defaults
  for (const nodeName of pathway) {
    outputs[nodeName] = _initDefault(nodeName, init);
  }

  // Phase 2: Iterative relaxation — re-evaluate each node using current outputs
  // 3 passes is sufficient for steady-state convergence in this circuit
  const PASSES = 3;
  for (let pass = 0; pass < PASSES; pass++) {
    for (const nodeName of pathway) {
      visiting.clear();
      const val = simulateNode(nodeName, init, outputs, visiting);
      if (val !== undefined && !isNaN(val)) {
        outputs[nodeName] = val;
      }
    }
  }

  // Phase 3: Collect dim contributions from all pathway nodes
  const dimAccumulators = { r: [], h: [], d: [], p: [], s: [], gamma: [], g: [], nu: [] };
  for (const nodeName of pathway) {
    const val = outputs[nodeName];
    if (val === undefined || isNaN(val)) continue;

    const dimMap = NODE_DIM_MAP[nodeName];
    if (dimMap) {
      for (const [dim, channel] of dimMap.dims) {
        if (dimAccumulators[dim]) {
          dimAccumulators[dim].push(val * dimMap.weight);
        }
      }
    }
  }

  // Derive 8D vector from accumulated node outputs
  const vec = {};
  for (const dim of ['r', 'h', 'd', 'p', 's', 'gamma', 'g', 'nu']) {
    const contribs = dimAccumulators[dim];
    if (contribs.length > 0) {
      vec[dim] = _c(contribs.reduce((a, b) => a + b, 0) / contribs.length);
    } else {
      vec[dim] = 0.5;
    }
  }

  return vec;
}

// Export the profile-to-init mapping for use by attractor_tiles.js
export { profileToCircuitInit, TILE_PATHWAYS, NODE_DIM_MAP };
