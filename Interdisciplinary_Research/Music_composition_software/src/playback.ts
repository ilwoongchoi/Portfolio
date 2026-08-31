import type { Tile } from './types';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let reverbNode: ConvolverNode | null = null;
let reverbGain: GainNode | null = null;
let dryGain: GainNode | null = null;

function ensureContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.7;
    
    // Simple reverb via convolver
    reverbNode = audioCtx.createConvolver();
    reverbGain = audioCtx.createGain();
    dryGain = audioCtx.createGain();
    
    // Generate impulse response for reverb
    const length = audioCtx.sampleRate * 2;
    const impulse = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
      }
    }
    reverbNode.buffer = impulse;
    
    dryGain.gain.value = 0.7;
    reverbGain.gain.value = 0.3;
    
    dryGain.connect(masterGain);
    reverbNode.connect(reverbGain);
    reverbGain.connect(masterGain);
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playTile(tile: Tile, when: number = 0): ScheduledStop {
  const ctx = ensureContext();
  const startTime = ctx.currentTime + when;
  
  const { waveform, baseFreq, duration, adsr, filterFreq, reverbAmount, detune, noiseAmount } = tile;
  
  // Main oscillator
  const osc = ctx.createOscillator();
  osc.type = waveform;
  osc.frequency.value = baseFreq;
  osc.detune.value = detune;
  
  // Filter
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 1;
  
  // ADSR envelope
  const gainNode = ctx.createGain();
  const sustainLevel = adsr.sustain * 0.3;
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.4, startTime + adsr.attack);
  gainNode.gain.linearRampToValueAtTime(sustainLevel, startTime + adsr.attack + adsr.decay);
  gainNode.gain.setValueAtTime(sustainLevel, startTime + duration - adsr.release);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
  
  // Connect: osc → filter → gain → split dry/reverb
  osc.connect(filter);
  filter.connect(gainNode);
  
  // Dry path
  const tileDry = ctx.createGain();
  tileDry.gain.value = 1 - reverbAmount;
  gainNode.connect(tileDry);
  tileDry.connect(dryGain!);
  
  // Reverb path
  if (reverbAmount > 0.01) {
    const tileReverb = ctx.createGain();
    tileReverb.gain.value = reverbAmount;
    gainNode.connect(tileReverb);
    tileReverb.connect(reverbNode!);
  }
  
  // Noise component (for dissonance)
  if (noiseAmount > 0.01) {
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * noiseAmount * 0.15;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = filterFreq * 0.5;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, startTime);
    noiseGain.gain.linearRampToValueAtTime(noiseAmount * 0.2, startTime + adsr.attack);
    noiseGain.gain.linearRampToValueAtTime(0, startTime + duration);
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(tileDry);
    noiseSrc.start(startTime);
    noiseSrc.stop(startTime + duration);
  }
  
  // Harmonic overtone (for h dimension)
  if (tile.vector.h > 0.4) {
    const harmonic = ctx.createOscillator();
    harmonic.type = 'sine';
    harmonic.frequency.value = baseFreq * 2;
    harmonic.detune.value = detune * 0.5;
    const harmGain = ctx.createGain();
    harmGain.gain.value = tile.vector.h * 0.15;
    harmonic.connect(harmGain);
    harmGain.connect(filter);
    harmonic.start(startTime);
    harmonic.stop(startTime + duration);
    
    if (tile.vector.h > 0.7) {
      const harmonic2 = ctx.createOscillator();
      harmonic2.type = 'sine';
      harmonic2.frequency.value = baseFreq * 3;
      harmonic2.detune.value = detune * 0.3;
      const harm2Gain = ctx.createGain();
      harm2Gain.gain.value = tile.vector.h * 0.08;
      harmonic2.connect(harm2Gain);
      harm2Gain.connect(filter);
      harmonic2.start(startTime);
      harmonic2.stop(startTime + duration);
    }
  }
  
  osc.start(startTime);
  osc.stop(startTime + duration);
  
  return { startTime: startTime + duration };
}

interface ScheduledStop {
  startTime: number;
}

export function stopAll() {
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
    masterGain = null;
    reverbNode = null;
    reverbGain = null;
    dryGain = null;
  }
}

export function setMasterVolume(vol: number) {
  if (masterGain) {
    masterGain.gain.value = vol;
  }
}

export function getAudioContext(): AudioContext {
  return ensureContext();
}
