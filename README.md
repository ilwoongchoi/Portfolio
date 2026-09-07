# Portfolio


The portfolio is divided into three thirds at large, hobby project, research project and UK National Parks habitat connectivity project. Hobby projects were all made before 2026 while research projects were done mostly from end of 2025 uptil now. And UK National Parks project was the most recent project done specifically for the purpose of portfolio. Hobby projects were done when I first began to bloom my interest in creative hobbies using IT tools, and researches were done in the synthesis phase of my interests and knowledge. Many of both my hobby projects and my research project data were lost as my laptop broke down but I could retrieve many. Many of the examples are wrong in scientific accuracy because most of these files were made at the beginning stage of my research and also because my scientific knowledge is not perfect, but these are the records of my tireless wrestling with AI and software to understand and model science and natural phenomena. Whereas, UK National Parks project showcases my ability to utilise GIS and AI tools to model spatial data and use them for BNG decision making procedures.


## Cotswolds National Landscape Connectivity Opportunity Project

<img width="480" height="339" alt="Cotswolds_Permeability_Connectivity_Map_A3" src="https://github.com/user-attachments/assets/b70fed6f-43bc-4d40-804d-899e8a51ec60" />

### Target Scenario: Landscape Permeability & Structural-Functional Connectivity for Woodland-Associated Mammals

I have designed an automated, script-driven Ecological Permeability & Least-Cost Connectivity Pipeline that advances beyond static proximity buffers, translating landscape friction and species dispersal ecology into a rigorous network graph. Anchoring statutory Ancient Woodland core patches ($\ge 5\text{ ha}$) as keystones of ecological permanence, the model quantifies how the Cotswolds' heterogeneous matrix—limestone grassland scarps, arable plateaus, dense road corridors, and urban sprawl—facilitates or impedes multi-directional wildlife movement.

The pipeline was executed across two progressive iterations to demonstrate methodological evolution and rigor: v1 (Vector-Derived Matrix Approximation), established when raster datasets were unavailable, and v2 (UKCEH LCM2023 10m Integration + Vector Barrier Overlay), constructing a publication-grade, empirical resistance surface.

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
Converted the 2,766,000-cell resistance grid into an undirected 4-neighbour weighted sparse adjacency graph (scipy.sparse.csr_matrix).
Computed all-to-all least-cost distance surfaces from 400 Ancient Woodland core centroids ($\ge 5\text{ ha}$, total 8,068 ha) using memory-optimized, single-source Dijkstra passes.
Filtered candidate functional linkages via biological thresholding: maximum Euclidean dispersal range $\le 3,000\text{ m}$ and maximum accumulated resistance cost $< 5,000$ cost-units, yielding 1,308 functional ecological corridors.

#### 3. Network Topology & Keystone Node Centrality (NetworkX)
Modeled the landscape as a complex topological graph ($G=(V, E)$, with $|V|=400$, $|E|=1,308$, 82 connected components).
Computed nodal centrality metrics to rank spatial criticality:
Betweenness Centrality: Identified strategic ecological "stepping stones" funneled by regional movement (Core #223 identified as primary keystone hub).
Degree Centrality & Closeness: Measured local cluster redundancy versus dispersal periphery.
Iterative Node-Removal Sensitivity Analysis: Quantified catastrophic fragmentation impact on the largest connected component if specific woodland patches are degraded or lost.

#### 4. Bottleneck & Strategic Restoration Opportunity Identification
Formulated an empirical Resistance Ratio Metric ($\text{Cost Distance} / \text{Euclidean Distance}$).
Corridors exhibiting a ratio $> 2.0$ were flagged as high-friction pinch points where animals are forced to take circuitous paths around infrastructure barriers.
Ranked 844 Restoration Candidate Sites via an Ecological ROI Priority Score: $$\text{Priority} = \left(\frac{\text{Cost Distance}}{\text{Euclidean Distance}}\right) \times \left(\frac{1}{\text{Euclidean Distance}}\right)$$ Directly highlighting target locations where hedgerow planting, woodland creation, or wildlife underpasses yield maximum regional connectivity gain per pound invested.
Cartographic & Deliverable Outputs
All components were structured into an automated, headless QGIS Python deployment pipeline:

#### A3 Landscape Cartographic Suite (300 DPI PNG & Vector PDF):
High-fidelity cartography featuring an offline OpenStreetMap (OSM) Zoom 11 Basemap dynamically downloaded, reprojected, and georeferenced to British National Grid (EPSG:27700).
Multi-tiered styling: 7-stop perceptual resistance gradient, graduated corridor friction lines, haloed centrality hubs, and high-visibility diamond pinch points.
Comprehensive sidebar dashboard card summarizing study area metrics, scale bar, custom minimalist compass, and full attribution.
QGIS Master Project (.qgz):
Fully styled, production-ready workspace pre-configured with local GeoTIFFs and GeoPackage layers.
Structured Spatial Repository (.gpkg & CSVs):
Clean, standardized OGR layers: 01_study_area, 10_core_patches, 14_connectivity_network, 15_centrality, and 17_restoration_opportunities.
Comprehensive audit trails including pairwise cost tables and node removal impact logs.

### Key Features
Statutory Ancient Woodland Core Anchoring: Prioritizes irreplaceable, ancient semi-natural habitats ($\ge 5\text{ ha}$) as permanent network nodes.
Empirical Multi-Class Resistance Surface: Integrates UKCEH LCM2023 satellite-derived land cover with road network barrier hierarchies.
Algorithmic Shortest Path Routing: Sparse Dijkstra implementation on a 2.76M-cell grid graph avoiding arbitrary straight-line assumptions.
Graph-Theoretic Centrality & Resilience Modeling: Quantifies patch vulnerability and keystone connectors via NetworkX.
Actionable BNG & Nature Recovery Spatial Targeting: Pinpoints 844 quantified restoration interventions based on ecological drag ratios.
Fully Automated End-to-End Pipeline: CLI Python orchestration spanning data extraction, graph computation, spatial indexing, cartographic layout generation, and multi-format export.

### Further Considerations
Topographic & Microclimatic Calibration: Incorporating high-resolution 1m/2m Environment Agency LiDAR DTM to evaluate slope impedance on steep Cotswolds escarpments.
Species-Specific Parameterization: Tuning resistance weights for specialized target species (e.g., Hazel Dormouse Muscardinus avellanarius vs. Pine Marten Martes martes).
Hedgerow & Linear Boundary Integration: Integrating Ordnance Survey MasterMap Water Network and woody linear features to capture micro-corridors across arable landscapes.

## UK National Parks Habitats Connectivity Opportunity Project



I have designed a pipeline that goes beyond simple GIS tool manipulation, combining the Lawton Report's spatial connectivity principles (250m Buffer) with the unique biogeography of each region. Ancient woodlands are anchored as core anchors to ensure ecosystem permanence, while each national park's unique geology and soil-specific habitats (e.g., Peak District's Blanket Bog, New Forest's Wood Pasture) are set as restoration targets to build a site-specific BNG decision-making model.

I used 5-tier gradient system to visualise restoration potential of habitat patches within the national parks on their ecological connectivity value. It is the output of a Multi-Criteria Decision Analysis (MCDA) combining Ecological Efficacy (distance minimisation) and Scale (area maximisation).

It provides a Spatial Prioritization Baseline indicating that capital should be allocated in priority order from Tier 1 (highest grade) when the Oxygen Conservation acquires land or issues BNG credits.

A national standard BNG MCDA model has been benchmarked across all national parks via a consistent pipeline, customised with Fen anchors for hydrological landscapes such as The Broads. The architecture is modular, allowing high-resolution DEM (slope) and soil acidity (pH) layers to be plugged in.

I automated the entire pipeline in Python across all 10 National Parks using an AI agent tool.



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


# UK National Parks Habitat Connectivity & Restoration Opportunity Model

**A Scalable Multi-Criteria Spatial Decision Framework for Natural Capital Allocation & BNG Site Prioritisation**


## Executive Summary
This project presents an automated, reproducible spatial prioritisation pipeline designed to identify and rank habitat restoration opportunities across all 10 National Parks in England. Moving beyond manual desktop GIS analysis, the framework operationalises the core principles of the Lawton Report (*Making Space for Nature: "More, Bigger, Better and Joined"*) by establishing functional 250 m ecological connectivity buffers around statutory **Ancient Woodland** cores while integrating region-specific biogeographical targets.

The resulting **5-Tier Spatial Prioritisation Baseline** provides natural capital investors, conservation charities, and organisations like Oxygen Conservation with an evidence-based decision-support tool to strategically direct capital allocation, land acquisition, and Biodiversity Net Gain (BNG) credit generation toward sites with the highest ecological return on investment (ROI).

---

## Key Capabilities & Strategic Highlights

- **Statutory Ecological Anchoring**: Ancient Woodland patches are designated as permanent ecological anchors to ensure long-term ecosystem resilience and temporal continuity.
- **Biogeographically Tailored Target Habitats**: Rather than applying a generic template, each National Park is matched to its defining ecological asset (e.g., *Blanket Bog* in the Peak District, *Wood-Pasture & Parkland* in the New Forest, *Limestone Pavement* in the Yorkshire Dales, and *Reedbeds/Fens* in The Broads).
- **Physical Barrier & Fragmentation Filtering**: Integrated Ordnance Survey (OS) Open Roads network geometry to systematically excise highway corridors (10 m buffer), mitigating road mortality and functional landscape severance.
- **Multi-Criteria Decision Analysis (MCDA)**: Applied a Weighted Linear Combination (WLC) model balancing:
  $$\text{Score} = w_1 \cdot (1 - d_{\text{norm}}) + w_2 \cdot (a_{\text{norm}}) + w_3 \cdot (\text{Environmental Suitability})$$
  - **Ecological Efficacy ($50\%$)**: Distance minimisation to core ancient woodland networks.
  - **Restoration Scale ($50\%$)**: Contiguous habitat patch area maximisation.
- **5-Tier Jenks Natural Breaks Grading**: Output classified into Tier 1 (Highest Acquisition Priority / Core Link) through Tier 5 (Low Strategic Contribution) for intuitive spatial interpretation.
- **End-to-End Automation via Python & PyQGIS**: Automated data ingestion, geometric difference/intersection operations, spatial indexing (`cKDTree`), scoring, and 300 DPI high-resolution cartographic layout rendering across all 10 National Parks.

---

## Spatial Methodology & Pipeline Architecture

```text
[1. Baseline Core Identification]
   └── Natural England Ancient Woodland Inventory (Anchor Polygons)
   └── Generate 250 m Euclidean Connectivity Buffers
            │
[2. Spatial Gap & Target Extraction]
   └── Erase existing Habitat Network Core Polygons (Extract Restoration Gaps)
   └── Spatial Overlay with Priority Habitat Inventory (PHI England)
   └── Geometric difference with OS Open Roads (10 m Barrier Buffer)
            │
[3. Multi-Criteria Attribute Scoring (MCDA)]
   └── Distance to Nearest Core Anchor (Centroid-to-Centroid Nearest-Neighbour Search)
   └── Contiguous Restorable Patch Area Calculation (ha)
   └── Min-Max Feature Normalisation & Multi-Criteria Weighting
            │
[4. Decision-Support Classification]
   └── Jenks Natural Breaks 5-Tier Prioritisation Engine
   └── Batch Automated Layout Generation with OpenStreetMap (OSM) Base Layer

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


One of the reason why python is such a great and versatile language is because the libraries of different functionalities are created and made accessible by so many individual hobbiest and developers. For each field of interest there are so many well known libraries, and mingus and music.py are two of the well known music libraries in Python.I thought mingus was especially interesting because it lets you experiment with music theory and generate algorithmic music through the manipulation of those music theory. I played piano from early age and is greatly interested in different types of music, so I know the power of music theory to resonate with different people. Regardless of that, I think algorithmic generative creativity of not only music but any other discipline is limitless and more people should utilise it, because it lets us tap into creativity.




### job_scraping_automation


Ever since programming and software engineering became a skill that not only IT professionals but general public could have access to, I saw many people using software to automate everyday tasks, earn money and do financial trading with automation. At first I wasn't really into these, but I began to realise the power of productivity and saving time. These automations allow you to be more efficient and spend less time doing repetitive work. So I thought why don't I also use them for scraping jobs from the internet so I get more chance of employment. I used a python library called selenium which is a well known web-scraping library. Web scraping is a term used to call automated tasks which involves the machine accessing many webpages and searching for and obtaining the information it wants.



### processing_shader


Processing is an open source generative art tool, along with p5.js. Former is written in c++ and the latter in P5.js, and I think processing lets you be more free in energy and less restrained. Generative coding or generative art is basically making art with the power of algorithmic generation , and I said before , being generative provides a good entrance point to creative endeavours and irregularity. Shader, made well known by animation engineer Inigo Quilez, is a mathematical way of making 3d animation. It uses mathematical vectors and equations to produce moving 3d image, and it is very effective. Although you need a very graphically capable hardware to run it, it is a fun way to get over maths. I used processing a lot in making prototypes of projects before I would move onto Three.js, Python, html etc and processing had also a shader library so I tried making shader with processing, however compared to the well known shadertoy platform, the library was very elementary. Shadertoy was very slow to run on my gpu-less computer, but both platforms are very enjoyable.And also I have made some 3d landscape animations using a tool called Thee.js. 

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

https://raw.githack.com/ilwoongchoi/Portfolio/main/interdisciplinary_research/simulation%26computations/peatland_3d_interactive.html <img width="400" height="297" alt="image" src="https://github.com/user-attachments/assets/9e7331ca-f94d-43ef-b11c-02756f2c25af" />

https://raw.githack.com/ilwoongchoi/Portfolio/main/interdisciplinary_research/simulation%26computations/peatland_physics_based.html
<img width="400" height="297" alt="image" src="https://github.com/user-attachments/assets/029d4a31-b260-46d2-9549-330dd8cf2258" />

https://raw.githack.com/ilwoongchoi/Portfolio/main/interdisciplinary_research/simulation%26computations/peatland_rule_based.html
<img width="400" height="297" alt="image" src="https://github.com/user-attachments/assets/261a30c1-293d-45ac-a85b-ba5efa2f2ca3" />

https://raw.githack.com/ilwoongchoi/Portfolio/main/interdisciplinary_research/simulation%26computations/planck_morphology_plotly.html <img width="400" height="297" alt="image" src="https://github.com/user-attachments/assets/01efd180-1e32-4c59-847b-e771d846e734" />

<img width="400" height="357" alt="image" src="https://github.com/user-attachments/assets/503ab7d5-9753-4c33-b33e-2dc78d75d15d" /> <img width="400" height="385" alt="image" src="https://github.com/user-attachments/assets/f0b0f14a-7ea6-4267-803c-f4066c791ca4" /> <img width="400" height="264" alt="image" src="https://github.com/user-attachments/assets/a9879791-df51-4552-a242-89f3c39912c6" /><img width="400" height="208" alt="image" src="https://github.com/user-attachments/assets/692f7bd9-41a7-4e7d-b731-43ec94c15326" /><img width="400" height="293" alt="image" src="https://github.com/user-attachments/assets/7fdfd8c1-b8cb-47b1-9894-027d2a805579" /><img width="400" height="237" alt="image" src="https://github.com/user-attachments/assets/87284b71-f735-49d3-a684-a3c35d625291" /> <img width="400" height="108" alt="image" src="https://github.com/user-attachments/assets/c02b596a-d222-4e28-804f-f7fce2a99a6a" />









