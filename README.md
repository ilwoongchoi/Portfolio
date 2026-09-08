# Portfolio


The portfolio is divided into three thirds at large, hobby project, research projects and GIS analysis projects. Links to all the output files can be found in this readme and other supporting files are in this github repository. If you want to see anything else please contact me and I would be more than happy to provide you with more references.


## Cotswolds National Landscape Connectivity Opportunity Project

<img width="480" height="339" alt="Cotswolds_Permeability_Connectivity_Map_A3" src="https://github.com/user-attachments/assets/b70fed6f-43bc-4d40-804d-899e8a51ec60" />

### Target Scenario: Landscape Permeability & Structural-Functional Connectivity for Woodland-Associated Mammals

I developed an automated, script-based pipeline to model ecological permeability and least-cost connectivity. Moving beyond simple proximity buffers, this project translates landscape friction and dispersal ecology into a rigorous network graph. By using statutory Ancient Woodland core patches ($\ge 5\text{ ha}$) as keystones, the model quantifies how the Cotswolds' diverse matrix—from limestone grasslands to dense road corridors—facilitates or obstructs wildlife movement.

The methodology evolved through two distinct phases: v1 (Vector-Derived Matrix Approximation) served as a proof-of-concept when raster data was limited, and v2 (UKCEH LCM2023 10m Integration + Vector Barriers) delivered a production-grade, empirical resistance surface for high-fidelity modeling.

 result zip file -> (https://drive.google.com/file/d/1MH5sMKko_XPsoMwMZUsHxZQ6CRi38iC1/view?usp=drive_link)


### Technical Architecture & Methodology

#### 1. Empirical Landscape Resistance Modeling (v1 vs. v2 Benchmark)
v1 Baseline (Vector-Only Fallback):
Generated a 25m raster surface where non-designated landscape was assigned uniform default friction ($R=10$), while designated habitats received low resistance ($R=1\text{--}5$) and OS Open Roads imposed linear friction barriers ($R=15\text{--}100$).
Limitation: Treated arable fields, intensive pasture, urban fabric, and water identically outside statutory boundaries.
v2 Production Surface (UKCEH LCM2023 Integration):
Ingested the UKCEH Land Cover Map 2023 (10m classified pixels), resampled to 50m modeling resolution via mode aggregation, capturing 13 distinct ecological land cover classes.
Parameterized ecological friction:
Ancient Woodland ($R=1$) and Broadleaved Woodland ($R=2$) as optimal conduits
Calcareous Grassland ($R=5$) and Priority Habitats ($R=4$) as permeable foraging matrices
Arable Cropland ($R=10$) as high-drag terrain
Suburban Fabric ($R=30$), Urban Centers ($R=80$), and Water/Lakes ($R=80$) as severe dispersal barriers
Overlaid vector-level OS Open Roads with tiered barrier costs: Motorways ($R=100$), A-Roads ($R=60$), B-Roads ($R=30$), and Minor Roads ($R=15$).
Ecological Insight: The v2 empirical surface unmasked structural fragmentation, increasing isolated core patches from 38 to 41 and revealing 844 critical bottleneck candidates (vs. 700 in v1).

#### 2. Graph-Theoretical Least-Cost Corridors (Dijkstra Shortest Path)
The 2.76-million-cell resistance grid was converted into an undirected 4-neighbour weighted adjacency graph using scipy.sparse.csr_matrix. I computed distance surfaces for 400 Ancient Woodland centroids ($\ge 5\text{ ha}$) using memory-optimized Dijkstra passes. Linkages were filtered by biological thresholds: a maximum Euclidean range of $\le 3,000\text{ m}$ and an accumulated resistance cost of $< 5,000$, resulting in ,1308 functional corridors.

#### 3. Network Topology & Keystone Node Centrality (NetworkX)
Modeled the landscape as a complex topological graph ($G=(V, E)$, with $|V|=400$, $|E|=1,308$, 82 connected components).
Computed nodal centrality metrics to rank spatial criticality:
Betweenness Centrality: Identified strategic ecological "stepping stones" funneled by regional movement (Core #223 identified as primary keystone hub).
Degree Centrality & Closeness: Measured local cluster redundancy versus dispersal periphery.
Iterative Node-Removal Sensitivity Analysis: Quantified catastrophic fragmentation impact on the largest connected component if specific woodland patches are degraded or lost.

#### 4. Bottleneck & Strategic Restoration Opportunity Identification
I formulated a Resistance Ratio Metric ($\text{Cost Distance} / \text{Euclidean Distance}$) to identify inefficiency. Corridors with a ratio $> 2.0$ were flagged as high-friction pinch points where infrastructure forces circuitous movement. Restoration sites were ranked using an Ecological ROI Priority Score: $$\text{Priority} = \left(\frac{\text{Cost Distance}}{\text{Euclidean Distance}}\right) \times \left(\frac{1}{\text{Euclidean Distance}}\right)$$ This targets locations where interventions like hedgerow planting or woodland creation provide the maximum connectivity gain per pound spent.

### Key Features
- Ancient Woodland Core Anchoring: Prioritizes irreplaceable habitats as the network's foundation.
- Empirical Resistance Surface: Combines LCM2023 satellite data with road network hierarchies.
- Algorithmic Routing: Uses sparse Dijkstra implementation on a 2.7M-cell grid, avoiding arbitrary assumptions.
- Actionable BNG Targeting: Pinpoints 844 specific restoration sites based on quantified ecological drag.

### Further Considerations
- Topographic Calibration: Integrating 1m/2m LiDAR DTM to account for slope impedance on the Cotswolds escarpments.
- Species-Specific Models: Tuning resistance weights for specialized species like the Hazel Dormouse or Pine Marten.
- Linear Feature Integration: Adding OS MasterMap Water Networks and hedgerows to capture micro-corridors in arable areas.

## Cotswolds Spatial Restoration Opportunity Model

**Multi-criteria suitability analysis identifying priority areas for native woodland expansion across the Cotswolds AONB (2,041 km²).**

### Overview

This project combines **least-cost connectivity modelling** with **multi-criteria spatial analysis** to identify and prioritise restoration opportunities. Three policy scenarios reveal how conservation objectives shape spatial priorities.
<img width="900" height="594" alt="github_summary_graphic" src="https://github.com/user-attachments/assets/70865d30-9e31-482c-8de6-454a3485d282" />
<img width="900" height="324" alt="scenario_weights_comparison" src="https://github.com/user-attachments/assets/960640b0-34d9-4b84-b6ce-a6b2e8e60db6" />


### Key Results

| Scenario | Focus | Parcels | Area | Mean Suitability |
|---|---|---|---|---|
| **A: Connectivity-First** | Bridge habitat networks | 116 | 7,259 ha | 0.054 |
| **B: Biodiversity-First** | Expand near existing habitat | 178 | 11,398 ha | 0.064 |
| **C: Carbon-First** | Physical suitability only | **0** | — | 0.034 |

### Critical Finding

**Scenario C produces zero viable parcels**, demonstrating that **carbon-only restoration criteria are insufficient without connectivity or proximity constraints**. This reveals a key conservation principle: landscape-scale thinking exposes synergies and trade-offs that single-objective models miss.

results zip file -> (https://drive.google.com/file/d/10lp8suq0AJBqkG9Yr7yM0j9XJ-GG_sa6/view?usp=drive_link)
### Methodology

1. **Constraint mapping:** Identify urban, water, roads, protected habitats (96.9% of landscape constrained)
2. **Environmental suitability:** Composite score from land cover, TWI, soil drainage, geomorphons, pedotopes
3. **Connectivity integration:** Load pinch points (844) and corridors (1,308) from Cotswolds Permeability Model v2
4. **Scenario weighting:** Apply policy-specific weights to environmental and connectivity factors
5. **Parcel extraction:** Threshold at 0.60, minimum 2 ha, extract contiguous clusters
6. **Connectivity assessment:** Quantify before/after improvement for top 10 parcels (mean improvement: 0.92)

### Data Integration

- **Land cover:** UKCEH LCM2023 (10m → 50m)
- **Environmental:** UK-wide rasters (TWI, drainage, geomorphons, pedotopes)
- **Habitat:** Natural England Ancient Woodland, Priority Habitat Inventory
- **Connectivity:** Cotswolds Permeability Model v2 outputs
- **Constraints:** OS Open Roads, urban/water from LCM

### Outputs

**GeoPackage:**
- Study area boundary
- 116 restoration parcels (Scenario A)
- 178 restoration parcels (Scenario B)
- Top 10 parcels with connectivity improvement scores

**Rasters (50m GeoTIFF):**
- 3 scenario suitability surfaces
- 4 factor layers (environmental, AW proximity, corridor proximity, pinch proximity)
- Constraint mask, scenario agreement/disagreement, pairwise differences

**Tables (CSV):**
- Model summary statistics
- Scenario weights
- Top 10 restoration parcels with metrics

## Technical Stack

- **Python:** geopandas, pandas, numpy, scipy, GDAL/rasterio
- **GIS:** QGIS 3.x
- **CRS:** British National Grid (EPSG:27700)
- **Processing:** ~8 minutes (single-threaded)

### Files

- `README.md` — Full technical documentation
- `cotswolds_restoration_suitability.py` — Processing pipeline (706 lines)
- `cotswolds_restoration_suitability.gpkg` — All vector outputs
- `suitability_*.tif` — Scenario rasters
- `factor_*.tif` — Component rasters
- `*.csv` — Summary tables

### Next Steps

1. Field validation of top 10 parcels
2. Cost-benefit analysis with land acquisition costs
3. Species-specific resistance surfaces
4. Climate projections for future suitability
5. Phased implementation timeline

---

**CRS:** EPSG:27700 | **Study Area:** Cotswolds AONB | 

## UK National Parks Habitats Connectivity Opportunity Project



I have designed a pipeline that goes beyond simple GIS tool manipulation, combining the Lawton Report's spatial connectivity principles (250m Buffer) with the unique biogeography of each region. Ancient woodlands are anchored as core anchors to ensure ecosystem permanence, while each national park's unique geology and soil-specific habitats (e.g., Peak District's Blanket Bog, New Forest's Wood Pasture) are set as restoration targets to build a site-specific BNG decision-making model.

I used 5-tier gradient system to visualise restoration potential of habitat patches within the national parks on their ecological connectivity value. It is the output of a Multi-Criteria Decision Analysis (MCDA) combining Ecological Efficacy (distance minimisation) and Scale (area maximisation).

It provides a Spatial Prioritization Baseline indicating that capital should be allocated in priority order from Tier 1 (highest grade) when the Oxygen Conservation acquires land or issues BNG credits.

A national standard BNG MCDA model has been benchmarked across all national parks via a consistent pipeline, customised with Fen anchors for hydrological landscapes such as The Broads. The architecture is modular, allowing high-resolution DEM (slope) and soil acidity (pH) layers to be plugged in.

I automated the entire pipeline in Python across all 10 National Parks using an AI agent tool.

results zip folder -> https://drive.google.com/file/d/1SylEUpA6h1QTowCO8E0wSdQeY7F6FBR6/view?usp=drive_link

### Key features:


Statutory ancient woodland core anchoring
Unique biogeography targeting across England's 10 national parks
OS Open Roads-based physical barrier (fragmentation) constraint filtering
Multi-Criteria Decision Analysis scoring (distance minimisation 50% + area maximisation 50%)
Modular architecture for future variable expansion
Further Considerations: The current model was rapidly built based on national-level standard datasets (National Datasets). At the site acquisition stage, high-resolution LiDAR DEM-based topographic slope/aspect and soil moisture/drainage (Hydrology) data can be integrated as secondary weighting factors.

<img width="300" height="211" alt="image" src="https://github.com/user-attachments/assets/484af87e-f8d0-4681-b07b-d68d96325b8e" />
<img width="300" height="211" alt="image" src="https://github.com/user-attachments/assets/b1ef065d-47a1-400a-824f-b08c2b3d89d6" />
<img width="300" height="211" alt="image" src="https://github.com/user-attachments/assets/4fd71cfa-5b9f-412b-8809-7796ced72c69" />
<img width="300" height="162" alt="image" src="https://github.com/user-attachments/assets/8ab413bd-ded4-4cf1-b0d3-6141c4fdb1cc" />
<img width="300" height="162" alt="image" src="https://github.com/user-attachments/assets/19ee5b97-cb3a-4dde-8c3b-817f61fdd576" />
<img width="300" height="162" alt="image" src="https://github.com/user-attachments/assets/eb201587-1feb-4538-87ee-8a4a8ce7fe06" />

## UK National Parks Restoration Suitability Model



## UK National Parks Restoration Suitability Model & Peatland Hydrological Rewetting Model
 
Question: Which areas across 10 National Parks offer the highest restoration suitability?
 
- Pipeline: PHI geometry extraction → road excision (OS Open Roads) → explode + area filter → cKDTree proximity → composite scoring
-*Scoring: Distance to existing habitat (35%) + Parcel area (35%) + TWI hydrology (30%)
- Output: 82,340 parcels across 10 parks, 5-tier blue gradient (#EFF3FF → #08519C)
 
| National Park | Parcels | Proximity Mean | Processing Time |
|---|---|---|---|
| New Forest | 12,058 | 0.866 | 363s |
| Peak District | 5,931 | 0.894 | 349s |
| North York Moors | 6,948 | 0.908 | 220s |
| Lake District | 15,084 | 0.672 | 293s |
| The Broads | 5,004 | 0.949 | 121s |
| South Downs | 12,340 | 0.791 | 951s |
| Northumberland | 9,688 | 0.830 | 172s |
| Yorkshire Dales | 11,229 | 0.823 | 181s |
 
Key pattern: Lake District has lowest proximity (0.672) — mountainous terrain fragments habitat networks. The Broads has highest (0.949) — dense wetland matrix.
 
Tech: Python, GeoPandas, SciPy cKDTree, pyogrio, QGIS Processing
 
---
 
## Project 5: Peatland Hydrological Rewetting Model
 
Question: Where is peatland rewetting hydrologically feasible across 5 National Parks?
 
- Pipeline: PHI keyword filter (peat/bog/mire/fen/wetland) → road excision → area filter → **TWI hard filter** → MRVBF valley scoring → composite scoring
- Scoring: TWI hydrological wetness (40%) + MRVBF valley index (30%) + Sequestration scale (30%)
- Output: 10,672 parcels, 5-tier purple gradient (#F2F0F7 → #54278F)
 
| National Park | Pre-TWI Parcels | Post-TWI Parcels | Retention Rate |
|---|---|---|---|
| Peak District | 4,945 | 2,169 | 43.9% |
| Dartmoor | 1,389 | 935 | 67.3% |
| The Broads | 3,000 | 2,955 | 98.5% |
| Northumberland | 7,017 | 3,942 | 56.2% |
| North York Moors | 1,169 | 671 | 57.4% |
 
Key finding: TWI filtering removes 44–56% of peat candidates in upland parks. The Broads retains 98.5% — expected for a lowland wetland landscape. Peak District retains only 43.9% — many peat patches sit on slopes too dry for effective rewetting.
 
Tech: Python, GeoPandas, GDAL raster sampling, SciPy, QGIS Print Layout
 
---
 
### Cross-Project Comparison
 
#### Methodological Progression
 
```
Cotswolds Permeability (v1→v2)    →  Foundation: resistance surface, least-cost path
        ↓
Cotswolds Suitability (3 scenarios) →  Deep: raster MCSA, scenario comparison
        ↓
BNG Connectivity (10 parks + AONB)  →  Bridge: AW buffer + PHI intersection, MCDA
        ↓
National Parks Suitability (P1)     →  Broad: vector geometry, 10 parks, 82K parcels
        ↓
Peatland Rewetting (P2)             →  Specialised: TWI hard filter, MRVBF, peatland
```
 
#### Scale vs Depth Trade-off
 
| Dimension | Cotswolds (Projects 1–2) | National Parks (Projects 3–5) |
|---|---|---|
| Scale | Single AONB (2,041 km²) | 10 parks (~20,000 km²) |
| Resolution | 50m raster (3M cells) | Vector geometry (actual habitat boundaries) |
| Connectivity | Least-cost path (Dijkstra) | cKDTree proximity (nearest-neighbour) |
| Scenarios | 3 policy scenarios | Single composite per project |
| Parcels | 116–178 | 82,340 + 10,672 |
| Hydrology | TWI as soft factor (15%) | TWI as hard filter + scoring (40%) |
| Road handling | Raster buffer (30m) | Vector excision (exact geometry) |
 
#### Key Convergent Findings
 
1. No single criterion is sufficient. Cotswolds Scenario C (carbon-only) → 0 parcels. Peatland without TWI → 44% over-identification. Both projects independently prove multi-criteria integration is essential.
 
2. Hydrology must be a hard constraint for peatland. The Cotswolds model treated TWI as a 15% weight (soft factor) — adequate for woodland where hydrology is one factor among many. The peatland model uses TWI as a binary filter — necessary because rewetting on dry slopes is physically impossible regardless of peat presence.
 
3. Road impact is landscape-dependent. Road excision removes 0.2–2.0% of PHI patches — highest in lowland parks (South Downs 0.88%, New Forest 1.1%), lowest in upland parks (Lake District 0.31%). The Cotswolds model used 30m raster road buffers; the national model uses exact vector excision, which is more precise.
 
4. Connectivity metrics enable cross-landscape comparison. Cotswolds: 82 connected components, 41 isolated nodes (v2). National parks: proximity mean ranges from 0.672 (Lake District) to 0.949 (The Broads). Both metrics reveal the same pattern: upland landscapes are more fragmented than lowland.

 
## Significance
 
### For Conservation Practice
- **Multi-criteria models are non-negotiable** — both projects independently confirm single-criterion models fail or over-identify
- **Hard filters > soft weights for physical constraints** — TWI as a filter (peatland) is more effective than TWI as a 15% weight (Cotswolds)
- **Landscape type determines strategy** — upland parks need connectivity-focused restoration; lowland parks need infill within existing networks
 
### For BNG & Carbon Markets
- Peatland rewetting model directly supports BNG habitat credit identification with hydrological feasibility
- 5-tier classification maps to phased investment: Tier 1 (core targets) → Tier 5 (low priority)
- 10,672 peatland parcels across 5 parks provide a national-scale pipeline for rewetting investment

 
## Data Sources
 
| Dataset | Source | Used In |
|---|---|---|
| Priority Habitat Inventory (PHI) | Natural England | Projects 3, 4, 5 |
| Ancient Woodland Inventory | Natural England | Projects 1, 2, 3 |
| LCM2023 (10m classified) | UKCEH | Projects 1, 2 |
| OS Open Roads | Ordnance Survey | All projects |
| TWI raster (50m) | UK-wide | Projects 2, 4, 5 |
| MRVBF raster (50m) | UK-wide | Project 5 |
| Subsurface Drainage (50m) | UK-wide | Projects 2, 4 |
| Natural Capital Pedotopes (50m) | UK-wide | Project 2 |
| Geomorphons (50m) | UK-wide | Project 2 |
| AONB / National Park boundaries | Natural England | All projects |
| UKHab Classification v2.0 | UKHab | Project 3 |
 
---
 
## Technical Stack
 
- **QGIS** — print layouts, cartographic export, visualisation
- **Python 3.12** — all processing scripts
- **GeoPandas / pyogrio** — vector I/O, geometry operations
- **GDAL / osgeo** — raster I/O, sampling
- **SciPy** — sparse graph (Dijkstra), cKDTree (proximity)
- **NetworkX** — graph analysis, centrality
- **NumPy** — array operations, raster computation
- **Shapely** — geometric operations (buffer, intersection, explode)
 

## Hobby coding Projects


I have included these draft-level hobby projects in this portfolio to showcase my enthusiasm for experimentation and exploration with AI and IT tools and my desire and ability to learn new skills. 



### 2d ecosystem simulation

In this project, I tried to make a self sustaining simulative agentic ecosystem where the constituting organisms interact with eachother to keep homeostasis and not die out. Obviously it was very hard to find that point of balance where each organsisms compete one another to just the right extent. I believe at this point of my scientific quest, I was not very aware of microorganisms like fungi and lichen, who are the interface moderators of exchanges of energy and material in the system, and if I have a chance to have another go, introduction of these organisms will greatly improve the longevity of the system.

<img width="200" height="179" alt="image" src="https://github.com/user-attachments/assets/c33d55ca-25e5-4c42-9097-c3c49da129f5" />




### BOX model



I got the inspiration for this from an appendix of a biogeochemistry book I borrowed from the library which introduced me to BOX software, a primary modelling software for biogeochemical modelling. There are many other types of biogeochemical modelling tools such as NPZD, PFT, ESM that are used to model biogeochemistry of ecosystem, but the BOX model was most intuitive and easy to access for a beginner. The complexity of the interaction of whole system was very hard to keep up with but I learnt a lot about biogeochemical modelling with this.





### Puzzles and Games



I am greatly interested in puzzles, 2d and 3d games so I included these to show what I can integrate with ecology and spatial planning. In my free time in the past I have enjoyed many logic and mobile puzzles such as sudoku, slitherink, sumgrid, block puzzle, slide puzzle, nonogram and so on, so I thought it would be fun to make them for mobile using many different language frameworks and platform.  The essence is that, refreshing or creation of  new game or a puzzle board is done by random selection of the numerals or positional value on the board by the machine, and this creates infinite number of new board that people can enjoy in their free time.

<img width="200" height="188" alt="image" src="https://github.com/user-attachments/assets/9b95400d-d209-4fb2-a740-06ba1ae2ae49" /><img width="200" height="188" alt="image" src="https://github.com/user-attachments/assets/d727aa93-8e8e-4943-820e-b44a19703297" /><img width="200" height="188" alt="image" src="https://github.com/user-attachments/assets/186ab7e5-bc41-43be-8a06-63414dc90318" /><img width="200" height="188" alt="image" src="https://github.com/user-attachments/assets/18cc0205-f114-48e7-a80c-c6f6f71f5122" />

https://hello.processing.org/display/#@-P0rlGScFGUSRt7REkM7





### Python_music_library_projects


One of the reason why python is such a great and versatile language is because the libraries of different functionalities are created and made accessible by so many individual hobbiest and developers. Mingus and music.py are two of the well known music libraries in Python. I thought mingus was especially interesting because it lets you experiment with music theory and generate algorithmic music through the manipulation of those music theory. I think algorithmic generative creativity of not only music but any other discipline is limitless, because it lets us tap into creativity.




### job_scraping_automation


Ever since programming and software engineering became a skill that not only IT professionals but general public could have access to, I saw many people using software to automate everyday tasks, earn money and do financial trading with automation. At first I wasn't really into these, but I began to realise the power of productivity and saving time. These automations allow you to be more efficient and spend less time doing repetitive work. So I thought why don't I also use them for scraping jobs from the internet so I get more chance of employment. I used a python library called selenium which is a well known web-scraping library.



### processing_shader


Processing is an open source generative art tool, along with p5.js. I used processing a lot in making prototypes of projects before I would move onto Three.js, Python, html etc and processing had also a shader library so I tried making shader with processing. I have also made some 3d landscape animations using a tool called Three.js.

Here is the link: https://codepen.io/esrmzokd-the-flexboxer/pen/MYaVXNW

<img width="200" height="125" alt="image" src="https://github.com/user-attachments/assets/80938747-1c5c-4a51-8d5d-1847b6fdd59f" />



### python_astronomy_simulations


I am greatly interested in astronomy and some years ago I made python codes that model and predict asteroid encounters with Earth using python libraries such as poliastro and astropy. These were all during the very entrance stages of my interest in modelling and coding when I first started using AI.

<img width="200" height="200" alt="image" src="https://github.com/user-attachments/assets/df352464-fc2d-4ba3-93ee-1a21ef24e766" />
<img width="325" height="200" alt="image" src="https://github.com/user-attachments/assets/4ce93031-1bc9-4831-b77c-1c2e83aed933" />




## GIS_works



### Cannae Battle visualisation



I am greatly interested in history and battle tactics, so I once stumbled upon an idea to start a youtube channal that analyses the geometry of battle tactics thar historical military commanders used. The battle of Cannae is a very well known battle of Antiquity that is like a textbook example of a tactical maneuver, and I wanted to make an animation of this maneuver using a QGIS function called temporal controller. At that time I was not very proficient in using different tool within QGIS, but it was good fun to try out new stuff with GIS


<img width="400" height="215" alt="image" src="https://github.com/user-attachments/assets/6130d58d-9652-4aef-af1a-acf07cf5f024" />



### BNG Assessment mock.ppt



Last year when I first came to the UK to pursue conservations career and started using GIS for spatial modelling, I was first introduced to the concept of Biodiversity Net Gain and taught myself the essence of the policy by using GIS based data analysis and a macro provided by the UK government. I chose a natural reserve site called Chilterns AONB near Oxford where I live and undertook at home mock BNG assessment of the site using already existing survey data. Because I could not field-survey the site, I had to standardise some post-dev and pre-dev condition scores to a certain value for the assessment to be possible.The assessment was very basic but it was enough to teach myself what BNG is and its meaning in British conservation and ecology industry.

<img width="300" height="164" alt="image" src="https://github.com/user-attachments/assets/376c797c-5909-44fe-a351-af2916a7ff0c" />
<img width="300" height="164" alt="image" src="https://github.com/user-attachments/assets/8cf0f9dc-448b-46e1-baea-0039343bfaf2" />
<img width="300" height="164" alt="image" src="https://github.com/user-attachments/assets/62a76c05-1419-4741-9edd-47715e447f40" />



### Chilterns Habitat Map.pptx


I acquired  datasets from Natural England Data Portal and overlayed the polygons with the reserve boundaries to make a habitat map of Chilterns in Oxford.I visualised the spatial distribution of different types of habitat patches in the final result.I used GIS to visualise the spatial data and used python library matplotlib to display the result in a pie diagram.

<img width="300" height="164" alt="image" src="https://github.com/user-attachments/assets/a170ee92-2423-459d-bae7-b4d1a0f9ba97" />



### ywt_peatland_ restoration_practitioner_course.png


As I have already mentioned I participated in a course run by Yorkshire Wildlife Trust for conservation professionals to teach peatland restoration techniques, and there we had off-field computer sessions where we used QGIS to design our peatland restoration management plans. It was interesting to see how GIS tools were used in real conservation and restoration practices.


<img width="350" height="181" alt="image" src="https://github.com/user-attachments/assets/bffbb482-437f-4a32-9395-d224f4e01d27" />



## Kaggle_Globular_Cluster_machine_learning



I am greatly interested in using algorithms and ai technology to create art, so I used machine learning models that are known to create AI generated Art such as Stable Diffusion and GAN to make images of synthesised astronomical globular clusters by feeding them thousands of real globular cluster images. Globular clusters are groups of stars in space that are clustered in a ball shape. I could not output final created image because my computer does not have GPU and you need a GPU to run machine learning models stably, but it was great to witness the possibility of AI technology in creating art. (The images below are of real globular clusters, not the one I made.) 


<img width="123" height="130" alt="image" src="https://github.com/user-attachments/assets/505e9bb0-a99e-4292-9167-0e6e3c7d2d7c" />
<img width="123" height="130" alt="image" src="https://github.com/user-attachments/assets/7fa44045-db1b-4942-a4c8-d2ad9434659a" />
<img width="123" height="130" alt="image" src="https://github.com/user-attachments/assets/08eb66d5-be84-4593-a98c-139858b3bcfe" />




## Interdisciplinary_research



As I mentioned in my cover letter, there is a gap period in my employment in 2026 uptil now, because during this time I did some researches that concerned topics such as biochemistry and physics. The motivation for this researched were greatly stemming from my personal motives and questions, and I developed an interdisciplinary mathematical models that map physical parameters to spatial/temporal coordinates and implemented continuous tims evolution using numerical ODE integration. These intensive nine months period resulted in my proficiency to use AI tools such as Claude Code to carry out python automation, mathematical modelling and data pipline construction. Below are some examples of the scripts and outputs of my research and modelling that I did during the research.

https://raw.githack.com/ilwoongchoi/Portfolio/main/interdisciplinary_research/simulation%26computations/k_peak_std_heatmap.html <img width="400" height="200" alt="image" src="https://github.com/user-attachments/assets/893ac961-65df-40eb-b229-369434f0baff" />

https://raw.githack.com/ilwoongchoi/Portfolio/main/interdisciplinary_research/simulation%26computations/k_ratio_mean_heatmap.html <img width="400" height="200" alt="image" src="https://github.com/user-attachments/assets/f008433b-7c55-45af-8e45-de555d99c37f" />

https://raw.githack.com/ilwoongchoi/Portfolio/main/interdisciplinary_research/simulation%26computations/ocean_fluid_dynamics_standalone.html

<img width="400" height="162" alt="image" src="https://github.com/user-attachments/assets/e82ba3f7-7d4b-467f-817e-b2b5498a932d" />

https://raw.githack.com/ilwoongchoi/Portfolio/main/interdisciplinary_research/simulation%26computations/peatland_3d_interactive.html <img width="400" height="297" alt="image" src="https://github.com/user-attachments/assets/9e7331ca-f94d-43ef-b11c-02756f2c25af" />





https://raw.githack.com/ilwoongchoi/Portfolio/main/interdisciplinary_research/simulation%26computations/peatland_physics_based.html
<img width="400" height="297" alt="image" src="https://github.com/user-attachments/assets/029d4a31-b260-46d2-9549-330dd8cf2258" />

https://raw.githack.com/ilwoongchoi/Portfolio/main/interdisciplinary_research/simulation%26computations/peatland_rule_based.html
<img width="400" height="297" alt="image" src="https://github.com/user-attachments/assets/261a30c1-293d-45ac-a85b-ba5efa2f2ca3" />

https://raw.githack.com/ilwoongchoi/Portfolio/main/interdisciplinary_research/simulation%26computations/planck_morphology_plotly.html <img width="400" height="297" alt="image" src="https://github.com/user-attachments/assets/01efd180-1e32-4c59-847b-e771d846e734" />

<img width="400" height="357" alt="image" src="https://github.com/user-attachments/assets/503ab7d5-9753-4c33-b33e-2dc78d75d15d" /> <img width="400" height="385" alt="image" src="https://github.com/user-attachments/assets/f0b0f14a-7ea6-4267-803c-f4066c791ca4" /> <img width="400" height="264" alt="image" src="https://github.com/user-attachments/assets/a9879791-df51-4552-a242-89f3c39912c6" /><img width="400" height="208" alt="image" src="https://github.com/user-attachments/assets/692f7bd9-41a7-4e7d-b731-43ec94c15326" /><img width="400" height="293" alt="image" src="https://github.com/user-attachments/assets/7fdfd8c1-b8cb-47b1-9894-027d2a805579" /><img width="400" height="237" alt="image" src="https://github.com/user-attachments/assets/87284b71-f735-49d3-a684-a3c35d625291" /> <img width="400" height="108" alt="image" src="https://github.com/user-attachments/assets/c02b596a-d222-4e28-804f-f7fce2a99a6a" />


## Music Composition Software

During my research I made a music composition app that was supposed to help people in creating music. I included this in the portfolio to show that along with some of my other research files, these display my ability to design and make user interfaces and dashboards. As I have already mentioned in my cv, from very young age I was very keen in web design and web development was one of the first areas of programming that I began my coding hobby with.  I can make flawless web and user interface GUI, especially with the help of AI.

https://raw.githack.com/ilwoongchoi/Portfolio/main/interdisciplinary_research/music_composition_software/composer.html
https://raw.githack.com/ilwoongchoi/Portfolio/main/interdisciplinary_research/music_composition_software/composer2.html

<img width="450" height="181" alt="image" src="https://github.com/user-attachments/assets/3eaf5d6a-1317-498f-b7b6-bfbe8d43e533" />
<img width="450" height="205" alt="image" src="https://github.com/user-attachments/assets/424fb36d-6c85-4979-b630-844ee4d59ded" />








