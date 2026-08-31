# paleoclimate_convergence.py
# ==============================================================================
# BBR Bifurcation Geometry - Verification Runner for Paleoclimate (v0.5 Schema)
# ==============================================================================

import json
import os
import numpy as np
import argparse
import time
from scipy.integrate import solve_ivp
from paleoclimate_model import paleoclimate_ode
from core.paleoclimate_params import BASE_PARAMS, DEFAULT_INIT

# --- CONSTANTS ---
LOG_DIR = os.path.join('atlas', 'data')
MAIN_LOG_FILE = os.path.join(LOG_DIR, 'BBR_GEOMETRY_LOG.jsonl')
CURVE_LOG_FILE = os.path.join(LOG_DIR, 'paleoclimate_curve.jsonl')
ICE_COVER_THRESHOLD = 273.0  # Temperature below which ice cover is significant

# --- SIMULATION ---
def get_label(forcing, t_end, ic_jitter=1e-3, rtol=1e-6, atol=1e-9):
    T0 = DEFAULT_INIT["T"] + np.random.uniform(-ic_jitter * 10, ic_jitter * 10)
    y0 = [T0]
    
    try:
        sol = solve_ivp(paleoclimate_ode, (0, t_end), y0, args=(forcing,), rtol=rtol, atol=atol)
        if not sol.success:
            return "collapse" # Solver failure
        
        final_T = sol.y[0, -1]
        return "collapse" if final_T < ICE_COVER_THRESHOLD else "alive" # Ice age = collapse
    except Exception:
        return "collapse"

# --- BBR v0.5 PROTOCOL ---
def find_bracket(rtol, atol):
    low, high = -50.0, 20.0  # Forcing range (W/m^2)
    
    if get_label(low, 100, 0, rtol, atol) == "collapse":
        return None, None, "COLLAPSE_AT_MIN_FORCING"
    
    if get_label(high, 100, 0, rtol, atol) == "alive":
        # Expand high until collapse
        for _ in range(10):
            high *= 1.5
            if get_label(high, 100, 0, rtol, atol) == "collapse":
                break
        else:
            return None, None, "NO_COLLAPSE_AT_MAX_FORCING"

    # Bisection
    for _ in range(100):
        if (high - low) < 1e-6:
            return low, high, "OK"
        mid = (low + high) / 2
        if get_label(mid, 100, 0, rtol, atol) == "collapse":
            high = mid
        else:
            low = mid
    return low, high, "OK"

# --- MAIN ---
def main():
    parser = argparse.ArgumentParser(description="Run Paleoclimate Domain BBR Analysis (v0.5).")
    parser.add_argument('--reps', type=int, default=20, help='Repetitions per sigma point.')
    parser.add_argument('--seed', type=int, default=int(time.time()), help='Random seed.')
    parser.add_argument('--t_end', type=float, default=500.0, help='Simulation time.')
    parser.add_argument('--rtol', type=float, default=1e-6)
    parser.add_argument('--atol', type=float, default=1e-9)
    args = parser.parse_args()

    np.random.seed(args.seed)
    os.makedirs(LOG_DIR, exist_ok=True)
    
    print("="*60)
    print("  BBR v0.5 RUNNER: PALEOCLIMATE DOMAIN (GLACIAL TRANSITION)")
    print("="*60)

    print(f"Finding bracket...")
    lo_alive, hi_collapse, status = find_bracket(args.rtol, args.atol)
    if status != "OK":
        print(f"Failed to find bracket: {status}")
        return
        
    u_crit = (lo_alive + hi_collapse) / 2.0
    w_band_u = hi_collapse - lo_alive
    print(f"  Bracket: [{lo_alive:.6f}, {hi_collapse:.6f}]")
    print(f"  u_crit (forcing): {u_crit:.6f}, w_band_u: {w_band_u:.6e}")

    label_T = get_label(u_crit, args.t_end, 0, args.rtol, args.atol)
    label_2T = get_label(u_crit, args.t_end * 2, 0, args.rtol, args.atol)
    direct_label_flip = label_T != label_2T
    print(f"  Label Flip Check (T vs 2T): {direct_label_flip}")

    record = {
        "timestamp": time.time(), "domain": "paleoclimate", "protocol_version": "0.5",
        "u_crit": u_crit, "bracket": [lo_alive, hi_collapse], "w_band_u": w_band_u,
        "t_end": args.t_end, "direct_label_flip": direct_label_flip,
        "solver_rtol": args.rtol, "solver_atol": args.atol, "seed": args.seed,
    }
    with open(MAIN_LOG_FILE, 'a') as f:
        f.write(json.dumps(record) + '\n')
    print(f"  Main record logged to {MAIN_LOG_FILE}")

    sigma_grid = np.linspace(-3, 3, 11)
    curve_data = {"metadata": record, "samples": []}
    print(f"\nSampling collapse curve for {len(sigma_grid)} sigma points...")

    for sigma in sigma_grid:
        u = u_crit + sigma * (w_band_u / 2.0)
        outcomes = []
        for _ in range(args.reps):
            label = get_label(u, args.t_end, 1e-3, args.rtol, args.atol)
            outcomes.append(1 if label == "collapse" else 0)
        
        p_collapse = np.mean(outcomes)
        p_collapse_std = np.std(outcomes) / np.sqrt(len(outcomes)) if len(outcomes) > 1 else 0
        curve_data["samples"].append({
            "sigma": sigma, "u": u, "p_collapse": p_collapse, 
            "p_collapse_stderr": p_collapse_std, "reps": args.reps
        })
        print(f"  sigma={sigma:5.2f}, u={u:.6f} -> P(collapse)={p_collapse:.3f}")
        
    with open(CURVE_LOG_FILE, 'w') as f:
        json.dump(curve_data, f, indent=2)
    print(f"\nCollapse curve data saved to {CURVE_LOG_FILE}")
    print("="*60)

if __name__ == "__main__":
    main()
