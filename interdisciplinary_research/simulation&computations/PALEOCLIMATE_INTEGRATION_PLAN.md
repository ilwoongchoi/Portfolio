# Paleoclimatology Integration Plan for Soil Health Model

## BBR Claim Card: Paleoclimate-Validated Soil Model

**System:** Soil biogeochemical cycles (C, N, P, S) with climate forcing  
**Controls U:** (temperature, precipitation, CO₂, sea level, ice volume)  
**Observables y:** (soil carbon, N/P stocks, GHG fluxes, δ¹³C, δ¹⁵N)  
**Coherence C:** Soil health index (0-1) derived from multiple proxies  
**Model M:** Full mechanistic model vs. Paleoclimate-constrained reduced model  
**Residual r:** r(U) = y_observed(t) - y_model(U, t) where t spans paleoclimate history  
**Boundary Score B(U):** B(U) = ||r(U)|| over paleoclimate time series  
**Basins:** 
  - High coherence: Glacial-interglacial transitions, stable warm periods
  - Low coherence: Rapid climate transitions, mass extinctions
**Boundary Band:** Regions where model fails to match paleoclimate records  
**Falsifier:** If model cannot reproduce PETM carbon spike or Younger Dryas, claim fails

---

## Phase 1: Paleoclimate Proxy Data Integration

### 1.1 Ice Core Records (Antarctica, Greenland)
- **CO₂, CH₄, N₂O concentrations** (last 800,000 years)
- **Temperature proxies** (δ¹⁸O, δD)
- **Dust deposition** (nutrient inputs)
- **Source:** EPICA, Vostok, GISP2 datasets

### 1.2 Marine Sediment Cores
- **Carbon isotope records** (δ¹³C) - organic matter source
- **Nitrogen isotope records** (δ¹⁵N) - N cycling processes
- **Benthic foraminifera** - deep ocean conditions
- **Source:** Ocean Drilling Program (ODP) data

### 1.3 Terrestrial Records
- **Loess sequences** - soil formation, dust deposition
- **Peat cores** - wetland carbon accumulation
- **Lake sediments** - regional climate, nutrient cycling
- **Source:** Global Paleoclimate databases

### 1.4 Key Time Periods for Validation
- **Last Glacial Maximum (LGM, ~21 ka)**: Low CO₂, low temperature, high dust
- **Holocene Optimum (~6-9 ka)**: Warm, stable, high productivity
- **Younger Dryas (~12.9-11.7 ka)**: Rapid cooling, abrupt transition
- **PETM (~56 Ma)**: Rapid warming, carbon release
- **Pleistocene Glacial-Interglacial Cycles**: Regular oscillations

---

## Phase 2: Parameter Constraint from Paleoclimate

### 2.1 Carbon Cycle Constraints
- **Soil carbon residence time**: Constrained by δ¹³C records
- **Decomposition rates**: Must match glacial-interglacial C accumulation
- **Priming effects**: Tested against rapid warming events
- **Carbon saturation**: Constrained by maximum observed C stocks

### 2.2 Nitrogen Cycle Constraints
- **N fixation rates**: Must match δ¹⁵N records
- **Denitrification**: Constrained by N₂O ice core records
- **N immobilization**: Tested against productivity changes

### 2.3 Phosphorus Cycle Constraints
- **Weathering rates**: Must match dust deposition records
- **P sorption**: Constrained by soil formation rates
- **P limitation**: Tested against productivity proxies

### 2.4 Climate Forcing Functions
- **Temperature sensitivity (Q₁₀)**: Constrained by glacial-interglacial transitions
- **Moisture effects**: Tested against precipitation proxies
- **CO₂ fertilization**: Constrained by CO₂-plant growth relationships

---

## Phase 3: Model Structure Refinement

### 3.1 Remove Unconstrained Parameters
- Parameters that cannot be validated against paleoclimate → mark as [HYPOTHESIS]
- Parameters that contradict paleoclimate → remove or constrain

### 3.2 Prioritize Core Mechanisms
Based on paleoclimate validation, prioritize:
1. **Temperature-moisture interactions** (glacial cycles)
2. **CO₂-plant-soil feedbacks** (PETM, glacial transitions)
3. **Redox processes** (wetland formation during warm periods)
4. **Nutrient limitation** (productivity changes)

### 3.3 Add Temporal Dynamics
- **Lag times**: Constrained by rate of change in paleoclimate records
- **Hysteresis**: Tested against glacial-interglacial asymmetry
- **Tipping points**: Identified from abrupt transitions (Younger Dryas)

---

## Phase 4: Validation Protocol

### 4.1 Forward Simulation
Run model with paleoclimate forcing:
- Temperature, precipitation, CO₂ from ice cores
- Sea level, ice volume from sea level records
- Dust deposition from ice cores

### 4.2 Comparison with Proxies
Compare model outputs to:
- Soil carbon stocks (from loess, peat cores)
- δ¹³C, δ¹⁵N (from sediment cores)
- GHG fluxes (from ice core gas records)

### 4.3 Residual Calculation
r(t) = y_proxy(t) - y_model(U_paleo(t), t)

### 4.4 Boundary Score
B(U) = ||r|| over entire paleoclimate time series

### 4.5 Falsification Criteria
If B(U) > threshold for any major climate transition → model fails

---

## Phase 5: Parameter Calibration

### 5.1 Bayesian Calibration
Use paleoclimate data to constrain parameter priors:
- Parameters that match paleoclimate → narrow priors
- Parameters that don't match → wide priors or remove

### 5.2 Sensitivity Analysis
Identify which parameters most affect paleoclimate fit:
- High sensitivity → well-constrained
- Low sensitivity → can be simplified

### 5.3 Uncertainty Quantification
Quantify model uncertainty based on paleoclimate residuals

---

## Implementation Steps

1. **Data Acquisition**
   - Download ice core data (NOAA, NSIDC)
   - Access marine sediment databases (Pangaea, ODP)
   - Compile terrestrial records (Neotoma, NOAA)

2. **Data Processing**
   - Interpolate to common time grid
   - Convert proxies to model variables
   - Handle age model uncertainties

3. **Model Modification**
   - Add paleoclimate forcing module
   - Implement temporal integration
   - Add proxy output calculations

4. **Validation Loop**
   - Run forward simulations
   - Calculate residuals
   - Adjust parameters
   - Iterate until convergence

5. **Documentation**
   - Document which parameters are paleoclimate-constrained
   - Mark unconstrained parameters as [HYPOTHESIS]
   - Provide falsifiers for each claim

---

## Expected Outcomes

1. **Reduced Parameter Set**: Only parameters validated against paleoclimate
2. **Improved Predictions**: Model constrained by Earth history
3. **BBR Compliance**: All parameters either [EMPIRICAL] or [HYPOTHESIS]
4. **Falsifiable Claims**: Clear criteria for model rejection

---

## Next Steps

1. Identify specific paleoclimate datasets to use
2. Modify model to accept paleoclimate forcing
3. Implement proxy calculations
4. Run validation loop
5. Document constrained vs. unconstrained parameters
