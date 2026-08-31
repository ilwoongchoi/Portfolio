// ─────────────────────────────────────────────────────────────
// app.js — UI wiring for the tile-testing skeleton.
// NO TEXT LABELS in the music program. No genre names, no parameter
// names, no MBTI letters. Tiles are identified by COLOR ONLY —
// random, non-semantic colors. Users listen and pick, nothing else.
// ─────────────────────────────────────────────────────────────
import { AudioEngine } from './audio.js';
import { timbreFromVector, fmFromVector, voicingFromVector, dissonanceFromVector, octaveLayersFromVector, reverbFromVector, rhythmFromVector, hysteresisFromClock, melodicContourFromPhase, scaleFromABO, chordVoicingFromG, patternDepthFromNu, rhythmEmphasisFromGender, profileToVector } from './engine.js';
import { CalibrationPad } from './calibration.js';
import { AttractorTileSystem } from './attractor_tiles.js';
import { HybridTileScheduler } from './hybrid_scheduler.js';
import { BayesCalibrator } from './calibration_bayes.js';

const engine = new AudioEngine();
const calib = new CalibrationPad();
const attractorSystem = new AttractorTileSystem();
const scheduler = new HybridTileScheduler(attractorSystem);
const bayes = new BayesCalibrator();
let tiles = [];
let idCounter = 0;

const DIMS = ['r', 'h', 'd', 'p', 's', 'gamma', 'g', 'nu'];

// Deterministic color from a vector — no semantic meaning, just identification.
// Hue derived from vector hash, saturation/lightness fixed.
function vecToColor(vec) {
  let hash = 0;
  for (const d of DIMS) hash = ((hash * 31) + Math.floor((vec[d] ?? 0.5) * 255)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 50%)`;
}

function newTile() {
  const vec = { r: 0.5, h: 0.5, d: 0.5, p: 0.5, s: 0.5, gamma: 0.5, g: 0.5, nu: 0.5 };
  calib.recordTile(vec);
  return {
    id: ++idCounter,
    midi: 60,
    abo: 'O',
    gender: 'M',
    start: tiles.length ? tiles[tiles.length - 1].start + tiles[tiles.length - 1].duration : 0,
    duration: 2,
    vec
  };
}

function renderTileList() {
  const list = document.getElementById('tile-list');
  list.innerHTML = '';
  tiles.forEach(tile => {
    const card = document.createElement('div');
    card.className = 'tile-card';
    card.style.borderLeft = `4px solid ${vecToColor(tile.vec)}`;

    const header = document.createElement('div');
    header.className = 'tile-header';

    // Color swatch — no text label
    const swatch = document.createElement('div');
    swatch.style.cssText = `width:24px;height:24px;border-radius:4px;background:${vecToColor(tile.vec)};flex-shrink:0`;

    const delBtn = document.createElement('button');
    delBtn.textContent = '✕';
    delBtn.className = 'del-btn';
    delBtn.onclick = () => { tiles = tiles.filter(t => t.id !== tile.id); renderTileList(); drawTimeline(); };

    header.appendChild(swatch);
    header.appendChild(delBtn);
    card.appendChild(header);

    // Attractor type indicator — color only, no text
    if (tile.attractorType) {
      const attractorColors = {
        energy: '#ff6b6b', information: '#4ecdc4', repair: '#45b7d1',
        interface: '#f9ca24', integration: '#6c5ce7'
      };
      const attractorDot = document.createElement('div');
      attractorDot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${attractorColors[tile.attractorType] || '#888'};margin-bottom:4px`;
      card.appendChild(attractorDot);
    }

    const previewBtnTop = document.createElement('button');
    previewBtnTop.textContent = '▶ PLAY THIS TILE';
    previewBtnTop.className = 'preview-btn-top';
    previewBtnTop.onclick = () => {
      try {
        console.log('[skeleton] PLAY THIS TILE', tile.id, tile.vec, tile.attractorType);
        engine.playTile(tile, engine.now() + 0.05, tile.duration);
        
        // Update attractor states based on played tile
        if (tile.attractorType) {
          attractorSystem.updateFromPlayedTile(tile);
          renderAttractorStates();
        }
      } catch (err) {
        console.error('[skeleton] playTile threw', err);
      }
    };
    card.appendChild(previewBtnTop);

    const timing = document.createElement('div');
    timing.className = 'timing-row';
    timing.innerHTML = `
      <input type="number" step="0.1" min="0" value="${tile.start}" class="start-input">
      <input type="number" step="0.1" min="0.1" value="${tile.duration}" class="dur-input">
      <input type="number" step="1" min="24" max="96" value="${tile.midi}" class="midi-input">
    `;
    timing.querySelector('.start-input').oninput = (e) => { tile.start = parseFloat(e.target.value) || 0; drawTimeline(); };
    timing.querySelector('.dur-input').oninput = (e) => { tile.duration = parseFloat(e.target.value) || 0.1; drawTimeline(); };
    timing.querySelector('.midi-input').oninput = (e) => { tile.midi = parseInt(e.target.value) || 60; };
    card.appendChild(timing);

    const sliders = document.createElement('div');
    sliders.className = 'sliders';
    DIMS.forEach(dim => {
      const row = document.createElement('div');
      row.className = 'slider-row';
      // Color dot for each dimension — no text label
      const dot = document.createElement('div');
      const dimHue = (DIMS.indexOf(dim) * 47) % 360;
      dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:hsl(${dimHue},60%,50%);flex-shrink:0`;
      const valSpan = document.createElement('span');
      valSpan.className = 'slider-val';
      valSpan.textContent = tile.vec[dim].toFixed(2);
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = 0; slider.max = 1; slider.step = 0.01;
      slider.value = tile.vec[dim];
      slider.oninput = () => {
        tile.vec[dim] = parseFloat(slider.value);
        valSpan.textContent = tile.vec[dim].toFixed(2);
        calib.recordSliderChange(dim, tile.vec[dim]);
        const sw = card.querySelector('.tile-header > div:first-child');
        if (sw) sw.style.background = vecToColor(tile.vec);
        card.style.borderLeft = `4px solid ${vecToColor(tile.vec)}`;
      };
      row.appendChild(dot);
      row.appendChild(slider);
      row.appendChild(valSpan);
      sliders.appendChild(row);
    });
    card.appendChild(sliders);

    list.appendChild(card);
  });
}

// No text instrument label — removed per user request. Colors only.

function drawTimeline() {
  const canvas = document.getElementById('timeline-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const maxEnd = Math.max(4, ...tiles.map(t => t.start + t.duration));
  const pxPerSec = canvas.width / maxEnd;
  const rowH = 40;

  tiles.forEach((tile, i) => {
    const x = tile.start * pxPerSec;
    const w = tile.duration * pxPerSec;
    const y = (i % 4) * rowH + 8;
    const hue = (tile.vec.g * 200 + tile.vec.nu * 100) % 360;
    ctx.fillStyle = `hsl(${hue}, 55%, 45%)`;
    ctx.fillRect(x, y, Math.max(2, w - 2), rowH - 8);
    ctx.fillStyle = '#eee';
    ctx.font = '10px monospace';
    ctx.fillText(`#${tile.id}`, x + 4, y + 14);
  });

  // playhead
  if (window._playheadTime != null) {
    const px = window._playheadTime * pxPerSec;
    ctx.strokeStyle = '#ff5555';
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, canvas.height);
    ctx.stroke();
  }
}

function playAll() {
  if (!tiles.length) return;
  const startCtxTime = engine.now() + 0.1;
  const maxEnd = Math.max(...tiles.map(t => t.start + t.duration));
  
  // Schedule attractor state updates with each tile
  tiles.forEach(tile => {
    engine.playTile(tile, startCtxTime + tile.start, tile.duration);
    
    // Update attractor states when tile plays
    setTimeout(() => {
      if (tile.attractorType) {
        attractorSystem.updateFromPlayedTile(tile);
        renderAttractorStates();
      }
    }, tile.start * 1000);
  });
  
  const t0 = performance.now();
  const anim = () => {
    const elapsed = (performance.now() - t0) / 1000;
    window._playheadTime = elapsed;
    drawTimeline();
    if (elapsed < maxEnd) requestAnimationFrame(anim);
    else window._playheadTime = null;
  };
  requestAnimationFrame(anim);
}

function stopAll() {
  engine.stopAll();
  window._playheadTime = null;
  drawTimeline();
}

document.getElementById('add-tile-btn').onclick = () => {
  // Get current profile from calibration
  const profile = calib.getCurrentProfile() || { mbti: 'INTP', gender: 'M', blood: 'O', layer: 'A' };
  
  // Get context for scheduling
  const currentTime = new Date();
  const previousTrack = tiles.length > 0 ? tiles[tiles.length - 1] : null;
  const slotPosition = tiles.length;
  
  // Generate hybrid tile (scheduling + attractor)
  const hybridTile = scheduler.generateScheduledTile(profile, currentTime, previousTrack, slotPosition);
  const plan = hybridTile.plan;
  const tileVec = plan?.vec ? { ...plan.vec } : { ...hybridTile.vec };
  const duration = plan?.duration ?? 2;
  const startTime = tiles.length ? tiles[tiles.length - 1].start + tiles[tiles.length - 1].duration : 0;
  const tileEntry = {
    id: ++idCounter,
    midi: plan?.scale?.rootMidi ?? 60,
    abo: plan?.abo || profile.blood || 'O',
    gender: plan?.gender || profile.gender || 'M',
    start: startTime,
    duration,
    vec: tileVec,
    schedulingType: hybridTile.schedulingType,
    attractorType: hybridTile.attractorType,
    _plan: plan
  };
  tiles.push(tileEntry);
  
  renderTileList();
  drawTimeline();
};
document.getElementById('play-btn').onclick = playAll;
document.getElementById('stop-btn').onclick = stopAll;

// ── Calibration: Bayesian tile-pick system ──────────────────────
// No text labels. User listens to tiles, picks what sounds good.
// BayesCalibrator infers 128 profile from pick trajectory.
// CalibrationPad still runs in background for behavioral layer inference.

function updateCalibrationUI() {
  const el = document.getElementById('calib-summary');
  if (!el) return;
  const calibrated = calib.currentProfile != null;
  el.innerHTML = calibrated
    ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#5dba5d"></span>`
    : `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#666"></span>`;
}
document.getElementById('calib-reset-btn').onclick = () => {
  localStorage.removeItem('circuit-calibration');
  bayes.reset();
  calib.currentProfile = null;
  updateCalibrationUI();
};

// Bayesian calibration state
let bayesRound = 0;
let bayesTiles = [];      // current round's tile vectors
let bayesPicks = [];      // indices user picked this round
let bayesPlaying = new Set();

document.getElementById('calib-apply-btn').onclick = () => {
  bayes.reset();
  bayesRound = 0;
  bayesPicks = [];
  showBayesRound();
};

function showBayesRound() {
  bayesRound++;
  const modal = document.getElementById('calib-modal');
  const content = document.getElementById('calib-content');
  modal.style.display = 'flex';

  const isLast = bayes.isDone() || bayesRound