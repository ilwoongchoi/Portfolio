# paleoclimate_model.py
# ==============================================================================
# BBR Paleoclimate Domain - Energy Balance Model
#
# Description:
#   Simulates global mean temperature based on energy balance.
#   Transitions between glacial and interglacial states.
#   Control Parameter (u): Solar forcing (W/m^2) or CO2 concentration (ppm).
# ==============================================================================

import numpy as np
from core.paleoclimate_params import BASE_PARAMS

def paleoclimate_ode(t, y, forcing):
    T = y[0]
    S0 = BASE_PARAMS["S0"]
    albedo_ice = BASE_PARAMS["albedo_ice"]
    albedo_noice = BASE_PARAMS["albedo_noice"]
    emissivity = BASE_PARAMS["emissivity"]
    sigma = BASE_PARAMS["sigma"]
    CO2_effect = BASE_PARAMS["CO2_effect"]
    latitude_threshold = BASE_PARAMS["latitude_threshold"]
    
    # 1. Calculate albedo based on temperature
    if T < 273.0:
        albedo = albedo_ice  # Full ice cover
    elif T > 298.0:
        albedo = albedo_noice # No ice cover
    else:
        # Linear interpolation between ice and no-ice albedo
        albedo = albedo_ice + (albedo_noice - albedo_ice) * ((T - 273.0) / (298.0 - 273.0))**5
    
    # 2. Calculate outgoing longwave radiation
    OLR = emissivity * sigma * T**4
    
    # 3. Energy balance equation
    # dT/dt = (Incoming solar radiation - Outgoing longwave radiation + Forcing) / Heat capacity
    # Incoming solar radiation = S0 * (1 - albedo) / 4
    # Forcing = CO2_effect * log(CO2 / 280)  (simplified CO2 forcing)
    
    incoming_solar = S0 * (1 - albedo) / 4.0
    dT = (incoming_solar - OLR + forcing) / 500.0  # Increased heat capacity
    
    return [dT]

def run_paleoclimate_simulation(forcing, t_end=500.0, rtol=1e-6, atol=1e-9):
    from scipy.integrate import solve_ivp
    from core.paleoclimate_params import DEFAULT_INIT
    
    y0 = [DEFAULT_INIT["T"]]
    
    sol = solve_ivp(paleoclimate_ode, (0, t_end), y0, args=(forcing,),
                    rtol=rtol, atol=atol)
    
    return sol
