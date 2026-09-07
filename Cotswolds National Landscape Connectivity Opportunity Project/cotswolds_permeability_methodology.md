# Cotswolds Landscape Permeability & Least-Cost Connectivity Model

## Methodology Documentation — Portfolio Record

### Project Overview

**Study area:** Cotswolds National Landscape (2,041 km²)
**Focal scenario:** Landscape permeability for woodland-associated mammals (hypothetical species-group)
**Objective:** Model how the Cotswolds landscape facilitates or obstructs ecological movement between ancient woodland core patches, using least-cost connectivity analysis.

---

## Two-Phase Development Approach

This project was developed in two phases, each documented below.

### Phase 1 (v1): Vector-Only Resistance Surface

**Context:** The UKCEH Land Cover Map 2023 raster was not yet available at project initiation. A vector-based resistance surface was constructed from available habitat datasets.

**Resistance surface construction:**
- Base resistance: uniform default (10) assigned to all cells
- Ancient Woodland (Natural England): resistance = 1
- Ancient Semi-Natural Woodland (Habitat Networks): resistance = 2
- PHI (Priority Habitat Inventory): resistance = 4
- Lowland Calcareous Grassland: resistance = 5
- Lowland Meadows: resistance = 5
- Heathland: resistance = 5
- Roads (OS Open Roads): Motorway = 100, A Road = 60, B Road = 30, Minor = 15
- Outside Cotswolds boundary: NoData

**Modelling resolution:** 25m
**Grid size:** 2,999 × 3,688 = 11,060,312 cells

**Limitations:**
- No land-cover raster → all non-habitat cells defaulted to uniform agricultural resistance (10)
- Could not distinguish arable, improved grassland, urban, suburban, or water bodies
- Resistance surface was ecologically coarse outside designated habitat areas

**Results:**
| Metric | v1 Value |
|---|---|
| Core patches (≥5 ha) | 400 |
| Total core area | 80.7 km² |
| Network nodes | 400 |
| Network edges | 1,279 |
| Connected components | 80 |
| Isolated nodes | 38 |
| Restoration candidates | 700 |
| Mean resistance | N/A (vector-derived) |

**Outputs:**
- `cotswolds_permeability_results.gpkg`
- `cotswolds_permeability_outputs/09_combined_resistance.tif`
- `resistance_lookup.csv`, `least_cost_pairs.csv`, `node_removal_analysis.csv`, `model_summary.csv`

---

### Phase 2 (v2): LCM2023 + Vector Overlay

**Context:** UKCEH Land Cover Map 2023 (10m classified pixels) was obtained, enabling a raster-based resistance surface with full land-cover classification.

**Resistance surface construction:**
1. **Base layer:** LCM2023 10m raster resampled to 50m using mode aggregation (most common class per cell)
2. **LCM class → resistance mapping:**
   - Broadleaved woodland (1): 2
   - Coniferous woodland (2): 5
   - Cropland (3): 10
   - Improved grassland (4): 8
   - Neutral grassland (6): 5
   - Calcareous grassland (7): 5
   - Bog (9): 8
   - Heather (10): 5
   - Heather grass (12): 5
   - Saltwater (14): 80
   - Urban (20): 80
   - Suburban (21): 30
3. **Vector overlay (overrides LCM where present):**
   - Ancient Woodland: resistance = 1 (overrides all)
   - Ancient Semi-Natural Woodland: resistance = 2
   - PHI: resistance = 4
   - Calcareous grassland, lowland meadows, heathland: resistance = 5
   - Roads (15m buffer): Motorway = 100, A Road = 60, B Road = 30, Minor = 15
4. **Outside Cotswolds boundary:** NoData

**Modelling resolution:** 50m (LCM resampled from 10m; computational constraint)
**Grid size:** 1,500 × 1,844 = 2,766,000 cells

**Improvements over v1:**
- Full land-cover classification across entire study area (not just designated habitats)
- Urban/suburban areas correctly assigned high resistance (80/30)
- Cropland distinguished from grassland
- Water bodies assigned very high resistance (80)
- Resistance surface is ecologically defensible across the entire landscape matrix

**Results:**
| Metric | v2 Value |
|---|---|
| Core patches (≥5 ha) | 400 |
| Total core area | 80.7 km² |
| Network nodes | 400 |
| Network edges | 1,308 |
| Connected components | 82 |
| Isolated nodes | 41 |
| Restoration candidates | 844 |
| Mean resistance | 8.2 |
| Min resistance | 1.0 |
| Max resistance | 100.0 |

**Outputs:**
- `cotswolds_permeability_v2_results.gpkg`
- `cotswolds_permeability_v2_outputs/03_landcover_resistance_lcm.tif`
- `cotswolds_permeability_v2_outputs/09_combined_resistance_v2.tif`
- `resistance_lookup_v2.csv`, `least_cost_pairs_v2.csv`, `node_removal_analysis_v2.csv`, `model_summary_v2.csv`

---

## Comparison: v1 vs v2

| Dimension | v1 (Vector-only) | v2 (LCM + Vector) |
|---|---|---|
| Resistance base | Uniform default (10) | LCM2023 classified (1–80) |
| Land-cover detail | None outside habitats | 13 classes across full landscape |
| Urban/suburban | Not distinguished | Urban=80, Suburban=30 |
| Cropland vs grassland | Not distinguished | Cropland=10, Improved=8, Neutral=5 |
| Water bodies | Not distinguished | Saltwater=80 |
| Resolution | 25m | 50m |
| Grid cells | 11.1M | 2.8M |
| Computation time | ~11 min (Dijkstra) | ~4 min (Dijkstra) |
| Network edges | 1,279 | 1,308 |
| Connected components | 80 | 82 |
| Isolated nodes | 38 | 41 |
| Restoration candidates | 700 | 844 |
| Resistance surface defensible? | Partially — coarse outside habitats | Yes — full landscape classification |

**Key finding:** The v2 model identified more isolated nodes (41 vs 38) and more restoration candidates (844 vs 700), because the LCM-derived resistance surface correctly assigns high resistance to urban areas and cropland that v1 treated as uniform agricultural land. This means some patches that appeared connected in v1 (through uniform moderate-resistance agricultural land) are correctly identified as disconnected in v2 (because the intervening landscape includes high-resistance urban or arable barriers).

---

## Analytical Pipeline (Both Versions)

### Step 1: Study Area
Cotswolds National Landscape boundary extracted from Natural England's AONB dataset.

### Step 2: Resistance Surface
Constructed as described above. Documented resistance values in `resistance_lookup.csv`.

### Step 3: Core Habitat Patches
Ancient Woodland polygons ≥ 5 ha identified as core habitat patches (400 patches, 80.7 km²).

### Step 4: Least-Cost Distance
Dijkstra's algorithm applied on the resistance surface grid graph (4-neighbour adjacency). For each core patch centroid, minimum accumulated cost to all other core centroids calculated. Candidate connections filtered by:
- Euclidean distance ≤ 3,000m
- Accumulated cost < 5,000 resistance units

### Step 5: Connectivity Network
Core patches → nodes, least-cost connections → edges. NetworkX graph constructed with cost distance as edge weight.

### Step 6: Centrality Analysis
- **Degree centrality:** Number of connections per node
- **Betweenness centrality:** How often a node lies on shortest paths between other nodes
- **Closeness centrality:** Average cost distance to all other nodes
- **Connected components:** Number of isolated sub-networks

### Step 7: Restoration Opportunities
Pairs of core patches with resistance ratio > 2.0 (cost distance > 2× Euclidean distance) identified as candidate restoration sites. Priority score = resistance_ratio × (1 / euclidean_distance).

### Step 8: Node Removal Analysis
Each non-isolated node removed iteratively; fragmentation impact measured as reduction in largest connected component size. Identifies critical bottleneck patches.

---

## Data Sources

| Dataset | Source | Use |
|---|---|---|
| AONB boundary | Natural England | Study area mask |
| Ancient Woodland (England) | Natural England | Core habitat patches |
| Habitat Networks (Individual) | Natural England | Vector habitat overlay |
| Priority Habitat Inventory | Natural England | Vector habitat overlay |
| OS Open Roads | Ordnance Survey | Road barrier overlay |
| LCM2023 10m classified pixels | UKCEH | Base resistance surface (v2 only) |

---

## Technical Stack

- **Python 3.12** (QGIS bundled interpreter)
- **GeoPandas** — vector data handling
- **GDAL/osgeo** — raster I/O
- **SciPy** — sparse graph, Dijkstra shortest path
- **NetworkX** — graph analysis, centrality metrics
- **NumPy** — array operations
- **Shapely** — geometric operations

---

## Output Files

### GPKG Layers (both versions)
| Layer | Description |
|---|---|
| 01_study_area | Cotswolds boundary |
| 02_ancient_woodland | All ancient woodland polygons |
| 03_hab_* | Clipped habitat network layers |
| 04_phi_habitats | Priority Habitat Inventory |
| 05_roads | OS Open Roads clipped |
| 10_core_patches | Ancient woodland ≥ 5 ha |
| 14_connectivity_network | Least-cost corridor lines |
| 15_centrality | Node centrality metrics |
| 17_restoration_opportunities | Candidate restoration sites |

### Raster Outputs
| File | Description |
|---|---|
| 03_landcover_resistance_lcm.tif | LCM-based resistance (v2 only) |
| 09_combined_resistance.tif | Final combined resistance surface |

### CSV Outputs
| File | Description |
|---|---|
| resistance_lookup.csv | Documented resistance values |
| least_cost_pairs.csv | Pairwise cost distances |
| node_removal_analysis.csv | Node removal fragmentation impacts |
| model_summary.csv | Summary statistics |
