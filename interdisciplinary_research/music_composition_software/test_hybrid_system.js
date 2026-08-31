// Test script for full hybrid system with various profiles and times
import { CalibrationPad } from './calibration.js';
import { AttractorTileSystem } from './attractor_tiles.js';
import { HybridTileScheduler } from './hybrid_scheduler.js';
import { profileToVector } from './engine.js';

console.log('=== Testing Full Hybrid System ===\n');

// Mock localStorage for Node.js environment
global.localStorage = {
  data: {},
  getItem: function(key) { return this.data[key] || null; },
  setItem: function(key, value) { this.data[key] = value; },
  removeItem: function(key) { delete this.data[key]; },
  clear: function() { this.data = {}; }
};
localStorage.clear();

// Initialize components
const calib = new CalibrationPad();
const attractorSystem = new AttractorTileSystem();
const scheduler = new HybridTileScheduler(attractorSystem);

// Test profiles covering different MBTI, genders, blood types, and layers
const testProfiles = [
  // Energy-vulnerable profiles
  { mbti: 'ISTJ', gender: 'M', blood: 'O', layer: 'A', description: 'ISTJ_M_O_A - Stable Energy' },
  { mbti: 'ESTJ', gender: 'F', blood: 'O', layer: 'B', description: 'ESTJ_F_O_B - Reversed Energy' },
  
  // Information-vulnerable profiles  
  { mbti: 'INFP', gender: 'F', blood: 'AB', layer: 'D', description: 'INFP_F_AB_D - Max Entropy' },
  { mbti: 'ENFJ', gender: 'M', blood: 'AB', layer: 'C', description: 'ENFJ_M_AB_C - Info+1' },
  
  // Repair-vulnerable profiles
  { mbti: 'INTP', gender: 'M', blood: 'B', layer: 'A', description: 'INTP_M_B_A - Stable Repair' },
  { mbti: 'ESFP', gender: 'F', blood: 'B', layer: 'D', description: 'ESFP_F_B_D - Extreme Repair' }
];

// Test different times of day for scheduling
const testTimes = [
  { hour: 6, phase: 'Morning (6AM)', expectedTile: 'circadian_sync' },
  { hour: 12, phase: 'Noon (12PM)', expectedTile: 'stress_growth' },
  { hour: 18, phase: 'Evening (6PM)', expectedTile: 'hysteresis' },
  { hour: 22, phase: 'Night (10PM)', expectedTile: 'spatial_neighbor' },
  { hour: 2, phase: 'Late Night (2AM)', expectedTile: 'release' }
];

console.log('1. Testing profile → 8D vector diversity...\n');
testProfiles.forEach(profile => {
  const vec = profileToVector({mbti: profile.mbti, gender: profile.gender, blood: profile.blood, layer: profile.layer});
  console.log(`${profile.description}:`);
  console.log(`  8D: r=${vec.r.toFixed(2)}, h=${vec.h.toFixed(2)}, d=${vec.d.toFixed(2)}, p=${vec.p.toFixed(2)}, s=${vec.s.toFixed(2)}, γ=${vec.gamma.toFixed(2)}, g=${vec.g.toFixed(2)}, ν=${vec.nu.toFixed(2)}`);
  
  // Calculate vector magnitude for diversity check
  const magnitude = Math.sqrt(Object.values(vec).reduce((sum, v) => sum + v*v, 0));
  console.log(`  Magnitude: ${magnitude.toFixed(3)}\n`);
});

console.log('\n2. Testing time-based scheduling...\n');
testTimes.forEach(timeTest => {
  console.log(`${timeTest.phase}:`);
  
  // Create a mock date for the specific hour
  const mockDate = new Date();
  mockDate.setHours(timeTest.hour);
  
  // Get scheduled tile
  const profile = testProfiles[0]; // Use first profile for consistency
  const tile = scheduler.generateScheduledTile(profile, mockDate);
  
  console.log(`  Expected: ${timeTest.expectedTile}`);
  console.log(`  Scheduled: ${tile?.schedulingType || 'None'}`);
  console.log(`  Match: ${tile?.schedulingType === timeTest.expectedTile ? '✓' : '✗'}\n`);
});

console.log('\n3. Testing attractor state variations across profiles...\n');
testProfiles.forEach(profile => {
  attractorSystem.updateStates(profile);
  const tiles = attractorSystem.generateTiles(profile);
  
  console.log(`${profile.description}:`);
  console.log(`  Energy: L=${attractorSystem.states.energy.level.toFixed(3)}, S=${attractorSystem.states.energy.stress.toFixed(3)}`);
  console.log(`  Information: L=${attractorSystem.states.information.level.toFixed(3)}, S=${attractorSystem.states.information.stress.toFixed(3)}`);
  console.log(`  Repair: L=${attractorSystem.states.repair.level.toFixed(3)}, S=${attractorSystem.states.repair.stress.toFixed(3)}`);
  console.log(`  Carbon: sync=${attractorSystem.states.carbon.sync.toFixed(3)}, rewrite=${attractorSystem.states.carbon.rewrite.toFixed(3)}`);
  
  // Check primary attractor tile parameters
  const energyTile = tiles.find(t => t.id === 'release');
  const infoTile = tiles.find(t => t.id === 'stress_growth');
  const repairTile = tiles.find(t => t.id === 'extreme_growth');
  
  console.log(`  Energy tile (r,g,γ): ${energyTile?.vec.r.toFixed(3)}, ${energyTile?.vec.g.toFixed(3)}, ${energyTile?.vec.gamma.toFixed(3)}`);
  console.log(`  Info tile (h,ν,s): ${infoTile?.vec.h.toFixed(3)}, ${infoTile?.vec.nu.toFixed(3)}, ${infoTile?.vec.s.toFixed(3)}`);
  console.log(`  Repair tile (p,d,g): ${repairTile?.vec.p.toFixed(3)}, ${repairTile?.vec.d.toFixed(3)}, ${repairTile?.vec.g.toFixed(3)}\n`);
});

console.log('\n4. Testing hybrid tile generation (scheduling + attractors)...\n');
// Test with a specific profile and time
const testProfile = testProfiles[2]; // INFP_F_AB_D
const testTime = new Date();
testTime.setHours(14); // 2PM

console.log(`Profile: ${testProfile.description}`);
console.log(`Time: 2PM (afternoon)\n`);

const hybridTile = scheduler.generateScheduledTile(testProfile, testTime);

if (hybridTile) {
  console.log(`Tile: ${hybridTile.description}`);
  console.log(`  Scheduling type: ${hybridTile.schedulingType}`);
  console.log(`  Attractor type: ${hybridTile.attractorType}`);
  console.log(`  Attractor purpose: ${hybridTile.attractorPurpose}`);
  console.log(`  Plan role: ${hybridTile.plan?.role}`);
  console.log(`  Plan BPM: ${hybridTile.plan?.bpm}`);
  console.log(`  8D vector: r=${hybridTile.vec.r.toFixed(3)}, h=${hybridTile.vec.h.toFixed(3)}, d=${hybridTile.vec.d.toFixed(3)}, p=${hybridTile.vec.p.toFixed(3)}, s=${hybridTile.vec.s.toFixed(3)}, γ=${hybridTile.vec.gamma.toFixed(3)}, g=${hybridTile.vec.g.toFixed(3)}, ν=${hybridTile.vec.nu.toFixed(3)}`);
  console.log(`  Description: ${hybridTile.description}\n`);
} else {
  console.log('No tile generated\n');
}

console.log('\n5. Testing closed-loop dynamics across multiple plays...\n');
// Reset with fresh profile
attractorSystem.updateStates(testProfile);
let iteration = 0;

const simulatePlaySequence = () => {
  iteration++;
  console.log(`Iteration ${iteration}:`);
  
  // Get current tiles
  const tiles = attractorSystem.generateTiles(null);
  const infoTile = tiles.find(t => t.id === 'stress_growth');
  
  console.log(`  Information state: L=${attractorSystem.states.information.level.toFixed(4)}, S=${attractorSystem.states.information.stress.toFixed(4)}`);
  console.log(`  Carbon state: sync=${attractorSystem.states.carbon.sync.toFixed(4)}, rewrite=${attractorSystem.states.carbon.rewrite.toFixed(4)}`);
  console.log(`  Info tile h: ${infoTile.vec.h.toFixed(4)}`);
  
  // Play the tile
  attractorSystem.updateFromPlayedTile(infoTile);
  
  // Check for convergence
  if (iteration < 5) {
    setTimeout(simulatePlaySequence, 100);
  } else {
    console.log('\n  Closed-loop test complete');
    console.log('\n=== Hybrid System Test Complete ===');
  }
};

simulatePlaySequence();
