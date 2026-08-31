// calibration.js — behavior‑only profile inference (no genre selection)
// All inference rules are deterministic; no Math.random().
export class CalibrationPad {
  constructor() {
    this.storageKey = 'circuit-calibration';
    this.maxSessions = 7;
    this.session = this.initSession();
  }

  initSession() {
    return {
      startTime: 0,
      sliderStats: {}, // dim -> {values:[], variance, avg}
      tileCount: 0,
      gHighCount: 0, // tiles with g > 0.5
      nuHighCount: 0, // tiles with nu > 0.7
      pLowCount: 0, // tiles with p < 0.3
      hourlyUsage: Array(24).fill(0) // UTC hour buckets
    };
  }

  // Call whenever a slider moves
  recordSliderChange(dim, value) {
    if (!this.session.sliderStats[dim]) {
      this.session.sliderStats[dim] = { values: [], variance: 0, avg: 0 };
    }
    this.session.sliderStats[dim].values.push(value);
    // Incremental variance/avg can be computed later; store raw for simplicity.
  }

  // Call whenever a tile is created
  recordTile(vec) {
    this.session.tileCount++;
    if (vec.g > 0.5) this.session.gHighCount++;
    if (vec.nu > 0.7) this.session.nuHighCount++;
    if (vec.p < 0.3) this.session.pLowCount++;
    const hour = new Date().getUTCHours();
    this.session.hourlyUsage[hour]++;
  }

  // End current session and persist
  endSession() {
    const sessions = this.loadSessions();
    // Compute final stats for this session
    for (const dim in this.session.sliderStats) {
      const vals = this.session.sliderStats[dim].values;
      if (vals.length === 0) continue;
      const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
      const variance = vals.reduce((acc,v)=>acc+(v-avg)*(v-avg),0)/vals.length;
      this.session.sliderStats[dim].avg = avg;
      this.session.sliderStats[dim].variance = variance;
    }
    sessions.push(this.session);
    if (sessions.length > this.maxSessions) sessions.shift();
    localStorage.setItem(this.storageKey, JSON.stringify(sessions));
    this.session = this.initSession();
  }

  loadSessions() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // Deterministic inference: return one of 'A','B','C','D'
  inferLayer() {
    const sessions = this.loadSessions();
    if (sessions.length < 3) return 'A'; // not enough data

    // Aggregate across sessions
    let totalTiles = 0, totalGHigh = 0, totalNuHigh = 0, totalPLow = 0;
    let rVarianceSum = 0, rVarianceCount = 0;
    let nightHours = 0; // 20-07 UTC
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

    // Heuristics (deterministic thresholds)
    const gHighRatio = totalTiles ? totalGHigh/totalTiles : 0;
    const nuHighRatio = totalTiles ? totalNuHigh/totalTiles : 0;
    const pLowRatio = totalTiles ? totalPLow/totalTiles : 0;
    const avgRVariance = rVarianceCount ? rVarianceSum/rVarianceCount : 0;
    const nightRatio = totalTiles ? nightHours/totalTiles : 0;

    // Layer D: strong night usage + entropy preference
    if (nightRatio > 0.4 && (nuHighRatio >= 0.5 || avgRVariance > 0.08)) return 'D';
    // Layer B: high g and nu, rhythmic activity
    if (gHighRatio > 0.6 && nuHighRatio > 0.4 && avgRVariance > 0.05) return 'B';
    // Layer C: moderate activity, not extreme
    if (totalTiles > 5 && gHighRatio > 0.3 && pLowRatio < 0.4) return 'C';
    // Default: stable
    return 'A';
  }

  // UI helper: summary metrics
  getSummary() {
    const sessions = this.loadSessions();
    const totalTiles = sessions.reduce((sum,s)=>sum+s.tileCount,0);
    const inferred = this.inferLayer();
    return { sessionsCount: sessions.length, totalTiles, inferredLayer: inferred };
  }

  getCurrentProfile() {
    // Return the calibrated profile if available
    if (this.currentProfile) {
      return this.currentProfile;
    }
    
    // Return default profile
    return { mbti: 'INTP', gender: 'M', blood: 'O', layer: 'A' };
  }
}
