import { buildCompositionPlan } from './composition.js';

// Hybrid Tile Scheduler
// Original 5 tiles = Scheduling Layer (when to intervene)
// 3 Attractors = Parameter Layer (what to target)

export class HybridTileScheduler {
  constructor(attractorSystem) {
    this.attractorSystem = attractorSystem;
    
    // Original 5 tile types and their purposes
    this.originalTiles = {
      circadian: {
        name: 'Circadian Synchronization',
        purpose: 'Align with universal energy flow',
        timeWindows: {
          '06-12': 'energy',      // Morning: Energy accumulation
          '12-18': 'information', // Afternoon: Information processing  
          '18-00': 'repair',      // Evening: Repair phase
          '00-06': 'discharge'    // Night: Air cavity discharge
        }
      },
      stress_growth: {
        name: 'Stress Growth',
        purpose: 'Move to blood type +1 complexity',
        attractorMap: 'information'  // Growth = Information stimulus
      },
      hysteresis: {
        name: 'Hysteresis',
        purpose: 'Resolve residual tension from previous track',
        attractorMap: 'repair'  // Cleanup = Repair maintenance
      },
      spatial_neighbor: {
        name: 'Spatial Neighbor',
        purpose: 'Mirror opposite temperament/entropy',
        attractorMap: 'integration'  // Balance = Carbon integration
      },
      release: {
        name: 'Release',
        purpose: 'Return to Layer A stabilization',
        attractorMap: 'energy'  // Stability = Energy reset
      }
    };

  }

  // Determine which original tile should be active based on context
  getActiveSchedulingTile(profile, currentTime, previousTrack = null, slotPosition = 0) {
    const hour = currentTime.getHours();
    const timeWindow = this.getTimeWindow(hour);
    
    // Priority 1: Circadian alignment
    if (this.shouldUseCircadian(profile, hour, previousTrack)) {
      return {
        type: 'circadian',
        timeWindow,
        attractorTarget: this.originalTiles.circadian.timeWindows[timeWindow]
      };
    }

    // Priority 2: Hysteresis if residual tension exists
    if (previousTrack && this.hasResidualTension(previousTrack)) {
      return {
        type: 'hysteresis',
        attractorTarget: this.originalTiles.hysteresis.attractorMap
      };
    }

    // Priority 3: Stress growth if evolution needed
    if (this.needsGrowthStimulus(profile, slotPosition)) {
      return {
        type: 'stress_growth',
        attractorTarget: this.originalTiles.stress_growth.attractorMap
      };
    }

    // Priority 4: Spatial neighbor for balance
    if (this.needsOppositePolarity(profile)) {
      return {
        type: 'spatial_neighbor',
        attractorTarget: this.originalTiles.spatial_neighbor.attractorMap
      };
    }

    // Default: Release for stabilization
    return {
      type: 'release',
      attractorTarget: this.originalTiles.release.attractorMap
    };
  }

  // Map scheduling decision to actual attractor tile with parameters
  generateScheduledTile(profile, currentTime, previousTrack = null, slotPosition = 0) {
    // Get scheduling layer decision
    const scheduling = this.getActiveSchedulingTile(profile, currentTime, previousTrack, slotPosition);
    
    // Get parameter layer from attractors
    const attractorTiles = this.attractorSystem.generateTiles(profile);
    
    // Select the appropriate attractor tile
    let selectedAttractorTile;
    switch (scheduling.attractorTarget) {
      case 'energy':
        selectedAttractorTile = attractorTiles.find(t => t.attractor === 'energy');
        break;
      case 'information':
        selectedAttractorTile = attractorTiles.find(t => t.attractor === 'information');
        break;
      case 'repair':
        selectedAttractorTile = attractorTiles.find(t => t.attractor === 'repair');
        break;
      case 'discharge':
        selectedAttractorTile = attractorTiles.find(t => t.attractor === 'interface');
        break;
      case 'integration':
        selectedAttractorTile = attractorTiles.find(t => t.attractor === 'integration');
        break;
      default:
        selectedAttractorTile = attractorTiles[0]; // fallback
    }

    const tileTimestamp = currentTime.getTime();
    const normalizedBlood = (profile.blood || 'O').toUpperCase();
    const normalizedGender = (profile.gender || 'M').toUpperCase();
    const tileDescriptor = {
      id: `${scheduling.type}-${tileTimestamp}-${slotPosition}`,
      timestamp: tileTimestamp,
      vec: { ...selectedAttractorTile.vec },
      attractor: selectedAttractorTile.attractor,
      type: scheduling.type,
      abo: normalizedBlood,
      gender: normalizedGender,
      midi: 60,
      profile
    };
    const planSeed = tileTimestamp + slotPosition;
    const plan = buildCompositionPlan(tileDescriptor, {
      attractor: selectedAttractorTile.attractor,
      abo: normalizedBlood,
      gender: normalizedGender,
      seed: planSeed
    });
    tileDescriptor._plan = plan;

    return {
      schedulingType: scheduling.type,
      attractorType: selectedAttractorTile.attractor,
      attractorPurpose: selectedAttractorTile.description,
      parameters: selectedAttractorTile.vec,
      vec: selectedAttractorTile.vec,
      description: `${this.originalTiles[scheduling.type].name} → ${selectedAttractorTile.name}`,
      plan,
      tile: tileDescriptor
    };
  }

  // Helper methods
  getTimeWindow(hour) {
    if (hour >= 6 && hour < 12) return '06-12';
    if (hour >= 12 && hour < 18) return '12-18';
    if (hour >= 18 && hour < 24) return '18-00';
    return '00-06';
  }

  shouldUseCircadian(profile, hour, previousTrack) {
    // Use circadian if:
    // - No previous track (start of session)
    // - Hour aligns with natural energy flow
    // - Profile has strong circadian sensitivity
    if (!previousTrack) return true;
    
    const timeWindow = this.getTimeWindow(hour);
    const structureBias = profile.mbti?.includes('J') ? 0.4 : 0.2;
    const windowBias = timeWindow === '06-12' ? 0.3 : timeWindow === '12-18' ? 0.2 : 0.1;
    const residualBias = previousTrack ? 0 : 0.4;
    return structureBias + windowBias + residualBias >= 0.7;
  }

  hasResidualTension(previousTrack) {
    // Check if previous track has high stress parameters
    if (!previousTrack.vec) return false;
    
    const { r, h, d, p, s } = previousTrack.vec;
    const avgStress = (r + h + d + p + s) / 5;
    return avgStress > 0.7; // High residual tension
  }

  needsGrowthStimulus(profile, slotPosition) {
    // Growth needed if:
    // - In growth window (slots 5-10)
    // - Profile has growth-oriented MBTI (N, P)
    const growthWindow = slotPosition >= 5 && slotPosition <= 10;
    const growthOriented = profile.mbti?.includes('N') || profile.mbti?.includes('P');
    return growthWindow && growthOriented;
  }

  needsOppositePolarity(profile) {
    // Need balance if profile is extreme
    const extremes = {
      E: 0.8, I: 0.2,
      N: 0.8, S: 0.2,
      T: 0.8, F: 0.2,
      P: 0.8, J: 0.2
    };
    
    // Simple check: if first letter is extreme
    const firstLetter = profile.mbti?.[0];
    return extremes[firstLetter] > 0.7;
  }
}
