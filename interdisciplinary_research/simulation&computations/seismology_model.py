# seismology_model.py
# ==============================================================================
# BBR Seismology Domain - Earthquake Stick-Slip Model (Time-Accumulative)
#
# Description:
#   Simulates earthquake occurrence through energy accumulation over long time scales.
#   Control Parameter (u): Fault stiffness 'k'.
#   Key: Tracks accumulated elastic energy; when it exceeds a threshold, earthquake occurs.
# ==============================================================================

import numpy as np
from core.seismology_params import BASE_PARAMS

def seismology_ode(t, y, k):
    v, theta, E_accum = y  # Added energy accumulator
    sigma_n = BASE_PARAMS["sigma_n"]
    v_lp = BASE_PARAMS["v_lp"]
    a = BASE_PARAMS["a"]
    b = BASE_PARAMS["b"]
    L = BASE_PARAMS["L"]
    f0 = 0.6
    v_star = 1e-6
    
    # 1. State evolution (Aging Law)
    dtheta = 1.0 - (v * theta / L)
    
    # 2. Velocity evolution
    dv = (v / a) * ( (k/sigma_n)*(v_lp - v) - b * dtheta / theta )
    
    # 3. Energy accumulation: Elastic energy stored in the spring
    # E = 0.5 * k * (displacement)^2
    # Displacement rate = v_lp - v (slip deficit)
    # Over time, if v < v_lp, energy accumulates
    slip_deficit = v_lp - v
    dE_accum = k * slip_deficit * v_lp  # Energy accumulation rate
    
    return [dv, dtheta, dE_accum]

def run_seismology_simulation(k, t_end=10000.0, rtol=1e-6, atol=1e-9):
    """
    Extended time scale simulation with energy tracking.
    t_end is now in 'normalized time units' (can represent years with proper scaling).
    """
    from scipy.integrate import solve_ivp
    from core.seismology_params import DEFAULT_INIT
    
    # Initial conditions: velocity, state, and zero accumulated energy
    y0 = [DEFAULT_INIT["v"], DEFAULT_INIT["theta"], 0.0]
    
    # Use adaptive time stepping with dense output for long simulations
    sol = solve_ivp(
        seismology_ode, (0, t_end), y0, args=(k,),
        rtol=rtol, atol=atol, method='LSODA',
        dense_output=True
    )
    
    return sol
