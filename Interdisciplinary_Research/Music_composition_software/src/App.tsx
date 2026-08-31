import { useState, useEffect } from 'react';
import { Play, Pause, Trash2, Plus, Clock, Music, User, Sparkles } from 'lucide-react';
import type { Vector8D, Tile, Slot, Phase, Profile } from './types';
import { PHASES, DIMENSIONS } from './types';
import { phaseToBaseVector, generateTileSuggestions } from './audioEngine';
import { playTile, stopAll, setMasterVolume, getAudioContext } from './playback';

const SLOTS_PER_BAR = 8;

function createEmptySlots(): Slot[][] {
  return PHASES.map((_, barIndex) =>
    Array.from({ length: SLOTS_PER_BAR }, (_, slotIndex) => ({
      id: `slot-${barIndex}-${slotIndex}`,
      barIndex,
      slotIndex,
      tile: null,
    }))
  );
}

function getDefaultProfile(): Profile {
  return {
    mbti: 'ENFP',
    blood: 'O',
    gender: 'M',
    layer: 'A',
    baseVector: { r: 0.6, h: 0.5, d: 0.3, p: 0.5, s: 0.5, gamma: 0.4, g: 0.5, nu: 0.4 },
  };
}

const MBTI_TYPES = ['INTJ','INTP','INFJ','INFP','ENTJ','ENTP','ENFJ','ENFP','ISTJ','ISTP','ISFJ','ISFP','ESTJ','ESTP','ESFJ','ESFP'];
const BLOOD_TYPES: ('O'|'A'|'B'|'AB')[] = ['O','A','B','AB'];

function profileToVector(mbti: string, blood: string, gender: string): Vector8D {
  const v: Vector8D = { r: 0.5, h: 0.5, d: 0.5, p: 0.5, s: 0.5, gamma: 0.5, g: 0.5, nu: 0.5 };
  if (mbti[0] === 'E') { v.r += 0.2; v.g -= 0.1; } else { v.r -= 0.1; v.g += 0.15; }
  if (mbti[1] === 'N') { v.nu += 0.2; v.d -= 0.05; } else { v.d += 0.1; v.nu -= 0.1; }
  if (mbti[2] === 'T') { v.r += 0.1; v.h -= 0.1; } else { v.h += 0.15; v.r -= 0.05; }
  if (mbti[3] === 'J') { v.p += 0.2; } else { v.p -= 0.2; }
  const bloodComplexity: Record<string, number> = { O: 1, A: 2, B: 3, AB: 4 };
  v.nu += (bloodComplexity[blood] - 1) * 0.05;
  v.gamma += (bloodComplexity[blood] - 1) * 0.03;
  if (gender === 'M') { v.d += 0.1; v.s += 0.05; } else { v.r += 0.1; v.h += 0.05; }
  (Object.keys(v) as (keyof Vector8D)[]).forEach(k => {
    v[k] = Math.max(0, Math.min(1, v[k]));
  });
  return v;
}

export default function App() {
  const [slots, setSlots] = useState<Slot[][]>(createEmptySlots);
  const [profile, setProfile] = useState<Profile>(getDefaultProfile);
  const [currentPhase, setCurrentPhase] = useState<Phase>('AB_spark');
  const [suggestions, setSuggestions] = useState<Tile[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingSlot, setPlayingSlot] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [showProfile, setShowProfile] = useState(false);
  const [draggedTile, setDraggedTile] = useState<Tile | null>(null);
  const [hoverSlot, setHoverSlot] = useState<string | null>(null);

  useEffect(() => {
    const baseVec = phaseToBaseVector(currentPhase);
    const blended: Vector8D = { ...baseVec };
    (Object.keys(blended) as (keyof Vector8D)[]).forEach(k => {
      blended[k] = blended[k] * 0.6 + profile.baseVector[k] * 0.4;
    });
    setSuggestions(generateTileSuggestions(blended, currentPhase, 8));
  }, [currentPhase, profile]);

  useEffect(() => {
    setMasterVolume(volume);
  }, [volume]);

  const handleSlotDrop = (barIndex: number, slotIndex: number) => {
    if (!draggedTile) return;
    setSlots(prev => {
      const next = prev.map(bar => bar.map(s => ({ ...s, tile: s.tile ? { ...s.tile } : null })));
      next[barIndex][slotIndex].tile = draggedTile;
      return next;
    });
    setDraggedTile(null);
    setHoverSlot(null);
  };

  const handleSlotClick = (barIndex: number, slotIndex: number) => {
    const tile = slots[barIndex][slotIndex].tile;
    if (tile) {
      getAudioContext();
      playTile(tile);
    }
  };

  const handleSlotRemove = (barIndex: number, slotIndex: number) => {
    setSlots(prev => {
      const next = prev.map(bar => bar.map(s => ({ ...s, tile: s.tile ? { ...s.tile } : null })));
      next[barIndex][slotIndex].tile = null;
      return next;
    });
  };

  const handleClearAll = () => {
    setSlots(createEmptySlots());
  };

  const handlePlay = () => {
    if (isPlaying) {
      stopAll();
      setIsPlaying(false);
      setPlayingSlot(null);
      return;
    }
    const allTiles: { tile: Tile; slotId: string }[] = [];
    slots.forEach(bar => {
      bar.forEach(slot => {
        if (slot.tile) allTiles.push({ tile: slot.tile, slotId: slot.id });
      });
    });
    if (allTiles.length === 0) return;
    setIsPlaying(true);
    getAudioContext();
    let delay = 0;
    allTiles.forEach(({ tile, slotId }) => {
      playTile(tile, delay);
      const slotDelay = delay;
      setTimeout(() => setPlayingSlot(slotId), slotDelay * 1000);
      delay += tile.duration * 0.8;
    });
    setTimeout(() => {
      setPlayingSlot(null);
      setIsPlaying(false);
    }, delay * 1000 + 500);
  };

  const handleProfileChange = (mbti: string, blood: 'O'|'A'|'B'|'AB', gender: 'M'|'F') => {
    const baseVector = profileToVector(mbti, blood, gender);
    setProfile({ mbti, blood, gender, layer: 'A', baseVector });
  };

  const filledSlots = slots.flat().filter(s => s.tile).length;
  const totalSlots = slots.flat().length;
  const completeness = Math.round((filledSlots / totalSlots) * 100);
  const currentPhaseIndex = PHASES.findIndex(p => p.id === currentPhase);

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0f] text-gray-200">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#12121a] border-b border-[#1e1e2e]">
        <div className="flex items-center gap-3">
          <Music className="w-6 h-6 text-violet-400" />
          <h1 className="text-lg font-semibold tracking-wide">항상성 작곡기</h1>
          <span className="text-xs text-gray-500 ml-2">Homeostasis Composition Engine</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a2e] hover:bg-[#252539] transition-colors text-sm"
          >
            <User className="w-4 h-4" />
            {profile.mbti}_{profile.blood}_{profile.gender}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlay}
              disabled={filledSlots === 0}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-violet-600 hover:bg-violet-700 disabled:opacity-40'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? 'Stop' : 'Play'}
            </button>
            <button
              onClick={handleClearAll}
              className="p-1.5 rounded-lg bg-[#1a1a2e] hover:bg-[#252539] transition-colors"
              title="Clear all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Vol</span>
            <input
              type="range" min="0" max="1" step="0.01" value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="w-20 accent-violet-500"
            />
          </div>
        </div>
      </header>

      {/* Profile Panel */}
      {showProfile && (
        <div className="absolute top-14 right-6 z-50 bg-[#12121a] border border-[#2a2a3e] rounded-xl p-4 shadow-2xl w-72">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-violet-400" /> Profile Selector
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">MBTI (16)</label>
              <div className="grid grid-cols-4 gap-1">
                {MBTI_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => handleProfileChange(t, profile.blood, profile.gender)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      profile.mbti === t ? 'bg-violet-600 text-white' : 'bg-[#1a1a2e] hover:bg-[#252539]'
                    }`}
                  >{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Blood Type</label>
              <div className="flex gap-1">
                {BLOOD_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => handleProfileChange(profile.mbti, t, profile.gender)}
                    className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
                      profile.blood === t ? 'bg-red-600 text-white' : 'bg-[#1a1a2e] hover:bg-[#252539]'
                    }`}
                  >{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Gender</label>
              <div className="flex gap-1">
                {(['M','F'] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => handleProfileChange(profile.mbti, profile.blood, g)}
                    className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
                      profile.gender === g ? 'bg-cyan-600 text-white' : 'bg-[#1a1a2e] hover:bg-[#252539]'
                    }`}
                  >{g === 'M' ? 'Male' : 'Female'}</button>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-[#2a2a3e]">
              <label className="text-xs text-gray-400 block mb-1">Base 8D Vector</label>
              <div className="flex gap-1 h-8 items-end">
                {DIMENSIONS.map(d => (
                  <div
                    key={d.key}
                    className="flex-1 flex flex-col items-center gap-0.5"
                  >
                    <div
                      className="w-full rounded-sm"
                      style={{ height: `${profile.baseVector[d.key] * 100}%`, background: d.color }}
                    />
                    <span className="text-[8px] text-gray-500">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Circadian Phase Selector */}
      <div className="flex items-center gap-1 px-6 py-2 bg-[#0e0e16] border-b border-[#1e1e2e]">
        <Clock className="w-4 h-4 text-gray-500 mr-2" />
        {PHASES.map((phase) => (
          <button
            key={phase.id}
            onClick={() => setCurrentPhase(phase.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${
              currentPhase === phase.id
                ? 'bg-[#1a1a2e] ring-1 ring-violet-500/50'
                : 'hover:bg-[#15151f]'
            }`}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: phase.color }} />
            <div className="text-left">
              <div className="font-medium">{phase.name}</div>
              <div className="text-[10px] text-gray-500">{phase.timeRange} · {phase.sphere}</div>
            </div>
          </button>
        ))}
        <div className="ml-auto text-xs text-gray-500">
          {filledSlots}/{totalSlots} slots ({completeness}%)
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Tile Suggestions */}
        <div className="w-64 bg-[#0e0e16] border-r border-[#1e1e2e] overflow-y-auto p-3">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold">Tile Recommendations</h2>
          </div>
          <p className="text-[10px] text-gray-500 mb-3">
            Phase: {PHASES[currentPhaseIndex].name} · Drag to bars
          </p>
          <div className="space-y-2">
            {suggestions.map(tile => (
              <div
                key={tile.id}
                draggable
                onDragStart={() => setDraggedTile(tile)}
                onClick={() => { getAudioContext(); playTile(tile); }}
                className="cursor-grab active:cursor-grabbing rounded-lg p-3 border transition-all hover:scale-[1.02]"
                style={{ background: `${tile.color}15`, borderColor: `${tile.color}40` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: tile.color }}>{tile.genreLabel}</span>
                </div>
                <div className="flex gap-0.5 h-4 items-end mb-1">
                  {DIMENSIONS.map(d => (
                    <div
                      key={d.key}
                      className="flex-1 rounded-sm"
                      style={{ height: `${tile.vector[d.key] * 100}%`, background: d.color, opacity: 0.6 + tile.vector[d.key] * 0.4 }}
                    />
                  ))}
                </div>
                <div className="flex gap-0.5 text-[8px] text-gray-500">
                  {DIMENSIONS.map(d => (
                    <span key={d.key} className="flex-1 text-center">{d.label}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Composition Bars */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {PHASES.map((phase, barIndex) => (
              <div key={phase.id} className="rounded-xl bg-[#0e0e16] border border-[#1e1e2e] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: phase.color }} />
                  <span className="text-sm font-medium">{phase.name}</span>
                  <span className="text-[10px] text-gray-500">{phase.timeRange}</span>
                  <span className="text-[10px] text-gray-600">·</span>
                  <span className="text-[10px] text-gray-500">{phase.sphere}</span>
                  {slots[barIndex].filter(s => s.tile).length > 0 && (
                    <span className="ml-auto text-[10px] text-gray-500">
                      {slots[barIndex].filter(s => s.tile).length} tiles
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {slots[barIndex].map(slot => (
                    <div
                      key={slot.id}
                      onDragOver={(e) => { e.preventDefault(); setHoverSlot(slot.id); }}
                      onDragLeave={() => setHoverSlot(null)}
                      onDrop={() => handleSlotDrop(barIndex, slot.slotIndex)}
                      onClick={() => handleSlotClick(barIndex, slot.slotIndex)}
                      className={`flex-1 min-h-[60px] rounded-lg border-2 transition-all cursor-pointer relative group ${
                        hoverSlot === slot.id
                          ? 'border-violet-500 bg-violet-500/10'
                          : slot.tile
                          ? 'border-transparent'
                          : 'border-dashed border-[#2a2a3e] hover:border-[#3a3a5e]'
                      } ${playingSlot === slot.id ? 'ring-2 ring-violet-400 animate-pulse' : ''}`}
                      style={slot.tile ? {
                        background: `${slot.tile.color}20`,
                        borderColor: `${slot.tile.color}60`,
                        animation: 'tile-drop 0.3s ease-out',
                      } : {}}
                    >
                      {slot.tile ? (
                        <div className="p-2 h-full flex flex-col justify-between">
                          <div>
                            <div className="text-[10px] font-medium" style={{ color: slot.tile.color }}>
                              {slot.tile.genreLabel}
                            </div>
                            <div className="flex gap-0.5 h-3 items-end mt-1">
                              {DIMENSIONS.map(d => (
                                <div
                                  key={d.key}
                                  className="flex-1 rounded-sm"
                                  style={{ height: `${slot.tile!.vector[d.key] * 100}%`, background: d.color, opacity: 0.5 + slot.tile!.vector[d.key] * 0.5 }}
                                />
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSlotRemove(barIndex, slot.slotIndex); }}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-600/30"
                          >
                            <Trash2 className="w-3 h-3 text-gray-400" />
                          </button>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <Plus className="w-4 h-4 text-gray-700" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
