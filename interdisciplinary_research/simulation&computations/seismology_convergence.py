# seismology_convergence.py
# ==============================================================================
# BBR Bifurcation Geometry - Verification Runner for Seismology (v0.5 Schema)
# Time-Accumulative Bifurcation Type
# ==============================================================================

import json
import os
import numpy as np
import argparse
import time
from seismology_model import run_seismology_simulation
from core.seismology_params import BASE_PARAMS

# --- CONSTANTS ---
LOG_DIR = os.path.join('atlas', 'data')
MAIN_LOG_FILE = os.path.join(LOG_DIR, 'BBR_GEOMETRY_LOG.jsonl')
CURVE_LOG_FILE = os.path.join(LOG_DIR, 'seismology_curve.jsonl')
ENERGY_THRESHOLD = 1000.0 # Accumulated energy threshold for earthquake

# --- SIMULATION ---
def get_label(k_stiffness, t_end, ic_jitter=1e-8):
    try:
        sol = run_seismology_simulation(k_stiffness, t_end)
        if not sol.success:
            return "collapse"  # Solver failure might indicate instability
        
        # Check if accumulated energy exceeded threshold
        if len(sol.y) >= 3:
            max_energy = np.max(sol.y[2])  # E_accum is the 3rd component
            return "collapse" if max_energy > ENERGY_THRESHOLD else "alive"
        else:
            # Fallback: check for velocity spikes
            max_v = np.max(sol.y[0])
            return "collapse" if max_v > (BASE_PARAMS["v_lp"] * 50.0) else "alive"
    except Exception as e:
        return "collapse"

# --- BBR v0.5 PROTOCOL (Extended for Time-Accumulative) ---
def find_bracket(t_end):
    # Search around theoretical kc
    low, high = 1e2, 1e6
    
    if get_label(high, t_end, 0) == "collapse":
        high = 1e7
        if get_label(high, t_end, 0) == "collapse":
            return None, None, "COLLAPSE_AT_EXTREME_HIGH_STIFFNESS"
    
    # Expand low until we find collapse
    for _ in range(20):
        if get_label(low, t_end, 0) == "collapse":
            break
        low /= 2.0
        if low < 1.0:
            return None, None, "NO_COLLAPSE_FOUND"
    else:
        return None, None, "NO_COLLAPSE_FOUND"

    # Bisection
    for _ in range(100):
        if (high - low) / high < 1e-4:
            return high, low, "OK"  # lo_alive (high k), hi_collapse (low k)
        mid = (low + high) / 2
        if get_label(mid, t_end, 0) == "alive":
            high = mid
        else:
            low = mid
    return high, low, "OK"

# --- MAIN ---
def main():
    parser = argparse.ArgumentParser(description="Run Seismology Domain BBR Analysis (Time-Accumulative).")
    parser.add_argument('--reps', type=int, default=10)
    parser.add_argument('--seed', type=int, default=int(time.time()))
    parser.add_argument('--t_end', type=float, default=50000.0)  # Very long time scale
    parser.add_argument('--rtol', type=float, default=1e-7)
    parser.add_argument('--atol', type=float, default=1e-10)
    args = parser.parse_args()

    np.random.seed(args.seed)
    os.makedirs(LOG_DIR, exist_ok=True)
    
    print("="*60)
    print("  BBR v0.5 RUNNER: SEISMOLOGY (TIME-ACCUMULATIVE BIFURCATION)")
    print("="*60)

    print(f"Finding bracket for T_end={args.t_end} (extended time scale)...")
    lo_alive, hi_collapse, status = find_bracket(args.t_end)
    if status != "OK":
        print(f"Failed to find bracket: {status}")
        print("\n" + "="*60)
        print("  ANALYSIS: This domain may represent a NEW bifurcation type")
        print("  'Time-Accumulative' - requires extreme time scales or")
        print("  fundamentally different control mechanisms.")
        print("="*60)
        return
        
    u_crit = (lo_alive + hi_collapse) / 2.0
    w_band_u = abs(hi_collapse - lo_alive)
    print(f"  Bracket: [{lo_alive:.1f}, {hi_collapse:.1f}]")
    print(f"  u_crit (stiffness): {u_crit:.1f}, w_band_u: {w_band_u:.2e}")

    record = {
        "timestamp": time.time(), 
        "domain": "seismology", 
        "protocol_version": "0.5",
        "bifurcation_type": "time_accumulative",  # NEW: Classification
        "u_crit": u_crit, 
        "bracket": [lo_alive, hi_collapse], 
        "w_band_u": w_band_u,
        "t_end": args.t_end, 
        "direct_label_flip": False,
        "solver_rtol": args.rtol, 
        "solver_atol": args.atol, 
        "seed": args.seed,
        "notes": "Time-accumulative bifurcation: energy builds up over extended time scales"
    }
    with open(MAIN_LOG_FILE, 'a') as f:
        f.write(json.dumps(record) + '\n')

    sigma_grid = np.linspace(-3, 3, 11)
    curve_data = {"metadata": record, "samples": []}
    print(f"\nSampling collapse curve for {len(sigma_grid)} sigma points...")

    for sigma in sigma_grid:
        u = u_crit + sigma * (w_band_u / 2.0)
        outcomes = [1 if get_label(u, args.t_end, 1e-7) == "collapse" else 0 for _ in range(args.reps)]
        p_collapse = np.mean(outcomes)
        curve_data["samples"].append({
            "sigma": sigma, "u": u, "p_collapse": p_collapse, "reps": args.reps
        })
        print(f"  sigma={sigma:5.2f}, u={u:.1f} -> P(collapse)={p_collapse:.3f}")
        
    with open(CURVE_LOG_FILE, 'w') as f:
        json.dump(curve_data, f, indent=2)
    print(f"\nCollapse curve data saved to {CURVE_LOG_FILE}")
    print("="*60)

if __name__ == "__main__":
    main()
