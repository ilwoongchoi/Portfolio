// ─────────────────────────────────────────────────────────────
// audio.js — Continuous FM/filter synthesis engine (no samples).
// Ported from composer_v3.html's circuitSynthesize tonal/chord layer.
// Every parameter is a pure continuous function of the 8D vector —
// deterministic (same vector = same sound, bit-for-bit) and linear
// (small slider moves = small audible changes, no hard jumps).
// ─────────────────────────────────────────────────────────────
import {
  hysteresisFromClock,
  envelopeFromVector,
  timbreFromVector,
  fmFromVector,
  voicingFromVector,
  dissonanceFromVector,
  octaveLayersFromVector,
  tremoloFromVector,
  instrumentFromVector,
  reverbFromVector
} from './engine.js';
import { buildCompositionPlan } from './composition.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.activeNodes = [];
    this.tileHandles = new Map(); // tile.id -> handle, so re-triggering a tile stops its previous instance first
    this.masterGain = null;
  }

  ensureCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  /**
   * Build a FRESH, STATIC reverb chain (delay+feedback+wet) for one tile.
   */
  _createReverbChain(reverb) {
    const ctx = this.ctx;
    const delay = ctx.createDelay(2.0);
    delay.delayTime.value = reverb.delaySec;
    const feedback = ctx.createGain();
    feedback.gain.value = reverb.feedback;
    const wet = ctx.createGain();
    wet.gain.value = reverb.wet;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(this.masterGain);
    return { delay, feedback, wet };
  }

  /** MIDI note number -> Hz */
  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /** Stop whatever is currently playing for this specific tile.id, if anything. */
  stopTile(tileId) {
    const prev = this.tileHandles.get(tileId);
    if (prev) {
      (prev.oscillators || []).forEach(o => { try { o.stop(); } catch (e) {} });
      this.tileHandles.delete(tileId);
      const i = this.activeNodes.indexOf(prev);
      if (i >= 0) this.activeNodes.splice(i, 1);
    }
  }

  /**
   * Synthesize ONE note event.
   * layerType: 'lead', 'bass', or 'pad'
   */
  _synthNote(plan, freq, startTime, noteDuration, outOscillators, reverbChain, gainMul = 1, layerType = 'lead') {
    const ctx = this.ctx;
    const vec = plan.vec || {};
    const instruments = plan.instruments || instrumentFromVector(vec);
    const env = plan.envelope || envelopeFromVector(vec);
    const timbre = plan.timbre || timbreFromVector(vec);
    const fm = plan.fm || fmFromVector(vec);
    const voicing = plan.voicing || voicingFromVector(vec);
    const dissonance = plan.dissonance || dissonanceFromVector(vec);
    const octaves = plan.octaves || octaveLayersFromVector(vec);
    const trem = plan.tremolo || tremoloFromVector(vec);

    const t = startTime;
    let a = env.attack, dcy = env.decay, sus = env.sustain, rel = env.release;
    let fmRatio = fm.ratio;
    let fmDepth = fm.depthIndex;

    // Apply instrument-specific adjustments
    if (layerType === 'bass') {
      const instr = instruments.percussive;
      a = 0.01;
      dcy = instr.decay;
      fmRatio = 0.5;
      fmDepth *= 0.5;
    } else if (layerType === 'pad') {
      const instr = instruments.sustained;
      a = instr.attack;
      rel = instr.release;
      fmRatio = instr.fmRatio;
      fmDepth = instr.fmDepth;
    } else {
      const instr = instruments.electronic;
      fmRatio = instr.fmRatio;
      fmDepth = instr.fmDepth;
    }

    const peak = (vec.velocity ?? 0.7) * gainMul;
    const sustainLevel = peak * sus;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.max(150, timbre.filterCutoffMultiplier * freq), t);
    filter.Q.value = layerType === 'lead' ? instruments.electronic.filterQ : timbre.filterQ;

    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0, t);
    envGain.gain.linearRampToValueAtTime(peak, t + a);
    envGain.gain.linearRampToValueAtTime(sustainLevel, t + a + dcy);
    envGain.gain.setValueAtTime(sustainLevel, Math.max(t + a + dcy, t + noteDuration - rel));
    envGain.gain.linearRampToValueAtTime(0.0001, t + noteDuration + rel);

    const tremGain = ctx.createGain();
    tremGain.gain.value = 1;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = trem.rateHz;
    const lfoDepthGain = ctx.createGain();
    lfoDepthGain.gain.value = trem.depth;
    lfo.connect(lfoDepthGain);
    lfoDepthGain.connect(tremGain.gain);
    lfo.start(t);
    lfo.stop(t + noteDuration + rel + 0.05);
    outOscillators.push(lfo);

    filter.connect(envGain);
    envGain.connect(tremGain);
    tremGain.connect(this.masterGain);
    tremGain.connect(reverbChain.delay);

    const stopAt = t + noteDuration + rel + 0.05;

    const addVoice = (freqMul, voiceGain, detuneCents) => {
      if (voiceGain <= 0.0005) return;
      const triOsc = ctx.createOscillator();
      const sawOsc = ctx.createOscillator();
      triOsc.type = 'triangle';
      sawOsc.type = 'sawtooth';
      const vFreq = freq * freqMul;
      triOsc.frequency.setValueAtTime(vFreq, t);
      sawOsc.frequency.setValueAtTime(vFreq, t);
      triOsc.detune.value = detuneCents;
      sawOsc.detune.value = detuneCents;

      const triGain = ctx.createGain();
      const sawGain = ctx.createGain();
      triGain.gain.value = (1 - timbre.sawMix) * voiceGain;
      sawGain.gain.value = timbre.sawMix * voiceGain;

      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      mod.frequency.setValueAtTime(vFreq * fmRatio, t);
      const modDepthHz = fmDepth * vFreq;
      modGain.gain.setValueAtTime(modDepthHz, t);
      modGain.gain.exponentialRampToValueAtTime(Math.max(0.001, modDepthHz * 0.01), t + noteDuration);
      mod.connect(modGain);
      modGain.connect(triOsc.frequency);
      modGain.connect(sawOsc.frequency);

      triOsc.connect(triGain); triGain.connect(filter);
      sawOsc.connect(sawGain); sawGain.connect(filter);

      triOsc.start(t); triOsc.stop(stopAt);
      sawOsc.start(t); sawOsc.stop(stopAt);
      mod.start(t); mod.stop(stopAt);
      outOscillators.push(triOsc, sawOsc, mod);
    };

    addVoice(1, 1, 0);
    addVoice(1, voicing.outerGain, +voicing.spreadCents);
    addVoice(1, voicing.outerGain, -voicing.spreadCents);
    if (layerType !== 'bass') {
      addVoice(dissonance.ratio, dissonance.gain, 0);
      addVoice(2, octaves.octaveUp1Gain * 0.6, 0);
      addVoice(4, octaves.octaveUp2Gain * 0.4, 0);
    }
  }

  /**
   * Synthesize a drum hit (kick/snare/hihat) using noise + oscillator.
   * Grounded in circuitfile.md: r→drums, p→drum machine, nu→fractal, s→synth brightness.
   */
  _synthDrum(type, params, startTime, duration, outOscillators, reverbChain) {
    const ctx = this.ctx;
    const t = startTime;
    const gain = params.gain;

    if (type === 'kick') {
      // Kick: sine sweep from pitch down to 40Hz, short decay
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const startFreq = this.midiToFreq(params.pitch);
      osc.frequency.setValueAtTime(startFreq, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
      const envGain = ctx.createGain();
      envGain.gain.setValueAtTime(gain, t);
      envGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(envGain);
      envGain.connect(this.masterGain);
      envGain.connect(reverbChain.delay);
      osc.start(t);
      osc.stop(t + 0.2);
      outOscillators.push(osc);
    } else if (type === 'snare') {
      // Snare: noise burst + triangle tone, short decay
      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      const noiseSeed = Math.floor((t || 0) * 1000) + 1;
      for (let i = 0; i < data.length; i++) data[i] = (Math.sin(noiseSeed * 12.9898 + i * 78.233) * 43758.5453 % 1) * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 1000 + params.pitch;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(gain * 0.7, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noiseGain.connect(reverbChain.delay);
      noise.start(t);
      noise.stop(t + 0.15);
      outOscillators.push(noise);

      const toneOsc = ctx.createOscillator();
      toneOsc.type = 'triangle';
      toneOsc.frequency.value = params.pitch;
      const toneGain = ctx.createGain();
      toneGain.gain.setValueAtTime(gain * 0.3, t);
      toneGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      toneOsc.connect(toneGain);
      toneGain.connect(this.masterGain);
      toneOsc.start(t);
      toneOsc.stop(t + 0.1);
      outOscillators.push(toneOsc);
    } else if (type === 'hihat') {
      // Hihat: high-passed noise, very short, brightness from s
      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      const noiseSeed = Math.floor((t || 0) * 1000) + 2;
      for (let i = 0; i < data.length; i++) data[i] = (Math.sin(noiseSeed * 12.9898 + i * 78.233) * 43758.5453 % 1) * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 3000 + params.brightness * 6000;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(gain, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noiseGain.connect(reverbChain.delay);
      noise.start(t);
      noise.stop(t + 0.06);
      outOscillators.push(noise);
    }
  }

  /**
   * Play a tile by building a CompositionPlan (if needed) and rendering it.
   */
  playTile(tile, startTime, duration) {
    this.ensureCtx();
    const timestamp = tile?.timestamp ?? 0;
    const preparedTile = { ...tile, timestamp };
    if (preparedTile.id != null) this.stopTile(preparedTile.id);
    const vec = hysteresisFromClock(preparedTile.vec || {}, timestamp);
    preparedTile.vec = vec;

    let plan = preparedTile._plan;
    if (!plan || preparedTile._planDirty) {
      plan = buildCompositionPlan(preparedTile, {
        attractor: preparedTile.attractor || preparedTile.attractorType,
        abo: preparedTile.abo || preparedTile.blood || preparedTile.profile?.blood,
        gender: preparedTile.gender || preparedTile.profile?.gender
      });
      preparedTile._planDirty = false;
    }

    if (typeof duration === 'number' && duration > 0) {
      plan = { ...plan, duration, bars: plan.bars, totalSteps: plan.totalSteps };
    }
    const planWithId = plan?.id === (preparedTile.id ?? plan?.id)
      ? plan
      : { ...plan, id: preparedTile.id ?? plan?.id }; 
    preparedTile._plan = planWithId;
    return this.renderPlan(planWithId, startTime ?? this.now());
  }

  stopAll() {
    this.activeNodes.forEach(h => {
      (h.oscillators || []).forEach(o => { try { o.stop(); } catch (e) {} });
    });
    this.activeNodes = [];
    this.tileHandles.clear();
  }

  playPreview(vec) {
    const ctx = this.ensureCtx();
    const now = ctx.currentTime;
    this.playTile({ vec, id: 'preview', timestamp: 1234567 }, now, 2.0);
  }

  now() {
    return this.ensureCtx().currentTime;
  }
}
