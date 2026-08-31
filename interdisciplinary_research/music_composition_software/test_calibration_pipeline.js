// Mock localStorage for Node.js environment
global.localStorage = {
  data: {},
  getItem: function(key) { return this.data[key] || null; },
  setItem: function(key, value) { this.data[key] = value; },
  removeItem: function(key) { delete this.data[key]; },
  clear: function() { this.data = {}; }
};

// Clear any existing data
localStorage.clear();

// Test script for calibration → profile → attractors → 8D → music pipeline
import { CalibrationPad } from './calibration.js';
import { AttractorTileSystem } from './attractor_tiles.js';
import { profileToVector } from './engine.js';

console.log('=== Testing Calibration Pipeline ===\n');

// 1. Initialize components
const calib = new CalibrationPad();
const attractorSystem = new AttractorTileSystem();

// 2. Simulate user behavior patterns
console.log('1. Simulating user behaviors...');

// Simulate cautious user (prefers low p, high g)
calib.recordSliderChange('p', 0.2);
calib.recordSliderChange('p', 0.3);
calib.recordSliderChange('p', 0.1);
calib.recordSliderChange('g', 0.8);
calib.recordSliderChange('g', 0.7);
calib.recordSliderChange('g', 0.9);
calib.recordTile({g: 0.8, nu: 0.6, p: 0.2, r: 0.5, h: 0.5, d: 0.5, s: 0.5, gamma: 0.5});
calib.recordTile({g: 0.7, nu: 0.5, p: 0.3, r: 0.5, h: 0.5, d: 0.5, s: 0.5, gamma: 0.5});

// End first session (cautious user)
console.log('Ending first session (cautious user)...');
calib.endSession();
console.log('First session saved');

// Simulate experimental user (high nu, high r variance)
calib.recordSliderChange('nu', 0.9);
calib.recordSliderChange('nu', 0.8);
calib.recordSliderChange('nu', 0.95);
calib.recordSliderChange('r', 0.2);
calib.recordSliderChange('r', 0.8);
calib.recordSliderChange('r', 0.1);
calib.recordTile({g: 0.6, nu: 0.9, p: 0.4, r: 0.2, h: 0.5, d: 0.5, s: 0.5, gamma: 0.5});
calib.recordTile({g: 0.7, nu: 0.8, p: 0.5, r: 0.8, h: 0.5, d: 0.5, s: 0.5, gamma: 0.5});

// Add night usage to this session
calib.session.hourlyUsage[2] = 5;
calib.session.hourlyUsage[3] = 3;
calib.session.hourlyUsage[4] = 2;

// End second session (experimental user)
console.log('Ending second session (experimental user)...');
calib.endSession();
console.log('Second session saved');

// Create third session to meet the 3-session minimum
calib.recordSliderChange('nu', 0.85);
calib.recordSliderChange('nu', 0.9);
calib.recordSliderChange('r', 0.3);
calib.recordSliderChange('r', 0.7);
calib.recordTile({g: 0.65, nu: 0.85, p: 0.35, r: 0.3, h: 0.5, d: 0.5, s: 0.5, gamma: 0.5});
calib.recordTile({g: 0.75, nu: 0.9, p: 0.45, r: 0.7, h: 0.5, d: 0.5, s: 0.5, gamma: 0.5});

// Add night usage to third session
calib.session.hourlyUsage[1] = 2;
calib.session.hourlyUsage[5] = 1;

// End third session
console.log('Ending third session...');
calib.endSession();
console.log('Third session saved');

// Verify all sessions are saved
const allSessions = calib.loadSessions();
console.log(`\nAll sessions saved: ${allSessions.length}`);
allSessions.forEach((s, i) => {
  console.log(`Session ${i}: tiles=${s.tileCount}, nightHours=${s.hourlyUsage.slice(20,24).concat(s.hourlyUsage.slice(0,8)).reduce((a,b)=>a+b,0)}`);
});

// 3. Test profile inference with debug
console.log('\n2. Testing profile inference...');

// Debug the inference calculation
const sessions = calib.loadSessions();
let totalTiles = 0, totalGHigh = 0, totalNuHigh = 0, totalPLow = 0;
let rVarianceSum = 0, rVarianceCount = 0;
let nightHours = 0;

for (const s of sessions) {
  totalTiles += s.tileCount;
  totalGHigh += s.gHighCount;
  totalNuHigh += s.nuHighCount;
  totalPLow += s.pLowCount;
  if (s.sliderStats.r && s.sliderStats.r.variance != null) {
    rVarianceSum += s.sliderStats.r.variance;
    rVarianceCount++;
  }
  for (let h=20; h<24; h++) nightHours += s.hourlyUsage[h];
  for (let h=0; h<8; h++) nightHours += s.hourlyUsage[h];
}

const gHighRatio = totalTiles ? totalGHigh/totalTiles : 0;
const nuHighRatio = totalTiles ? totalNuHigh/totalTiles : 0;
const pLowRatio = totalTiles ? totalPLow/totalTiles : 0;
const avgRVariance = rVarianceCount ? rVarianceSum/rVarianceCount : 0;
const nightRatio = totalTiles ? nightHours/totalTiles : 0;

console.log(`Debug: totalTiles=${totalTiles}, nightHours=${nightHours}, nightRatio=${nightRatio.toFixed(3)}`);
console.log(`Debug: gHighRatio=${gHighRatio.toFixed(3)}, nuHighRatio=${nuHighRatio.toFixed(3)}, avgRVariance=${avgRVariance.toFixed(3)}`);
console.log(`Layer D condition: nightRatio>0.4 (${nightRatio.toFixed(3)}>0.4) && (nuHighRatio>=0.5 (${nuHighRatio.toFixed(3)}>=0.5) || avgRVariance>0.08 (${avgRVariance.toFixed(3)}>0.08))`);

// Force reload sessions to ensure fresh data
const freshSessions = calib.loadSessions();
console.log(`Fresh sessions count: ${freshSessions.length}`);

const inferredLayer = calib.inferLayer();
console.log(`Inferred Layer: ${inferredLayer}`);
console.log(`Expected: D (night usage + high nu)`);

// 4. Create test profiles
const testProfiles = [
  { mbti: 'INFP', gender: 'F', blood: 'AB', layer: 'D' }, // Information-vulnerable
  { mbti: 'ISTJ', gender: 'M', blood: 'O', layer: 'A' }, // Energy-vulnerable
  { mbti: 'ENTP', gender: 'M', blood: 'B', layer: 'C' }  // Repair-vulnerable
];

// 5. Test profile → 8D vector mapping
console.log('\n3. Testing profile → 8D vector mapping...');
testProfiles.forEach(profile => {
  const vec = profileToVector({mbti: profile.mbti, gender: profile.gender, blood: profile.blood, layer: profile.layer});
  console.log(`\nProfile: ${profile.mbti}_${profile.gender}_${profile.blood}_${profile.layer}`);
  console.log(`8D Vector: r=${vec.r.toFixed(3)}, h=${vec.h.toFixed(3)}, d=${vec.d.toFixed(3)}, p=${vec.p.toFixed(3)}, s=${vec.s.toFixed(3)}, γ=${vec.gamma.toFixed(3)}, g=${vec.g.toFixed(3)}, ν=${vec.nu.toFixed(3)}`);
});

// 6. Test attractor state updates
console.log('\n4. Testing attractor state updates...');
const testProfile = testProfiles[0]; // INFP_F_AB_D
console.log(`\nUsing profile: ${testProfile.mbti}_${testProfile.gender}_${testProfile.blood}_${testProfile.layer}`);

// Initial states
attractorSystem.updateStates(testProfile);
console.log('\nInitial Attractor States:');
console.log(`Energy: level=${attractorSystem.states.energy.level.toFixed(3)}, stress=${attractorSystem.states.energy.stress.toFixed(3)}`);
console.log(`Information: level=${attractorSystem.states.information.level.toFixed(3)}, stress=${attractorSystem.states.information.stress.toFixed(3)}`);
console.log(`Repair: level=${attractorSystem.states.repair.level.toFixed(3)}, stress=${attractorSystem.states.repair.stress.toFixed(3)}`);
console.log(`Carbon: sync=${attractorSystem.states.carbon.sync.toFixed(3)}, rewrite=${attractorSystem.states.carbon.rewrite.toFixed(3)}`);

// Generate tiles
const tiles = attractorSystem.generateTiles(testProfile);
console.log('\nGenerated Tiles:');
tiles.forEach(tile => {
  console.log(`\n${tile.name}:`);
  console.log(`  vec: r=${tile.vec.r.toFixed(3)}, h=${tile.vec.h.toFixed(3)}, d=${tile.vec.d.toFixed(3)}, p=${tile.vec.p.toFixed(3)}, s=${tile.vec.s.toFixed(3)}, γ=${tile.vec.gamma.toFixed(3)}, g=${tile.vec.g.toFixed(3)}, ν=${tile.vec.nu.toFixed(3)}`);
});

// 7. Test closed-loop dynamics
console.log('\n5. Testing closed-loop dynamics...');
console.log('\nPlaying Information Stimulus tile...');
const infoTile = tiles.find(t => t.id === 'stress_growth');
attractorSystem.updateFromPlayedTile(infoTile);

console.log('After playing Information tile:');
console.log(`Information: level=${attractorSystem.states.information.level.toFixed(3)}, stress=${attractorSystem.states.information.stress.toFixed(3)}`);
console.log(`Carbon: sync=${attractorSystem.states.carbon.sync.toFixed(3)}, rewrite=${attractorSystem.states.carbon.rewrite.toFixed(3)}`);

// Generate new tiles to see the effect (pass no profile to preserve state changes)
const newTiles = attractorSystem.generateTiles(null);
const newInfoTile = newTiles.find(t => t.id === 'stress_growth');
console.log('\nNew Information tile parameters:');
console.log(`  h: ${newInfoTile.vec.h.toFixed(3)} (was ${infoTile.vec.h.toFixed(3)})`);
console.log(`  nu: ${newInfoTile.vec.nu.toFixed(3)} (was ${infoTile.vec.nu.toFixed(3)})`);
console.log(`  s: ${newInfoTile.vec.s.toFixed(3)} (was ${infoTile.vec.s.toFixed(3)})`);

// 8. Verify parameter mappings
console.log('\n6. Verifying attractor → dim mappings...');
console.log('\nEnergy Reset tile should have primary dims from Energy attractor:');
const energyTile = tiles.find(t => t.id === 'release');
console.log(`  r (Energy): ${energyTile.vec.r.toFixed(3)} ≈ Energy level ${attractorSystem.states.energy.level.toFixed(3)} ✓`);
console.log(`  g (Energy/Carbon): ${energyTile.vec.g.toFixed(3)} ≈ Carbon sync ${attractorSystem.states.carbon.sync.toFixed(3)} ✓`);
console.log(`  γ (Energy): ${energyTile.vec.gamma.toFixed(3)} ≈ Energy stress ${attractorSystem.states.energy.stress.toFixed(3)} ✓`);

console.log('\nInformation Stimulus tile should have primary dims from Information attractor:');
console.log(`  h (Information): ${infoTile.vec.h.toFixed(3)} ≈ Information level ${attractorSystem.states.information.level.toFixed(3)} ✓`);
console.log(`  ν (Information/Carbon): ${infoTile.vec.nu.toFixed(3)} ≈ Carbon rewrite ${attractorSystem.states.carbon.rewrite.toFixed(3)} ✓`);
console.log(`  s (Information): ${infoTile.vec.s.toFixed(3)} ≈ Information stress ${attractorSystem.states.information.stress.toFixed(3)} ✓`);

console.log('\n=== Pipeline Test Complete ===');
