#!/usr/bin/env python3
"""
Swift-Hohenberg 1/64 from-scratch sweep (reproducible + forensics)
Upgraded runner with semi-implicit Fourier scheme and energy diagnostics.

PDE: u_t = r u - (1 + ∇^2)^2 u - u^3
Scheme: Semi-implicit in Fourier space for the linear part, explicit for non-linear.
"""

import argparse
import json
import os
import sys
import time
import platform
import subprocess
import logging
import traceback
import shutil
from pathlib import Path
from datetime import datetime, timezone
import numpy as np

def setup_logging(log_path: Path):
    # Reset logging if already configured
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)
        
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        handlers=[
            logging.FileHandler(log_path, encoding='utf-8', mode="w"), # mode="w" to overwrite and prevent append stale logs
            logging.StreamHandler(sys.stdout)
        ]
    )

def get_run_meta():
    meta = {
        "python_version": sys.version,
        "platform": platform.platform(),
        "hostname": platform.node(),
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "cwd": os.getcwd(),
        "cmd_line": " ".join(sys.argv)
    }
    try:
        git_hash = subprocess.check_output(['git', 'rev-parse', 'HEAD'], stderr=subprocess.DEVNULL).decode().strip()
        meta["git_commit"] = git_hash
        dirty = subprocess.check_output(['git', 'status', '--porcelain'], stderr=subprocess.DEVNULL).decode().strip()
        meta["git_dirty"] = bool(dirty)
    except:
        meta["git_commit"] = "unknown"
        meta["git_dirty"] = "unknown"
    return meta

def compute_growth_rate_sigma(k2, r):
    """
    Compute linear growth rate σ(k) for Swift-Hohenberg equation.
    σ(k) = r - (1 - k²)²
    
    Returns growth rate for each mode k.
    Positive σ = growing mode, negative σ = decaying mode.
    """
    return r - (1.0 - k2)**2

def test_linear_growth_rate(args, r_val, k2, logger):
    """
    Unit test: Verify σ(k) has correct behavior.
    - At k=0: σ(0) = r - 1 (should be negative for r < 1)
    - At k=k0≈1: σ(k0) = r (maximum growth for small r)
    - For r>0, small k modes near k≈1 should grow
    """
    sigma = compute_growth_rate_sigma(k2, r_val)
    
    # Assertions for correctness
    assert np.isclose(sigma[0,0], r_val - 1.0, atol=1e-10), f"sigma(k=0)={sigma[0,0]}, expected r-1={r_val-1}"
    k2_at_1 = k2.flat[np.argmin(np.abs(k2.flat - 1.0))]
    idx_at_1 = np.unravel_index(np.argmin(np.abs(k2 - 1.0)), k2.shape)
    assert np.isclose(sigma[idx_at_1], r_val, atol=1e-10), f"sigma(k=1)={sigma[idx_at_1]}, expected r={r_val}"
    
    # Symmetry check: sigma should be symmetric in k (depends only on k^2)
    assert np.allclose(sigma, sigma[::-1, :], atol=1e-10), "sigma(k) not symmetric in kx"
    assert np.allclose(sigma, sigma[:, ::-1], atol=1e-10), "sigma(k) not symmetric in ky"
    
    # Find max growth rate and corresponding k
    max_idx = np.unravel_index(np.argmax(sigma), sigma.shape)
    k2_max = k2[max_idx]
    sigma_max = sigma[max_idx]
    
    logger.info("=== Linear Growth Rate Test (ASSERTIONS PASSED) ===")
    logger.info(f"r = {r_val:.6f}")
    logger.info(f"σ(k=0) = {sigma[0,0]:.6f} (expected: r-1 = {r_val-1:.6f}) ✓")
    logger.info(f"σ(k=1) = {sigma[idx_at_1]:.6f} (expected: r = {r_val:.6f}) ✓")
    logger.info(f"Max σ = {sigma_max:.6f} at k² = {k2_max:.6f} (k ≈ {np.sqrt(k2_max):.4f})")
    logger.info(f"Symmetry: verified ✓")
    
    # Verify signs
    if sigma_max > 0:
        logger.info(f"✓ Growing modes exist (σ_max = {sigma_max:.6f} > 0)")
    else:
        logger.warning(f"✗ No growing modes! σ_max = {sigma_max:.6f}")
    
    # For small r, check that most modes are damped
    frac_positive = np.sum(sigma > 0) / sigma.size
    frac_unstable = np.sum(sigma > 0.01) / sigma.size  # Threshold for "unstable"
    logger.info(f"Fraction of growing modes (σ>0): {frac_positive:.4f}")
    logger.info(f"Fraction of unstable modes (σ>0.01): {frac_unstable:.4f}")
    
    return sigma, frac_positive, frac_unstable

def compute_energy(u, r, k2, Lx, Ly):
    """
    Swift-Hohenberg Free Energy Functional F[u].
    F = ∫ [ -0.5*r*u^2 + 0.5*((1+∇^2)u)^2 + 0.25*u^4 ] dx dy
    """
    nx, ny = u.shape
    u_hat = np.fft.fft2(u)
    # (1 + ∇^2)u in Fourier is (1 - k2) * u_hat
    lap_part_hat = (1.0 - k2) * u_hat
    lap_part = np.fft.ifft2(lap_part_hat).real
    
    term1 = -0.5 * r * u**2
    term2 = 0.5 * (lap_part**2)
    term3 = 0.25 * u**4
    
    energy_density = term1 + term2 + term3
    # Average over domain multiplied by Lx*Ly is the integral
    total_energy = np.mean(energy_density) * (Lx * Ly)
    return float(total_energy)

def run_single_simulation(args, seed_idx, r_val, job_dir: Path, dt_override=None, original_status=None):
    dt = dt_override if dt_override is not None else args.dt
    suffix = "_dt_half" if dt_override is not None else ""
    
    job_dir.mkdir(parents=True, exist_ok=True)
    config_path = job_dir / f"config{suffix}.json"
    meta_path = job_dir / f"run_meta{suffix}.json"
    log_path = job_dir / f"log{suffix}.txt"
    metrics_path = job_dir / f"metrics{suffix}.csv"
    done_path = job_dir / f"DONE{suffix}.json"
    
    # Force clean start for this job_dir if not re-running dt_half
    if dt_override is None and args.force:
        for f in [config_path, meta_path, log_path, metrics_path, done_path]:
            if f.exists(): f.unlink()

    if done_path.exists() and not args.force:
        return status_from_done(done_path)

    setup_logging(log_path)
    logger = logging.getLogger()
    
    # Config & Meta
    config = vars(args).copy()
    config["run_id"] = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    config["seed_idx"] = seed_idx
    config["r"] = r_val
    config["dt"] = dt
    config["actual_seed"] = args.base_seed + seed_idx
    config["dx"] = args.Lx / args.nx
    config["dy"] = args.Ly / args.ny
    
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    with open(meta_path, "w") as f:
        json.dump(get_run_meta(), f, indent=2)

    logger.info(f"Starting SH Simulation (Fourier Semi-Implicit): seed={seed_idx}, r={r_val}, dt={dt}")
    
    start_time = time.time()
    status = "RECOVERABLE_ERROR"
    reason = "Unknown failure"
    
    try:
        nx, ny = args.nx, args.ny
        rng = np.random.default_rng(config["actual_seed"])
        u = rng.normal(0.0, 0.1, (nx, ny)).astype(np.float64)
        
        # Log initialization state
        u_l2_init = np.sqrt(np.mean(u**2))
        u_maxabs_init = np.max(np.abs(u))
        u_min_init = np.min(u)
        u_max_init = np.max(u)
        logger.info(f"=== AFTER INITIALIZATION (Step 0) ===")
        logger.info(f"  L2={u_l2_init:.8f}, MaxAbs={u_maxabs_init:.8f}, Min={u_min_init:.8f}, Max={u_max_init:.8f}")
        logger.info(f"  RNG Seed: {config['actual_seed']} (base={args.base_seed} + idx={seed_idx})")
        logger.info(f"  Initial field stats: mean={np.mean(u):.8f}, std={np.std(u):.8f}")
        
        # Fourier setup
        kx = 2 * np.pi * np.fft.fftfreq(nx, d=config["dx"])
        ky = 2 * np.pi * np.fft.fftfreq(ny, d=config["dy"])
        KX, KY = np.meshgrid(kx, ky, indexing="ij")
        k2 = KX**2 + KY**2
        
        # Run linear growth rate test
        sigma, frac_growing, frac_unstable = test_linear_growth_rate(args, r_val, k2, logger)
        logger.info(f"  Growing modes fraction: {frac_growing:.4f}, Unstable: {frac_unstable:.4f}")
        
        Lk = r_val - (1.0 - k2)**2
        denom = 1.0 - dt * Lk
        
        # Metrics Header
        with open(metrics_path, "w") as f:
            f.write("seed,r,step,t,dt,u_l2,u_maxabs,free_energy,nan_flag,inf_flag,blew_up_flag,wall_time_sec,u_min,u_max\n")
        
        # Log initial state to metrics
        with open(metrics_path, "a") as f:
            f.write(f"{seed_idx},{r_val},0,0.0,{dt},{u_l2_init:.8f},{u_maxabs_init:.8f},0.0,0,0,0,0.0,{u_min_init:.8f},{u_max_init:.8f}\n")

        energies = []
        consecutive_energy_increases = 0
        
        for step in range(1, args.nsteps + 1):
            u_hat = np.fft.fft2(u)
            N_hat = np.fft.fft2(-(u**3))
            u_hat_next = (u_hat + dt * N_hat) / denom
            u_next = np.fft.ifft2(u_hat_next).real
            
            # Log after step=1
            if step == 1:
                u_l2_1 = np.sqrt(np.mean(u_next**2))
                u_maxabs_1 = np.max(np.abs(u_next))
                u_min_1 = np.min(u_next)
                u_max_1 = np.max(u_next)
                u_mean_1 = np.mean(u_next)
                u_std_1 = np.std(u_next)
                l2_ratio = u_l2_1 / u_l2_init if u_l2_init > 0 else 0.0
                logger.info(f"=== AFTER STEP 1 ===")
                logger.info(f"  L2={u_l2_1:.8f}, MaxAbs={u_maxabs_1:.8f}, Min={u_min_1:.8f}, Max={u_max_1:.8f}")
                logger.info(f"  Mean={u_mean_1:.8f}, Std={u_std_1:.8f}")
                logger.info(f"  L2_ratio (step1/init): {l2_ratio:.6f}")
                logger.info(f"  Growing modes fraction: {frac_growing:.4f}")
                if u_l2_1 < u_l2_init * 0.99:
                    logger.warning("  Field DECAYING after step 1 (expected growth for r>0)")
                elif u_l2_1 > u_l2_init * 1.01:
                    logger.info("  Field GROWING after step 1 (expected for r>0)")
                else:
                    logger.info("  Field approximately constant after step 1")
            
            # Finite & Blowup check
            if not np.isfinite(u_next).all():
                status = "CONFIRMED_COLLAPSE" if dt_override is None or original_status == "CONFIRMED_COLLAPSE" else "NUMERICAL_INSTABILITY"
                reason = f"Numerical Divergence (NaN/Inf) at step {step}"
                logger.error(reason)
                break
                
            u_maxabs = np.max(np.abs(u_next))
            if u_maxabs > args.blowup_thr:
                status = "CONFIRMED_COLLAPSE" if dt_override is None or original_status == "CONFIRMED_COLLAPSE" else "NUMERICAL_INSTABILITY"
                reason = f"Physical Collapse (Blowup={u_maxabs:.2f}) at step {step}"
                logger.error(reason)
                break
            
            u = u_next
            
            if step % args.write_every == 0 or step == args.nsteps:
                energy = compute_energy(u, r_val, k2, args.Lx, args.Ly)
                u_l2 = np.sqrt(np.mean(u**2))
                wall_time = time.time() - start_time
                
                if energies and energy > energies[-1] + 1e-10:
                    consecutive_energy_increases += 1
                else:
                    consecutive_energy_increases = 0
                
                energies.append(energy)
                with open(metrics_path, "a") as f:
                    f.write(f"{seed_idx},{r_val},{step},{step*dt},{dt},{u_l2:.8f},{u_maxabs:.8f},{energy:.8f},0,0,0,{wall_time:.2f},{np.min(u):.8f},{np.max(u):.8f}\n")
                
                logger.info(f"Step {step}/{args.nsteps}: Energy={energy:.6f}, MaxAbs={u_maxabs:.6f}")
                
                if consecutive_energy_increases >= 3:
                    status = "NUMERICAL_INSTABILITY"
                    reason = f"Energy consistently increasing at step {step} (Numerical instability)"
                    logger.error(reason)
                    break

                if wall_time > args.timeout_sec:
                    status = "RECOVERABLE_ERROR"
                    reason = f"Timeout reached: {wall_time:.1f}s"
                    break
        else:
            status = "STABLE_BASIN"
            reason = "Completed all steps"
            logger.info(status)

    except Exception as e:
        status = "RECOVERABLE_ERROR"
        reason = f"Exception: {type(e).__name__}: {str(e)}"
        logger.error(reason)

    # DT Consistency logic: Finalize status if this was a dt/2 run
    final_status = status
    if dt_override is not None:
        if original_status == "CONFIRMED_COLLAPSE":
            if status == "CONFIRMED_COLLAPSE":
                final_status = "CONFIRMED_COLLAPSE"
                reason = f"Confirmed physical collapse at both dt and dt/2. Reason: {reason}"
            else:
                final_status = "NUMERICAL_INSTABILITY"
                reason = f"Downgraded: dt failed but dt/2 was {status}. Original reason: {reason}"
        
        # Option (A): Update the original DONE.json with the consistency-checked status
        orig_done_path = job_dir / "DONE.json"
        if orig_done_path.exists():
            with open(orig_done_path, 'r') as f:
                orig_data = json.load(f)
            orig_data["status"] = final_status
            orig_data["reason"] = f"{orig_data.get('reason')} | dt-consistency check: {reason}"
            orig_data["dt_consistency_verified"] = True
            with open(orig_done_path, 'w') as f:
                json.dump(orig_data, f, indent=2)

    done_data = {
        "run_id": config["run_id"],
        "status": final_status,
        "reason": reason,
        "dt": dt,
        "Lx": args.Lx, "Ly": args.Ly, "nx": args.nx, "ny": args.ny,
        "wall_time_sec": time.time() - start_time,
        "last_step": step if 'step' in locals() else 0,
    }
    with open(done_path, "w") as f:
        json.dump(done_data, f, indent=2)
    
    return final_status

def status_from_done(path: Path):
    try:
        with open(path, "r") as f:
            return json.load(f).get("status", "UNKNOWN")
    except:
        return "UNKNOWN"

def main():
    parser = argparse.ArgumentParser(description="Swift-Hohenberg Fourier Semi-Implicit Runner v2")
    parser.add_argument("--outdir", required=True)
    parser.add_argument("--seeds", default="0-0")
    parser.add_argument("--r-center", type=float, default=0.015625)
    parser.add_argument("--r-span", type=float, default=0.0002)
    parser.add_argument("--r-count", type=int, default=3)
    parser.add_argument("--nx", type=int, default=128)
    parser.add_argument("--ny", type=int, default=128)
    parser.add_argument("--Lx", type=float, default=50.0)
    parser.add_argument("--Ly", type=float, default=50.0)
    parser.add_argument("--dt", type=float, default=0.01)
    parser.add_argument("--nsteps", type=int, default=10000)
    parser.add_argument("--write-every", type=int, default=2000)
    parser.add_argument("--timeout-sec", type=int, default=600)
    parser.add_argument("--blowup-thr", type=float, default=10.0)
    parser.add_argument("--base-seed", type=int, default=440811)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--check-dt-consistency", action="store_true")
    parser.add_argument("--sanity", action="store_true", help="Run sanity check: r=0.2, steps=2000, seed=0")
    parser.add_argument("--benchmark", action="store_true", help="Run benchmark mode: small grid, writes to out/benchmark_sh/")
    
    args = parser.parse_args()
    
    # Benchmark mode: small grid for quick testing
    if args.benchmark:
        print("=== BENCHMARK MODE ===")
        print("Settings: 64x64 grid, 5000 steps, seed=0")
        print("Output: out/benchmark_sh/")
        print("=" * 50)
        args.nx = 64
        args.ny = 64
        args.nsteps = 5000
        args.write_every = 100
        args.base_seed = 0
        args.force = True
    
    # Sanity mode: quick single run with known parameters
    if args.sanity:
        print("=== SANITY RUN MODE ===")
        print("Parameters: r=0.2, steps=2000, seed=0")
        print("Expected: Clear pattern formation (r >> r_c)")
        print("=" * 50)
        args.r_center = 0.2
        args.r_span = 0.0
        args.r_count = 1
        args.seeds = "0-0"
        args.base_seed = 0
        args.nsteps = 2000
        args.write_every = 100
        args.force = True
    
    seed_parts = args.seeds.split("-")
    seed_range = range(int(seed_parts[0]), int(seed_parts[1]) + 1)
    r_vals = np.linspace(args.r_center - args.r_span, args.r_center + args.r_span, args.r_count)
    outdir = Path(args.outdir)

    for s in seed_range:
        for r in r_vals:
            job_dir = outdir / f"seed_{s:03d}_r_{r:.8f}"
            status = run_single_simulation(args, s, r, job_dir)
            
            if args.check_dt_consistency and status == "CONFIRMED_COLLAPSE":
                print(f"Candidate collapse at r={r:.8f}. Running dt/2 consistency check...")
                run_single_simulation(args, s, r, job_dir, dt_override=args.dt/2.0, original_status=status)

if __name__ == "__main__":
    main()
