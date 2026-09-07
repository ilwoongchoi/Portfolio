r"""
Cotswolds Landscape Permeability & Least-Cost Connectivity Model (v2)
====================================================================
v2: Uses UKCEH LCM2023 10m raster as primary resistance surface
    + vector overlay (ancient woodland, roads, PHI, habitat networks)

Focal scenario: Woodland-associated mammals (hypothetical species-group)

Pipeline:
  1. Extract Cotswolds boundary from AONB
  2. Load LCM2023 10m raster, resample to 25m, map classes to resistance
  3. Clip Ancient Woodland, Habitat Networks, PHI, Roads
  4. Overlay vector habitats & road barriers on LCM resistance
  5. Identify ancient woodland core patches (>5ha)
  6. Calculate least-cost distances between core patches
  7. Build connectivity network (NetworkX)
  8. Calculate centrality metrics (degree, betweenness, closeness)
  9. Identify pinch points & restoration opportunities
 10. Node removal analysis
 11. Save all outputs to GPKG + GeoTIFF + CSV
"""

import geopandas as gpd
import pandas as pd
import numpy as np
from shapely.ops import unary_union
from shapely.geometry import Point, LineString
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
import networkx as nx
from osgeo import gdal, osr
import zipfile, os, time, warnings

warnings.filterwarnings("ignore")
gdal.UseExceptions()

# ============================================================
# CONFIG
# ============================================================
BASE = r"D:\새 폴더"
OUT_GPKG = rf"{BASE}\cotswolds_permeability_v2_results.gpkg"
OUT_DIR = rf"{BASE}\cotswolds_permeability_v2_outputs"
os.makedirs(OUT_DIR, exist_ok=True)

AONB_PATH = rf"{BASE}\Areas_of_Outstanding_Natural_Beauty_England.gpkg\Areas_of_Outstanding_Natural_Beauty_England.gpkg"
AW_PATH = rf"{BASE}\Ancient_Woodland_England.gpkg (1)\Ancient_Woodland_England.gpkg"
HAB_PKG = rf"{BASE}\Habitat_Networks_Individual_England.gpkg\Habitat_Networks_Individual_England.gpkg"
PHI_PATH = rf"{BASE}\PHI_full.gpkg"
ROAD_ZIP = rf"{BASE}\oproad_essh_gb.zip"
ROAD_EXTRACT = rf"{BASE}\oproad_extracted"
LCM_PATH = rf"{BASE}\FME_346C3835_1788723753818_27021\data\LCM.tif"

CELL_SIZE = 50  # metres — modelling resolution (LCM resampled from 10m to 50m)
CORE_MIN_AREA_HA = 5.0
CONNECTIVITY_THRESHOLD_M = 3000
COST_THRESHOLD = 5000
EPSG = 27700

# LCM2023 class -> resistance value mapping
# Based on UKCEH class definitions and woodland-associated mammal dispersal
LCM_RESISTANCE = {
    0: 50,    # NoData / water — moderate-high barrier for terrestrial
    1: 2,     # Broadleaved woodland — low resistance
    2: 5,     # Coniferous woodland — moderate
    3: 10,    # Cropland / arable — high
    4: 8,     # Improved grassland — moderate-high
    6: 5,     # Neutral grassland — moderate
    7: 5,     # Calcareous grassland — moderate
    9: 8,     # Bog — moderate-high
    10: 5,    # Heather — moderate
    12: 5,    # Heather grass — moderate
    14: 80,   # Saltwater — very high barrier
    20: 80,   # Urban — very high
    21: 30,   # Suburban — high
}

# Vector overlay resistance (overrides LCM where present)
VECTOR_RESISTANCE = {
    "ancient_woodland": 1,
    "ancient_semi_natural_woodland": 2,
    "phi_habitat": 4,
    "lowland_calcareous_grassland": 5,
    "calcareous_grassland": 5,
    "lowland_meadows": 5,
    "heathland": 5,
    "lowland_heathland": 5,
    "road_motorway": 100,
    "road_a": 60,
    "road_b": 30,
    "road_minor": 15,
}

# Save combined resistance lookup
lookup_records = [
    {"source": "LCM", "class_code": k, "class_name": {
        0: "NoData/Water", 1: "Broadleaved woodland", 2: "Coniferous woodland",
        3: "Cropland", 4: "Improved grassland", 6: "Neutral grassland",
        7: "Calcareous grassland", 9: "Bog", 10: "Heather",
        12: "Heather grass", 14: "Saltwater", 20: "Urban", 21: "Suburban"
    }.get(k, "Unknown"), "resistance_value": v}
    for k, v in LCM_RESISTANCE.items()
]
lookup_records += [
    {"source": "Vector", "class_code": "", "class_name": k, "resistance_value": v}
    for k, v in VECTOR_RESISTANCE.items()
]
pd.DataFrame(lookup_records).to_csv(rf"{OUT_DIR}\resistance_lookup_v2.csv", index=False)
print("[0] Saved resistance_lookup_v2.csv")

# ============================================================
# STEP 1: Extract Cotswolds boundary
# ============================================================
print("\n=== STEP 1: Cotswolds Boundary ===")
aonb = gpd.read_file(AONB_PATH).to_crs(f"EPSG:{EPSG}")
cotswolds = aonb[aonb["name"].apply(lambda x: "Cotswolds" in str(x) if x else False)].copy()
print(f"  Cotswolds boundary: {len(cotswolds)} feature(s), area={cotswolds.geometry.area.sum()/1e6:.0f} km²")
cotswolds_geom = unary_union(cotswolds.geometry)
cotswolds.to_file(OUT_GPKG, layer="01_study_area", driver="GPKG")
minx, miny, maxx, maxy = cotswolds_geom.bounds
print(f"  BBox: ({minx:.0f}, {miny:.0f}, {maxx:.0f}, {maxy:.0f})")

# ============================================================
# STEP 2: Load LCM and build base resistance raster
# ============================================================
print("\n=== STEP 2: Load LCM2023 & Build Base Resistance ===")
lcm_ds = gdal.Open(LCM_PATH)
lcm_gt = lcm_ds.GetGeoTransform()
lcm_w = lcm_ds.RasterXSize
lcm_h = lcm_ds.RasterYSize
lcm_x0 = lcm_gt[0]
lcm_y0 = lcm_gt[3]
lcm_pixel = lcm_gt[1]
print(f"  LCM: {lcm_w}x{lcm_h} at {lcm_pixel}m, origin=({lcm_x0:.0f}, {lcm_y0:.0f})")

lcm_arr = lcm_ds.GetRasterBand(1).ReadAsArray()
lcm_prob = lcm_ds.GetRasterBand(2).ReadAsArray()

# Build output grid aligned to Cotswolds bbox at 25m
x0 = int(np.floor(minx / CELL_SIZE) * CELL_SIZE)
y0 = int(np.floor(miny / CELL_SIZE) * CELL_SIZE)
x1 = int(np.ceil(maxx / CELL_SIZE) * CELL_SIZE)
y1 = int(np.ceil(maxy / CELL_SIZE) * CELL_SIZE)
ncols = int((x1 - x0) / CELL_SIZE)
nrows = int((y1 - y0) / CELL_SIZE)
print(f"  Output grid: {ncols} x {nrows} cells at {CELL_SIZE}m")

# Resample LCM to 25m grid using nearest neighbour (block mode)
print("  Resampling LCM 10m -> 25m (mode aggregation)...")
resistance = np.full((nrows, ncols), 10, dtype=np.float32)  # default

for r in range(nrows):
    gy0 = y1 - (r + 1) * CELL_SIZE
    gy1 = y1 - r * CELL_SIZE
    # LCM pixel range
    lc_r0 = int((lcm_y0 - gy1) / lcm_pixel)
    lc_r1 = int((lcm_y0 - gy0) / lcm_pixel)
    lc_r0 = max(0, min(lcm_h, lc_r0))
    lc_r1 = max(0, min(lcm_h, lc_r1))
    if lc_r0 == lc_r1:
        lc_r1 = lc_r0 + 1
    
    for c in range(ncols):
        gx0 = x0 + c * CELL_SIZE
        gx1 = x0 + (c + 1) * CELL_SIZE
        lc_c0 = int((gx0 - lcm_x0) / lcm_pixel)
        lc_c1 = int((gx1 - lcm_x0) / lcm_pixel)
        lc_c0 = max(0, min(lcm_w, lc_c0))
        lc_c1 = max(0, min(lcm_w, lc_c1))
        if lc_c0 == lc_c1:
            lc_c1 = lc_c0 + 1
        
        window = lcm_arr[lc_r0:lc_r1, lc_c0:lc_c1]
        if window.size > 0:
            # Mode (most common class)
            vals, counts = np.unique(window, return_counts=True)
            mode_val = vals[np.argmax(counts)]
            resistance[r, c] = LCM_RESISTANCE.get(int(mode_val), 10)

print(f"  LCM resistance mapped. Mean={np.nanmean(resistance):.1f}, Max={np.nanmax(resistance):.1f}")

# Save LCM-based resistance raster
lcm_res_path = rf"{OUT_DIR}\03_landcover_resistance_lcm.tif"
driver = gdal.GetDriverByName("GTiff")
ds_out = driver.Create(lcm_res_path, ncols, nrows, 1, gdal.GDT_Float32)
ds_out.SetGeoTransform((x0, CELL_SIZE, 0, y1, 0, -CELL_SIZE))
srs = osr.SpatialReference()
srs.ImportFromEPSG(EPSG)
ds_out.SetProjection(srs.ExportToWkt())
ds_out.GetRasterBand(1).WriteArray(resistance)
ds_out.GetRasterBand(1).SetNoDataValue(-9999)
ds_out.FlushCache()
ds_out = None
print(f"  Saved: {lcm_res_path}")
del lcm_arr, lcm_prob, lcm_ds

# ============================================================
# STEP 3: Clip Ancient Woodland
# ============================================================
print("\n=== STEP 3: Clip Ancient Woodland ===")
aw = gpd.read_file(AW_PATH).to_crs(f"EPSG:{EPSG}")
aw_clip = gpd.clip(aw, cotswolds_geom).copy()
aw_clip = aw_clip[aw_clip.geometry.notna() & ~aw_clip.geometry.is_empty]
aw_clip["aw_area_ha"] = aw_clip.geometry.area / 10000.0
aw_clip.to_file(OUT_GPKG, layer="02_ancient_woodland", driver="GPKG")
print(f"  Ancient woodland patches: {len(aw_clip)}, total area: {aw_clip.geometry.area.sum()/1e6:.1f} km²")
del aw

# ============================================================
# STEP 4: Clip Habitat Networks
# ============================================================
print("\n=== STEP 4: Clip Habitat Networks ===")
habitat_layers_to_use = [
    "Ancient_Semi_Natural_Woodland",
    "Lowland_Calcareous_Grassland",
    "Calcareous_grassland",
    "Lowland_Meadows",
    "Heathland",
    "Lowland_Heathland",
]

habitat_clipped = {}
for layer_name in habitat_layers_to_use:
    try:
        hl = gpd.read_file(HAB_PKG, layer=layer_name).to_crs(f"EPSG:{EPSG}")
        hlc = gpd.clip(hl, cotswolds_geom).copy()
        hlc = hlc[hlc.geometry.notna() & ~hlc.geometry.is_empty]
        if len(hlc) > 0:
            hlc.to_file(OUT_GPKG, layer=f"03_hab_{layer_name}", driver="GPKG")
            habitat_clipped[layer_name] = hlc
            print(f"  {layer_name}: {len(hlc)} features, {hlc.geometry.area.sum()/1e6:.2f} km²")
        del hl
    except Exception as e:
        print(f"  {layer_name}: SKIP ({e})")

# ============================================================
# STEP 5: Clip PHI
# ============================================================
print("\n=== STEP 5: Clip PHI ===")
phi = gpd.read_file(PHI_PATH).to_crs(f"EPSG:{EPSG}")
phi_clip = gpd.clip(phi, cotswolds_geom).copy()
phi_clip = phi_clip[phi_clip.geometry.notna() & ~phi_clip.geometry.is_empty]
phi_clip.to_file(OUT_GPKG, layer="04_phi_habitats", driver="GPKG")
print(f"  PHI patches: {len(phi_clip)}")
del phi

# ============================================================
# STEP 6: Clip Roads
# ============================================================
print("\n=== STEP 6: Clip Roads ===")
os.makedirs(ROAD_EXTRACT, exist_ok=True)
with zipfile.ZipFile(ROAD_ZIP, 'r') as z:
    all_road_files = [x for x in z.namelist() if '_RoadLink.shp' in x]
    avail_tiles = sorted(set(x.split('/')[1].split('_')[0] for x in all_road_files))

cotswolds_tiles = [t for t in avail_tiles if t.startswith(('SP', 'SO', 'ST', 'SU', 'TL', 'TQ'))]
print(f"  Candidate road tiles: {len(cotswolds_tiles)}")

roads_list = []
for tile in cotswolds_tiles:
    shp_path = rf"{ROAD_EXTRACT}\data\{tile}_RoadLink.shp"
    if not os.path.exists(shp_path):
        try:
            with zipfile.ZipFile(ROAD_ZIP, 'r') as z:
                members = [x for x in z.namelist() if f'{tile}_RoadLink' in x]
                for m in members:
                    z.extract(m, ROAD_EXTRACT)
        except Exception:
            continue
    if os.path.exists(shp_path):
        try:
            rd = gpd.read_file(shp_path).to_crs(f"EPSG:{EPSG}")
            rd_clip = gpd.clip(rd, cotswolds_geom)
            if len(rd_clip) > 0:
                roads_list.append(rd_clip)
            del rd
        except Exception:
            pass

if roads_list:
    roads = gpd.GeoDataFrame(pd.concat(roads_list, ignore_index=True), crs=f"EPSG:{EPSG}")
else:
    roads = gpd.GeoDataFrame({"geometry": []}, crs=f"EPSG:{EPSG}")

print(f"  Road segments in Cotswolds: {len(roads)}")

road_class_col = None
for col in ["function", "Function", "class", "Class", "roadClass", "classification"]:
    if col in roads.columns:
        road_class_col = col
        break

if road_class_col:
    print(f"  Road class column: '{road_class_col}'")
else:
    print("  No road class column found — using uniform resistance")

roads.to_file(OUT_GPKG, layer="05_roads", driver="GPKG")

# ============================================================
# STEP 7: Overlay Vector Habitats on LCM Resistance
# ============================================================
print("\n=== STEP 7: Overlay Vector Habitats on LCM Resistance ===")

xs = np.arange(x0 + CELL_SIZE/2, x1, CELL_SIZE)
ys = np.arange(y1 - CELL_SIZE/2, y0, -CELL_SIZE)
xx, yy = np.meshgrid(xs, ys)
flat_x = xx.ravel()
flat_y = yy.ravel()

grid_points = gpd.GeoDataFrame(
    {"grid_id": np.arange(len(flat_x))},
    geometry=[Point(x, y) for x, y in zip(flat_x, flat_y)],
    crs=f"EPSG:{EPSG}"
)

# PHI (resistance = 4, overrides LCM)
if len(phi_clip) > 0:
    print("  Burning PHI habitats (resistance=4)...")
    phi_join = gpd.sjoin(grid_points, phi_clip[["geometry"]], predicate="within", how="inner")
    if len(phi_join) > 0:
        idx = phi_join["grid_id"].values
        resistance.ravel()[idx] = VECTOR_RESISTANCE["phi_habitat"]
        print(f"    {len(idx)} cells overridden to resistance=4")
    del phi_join

# Habitat networks (in order of increasing resistance so lower values overwrite)
for layer_name, res_key in [
    ("Heathland", "heathland"),
    ("Lowland_Heathland", "lowland_heathland"),
    ("Lowland_Meadows", "lowland_meadows"),
    ("Calcareous_grassland", "calcareous_grassland"),
    ("Lowland_Calcareous_Grassland", "lowland_calcareous_grassland"),
    ("Ancient_Semi_Natural_Woodland", "ancient_semi_natural_woodland"),
]:
    if layer_name in habitat_clipped and len(habitat_clipped[layer_name]) > 0:
        res_val = VECTOR_RESISTANCE[res_key]
        print(f"  Burning {layer_name} (resistance={res_val})...")
        hj = gpd.sjoin(grid_points, habitat_clipped[layer_name][["geometry"]], predicate="within", how="inner")
        if len(hj) > 0:
            idx = hj["grid_id"].values
            resistance.ravel()[idx] = res_val
            print(f"    {len(idx)} cells overridden to resistance={res_val}")
        del hj

# Ancient Woodland (resistance = 1, lowest — overwrites everything)
if len(aw_clip) > 0:
    print("  Burning Ancient Woodland (resistance=1)...")
    aw_join = gpd.sjoin(grid_points, aw_clip[["geometry"]], predicate="within", how="inner")
    if len(aw_join) > 0:
        idx = aw_join["grid_id"].values
        resistance.ravel()[idx] = VECTOR_RESISTANCE["ancient_woodland"]
        print(f"    {len(idx)} cells overridden to resistance=1")
    del aw_join

# Roads as high-resistance barriers
if len(roads) > 0:
    print("  Burning road barriers...")
    road_buf = roads.copy()
    road_buf["geometry"] = roads.geometry.buffer(15)

    if road_class_col and road_class_col in roads.columns:
        def get_road_resistance(val):
            val_str = str(val).upper() if val is not None else ""
            if "MOT" in val_str:
                return VECTOR_RESISTANCE["road_motorway"]
            elif val_str.startswith("A") or "PRIM" in val_str:
                return VECTOR_RESISTANCE["road_a"]
            elif val_str.startswith("B") or "SEC" in val_str:
                return VECTOR_RESISTANCE["road_b"]
            else:
                return VECTOR_RESISTANCE["road_minor"]

        road_buf["res_val"] = road_buf[road_class_col].apply(get_road_resistance)
        for res_val in sorted(road_buf["res_val"].unique(), reverse=True):
            subset = road_buf[road_buf["res_val"] == res_val]
            rj = gpd.sjoin(grid_points, subset[["geometry"]], predicate="within", how="inner")
            if len(rj) > 0:
                idx = rj["grid_id"].values
                resistance.ravel()[idx] = res_val
                print(f"    Road class resistance={res_val}: {len(idx)} cells")
            del rj
    else:
        rj = gpd.sjoin(grid_points, road_buf[["geometry"]], predicate="within", how="inner")
        if len(rj) > 0:
            idx = rj["grid_id"].values
            resistance.ravel()[idx] = VECTOR_RESISTANCE["road_a"]
            print(f"    Roads (uniform resistance={VECTOR_RESISTANCE['road_a']}): {len(idx)} cells")
        del rj

# Mask outside Cotswolds boundary
print("  Masking outside Cotswolds boundary...")
boundary_join = gpd.sjoin(grid_points, cotswolds[["geometry"]], predicate="within", how="inner")
inside_ids = set(boundary_join["grid_id"].values)
outside_mask = np.ones(nrows * ncols, dtype=bool)
outside_mask[list(inside_ids)] = False
resistance.ravel()[outside_mask] = np.nan
del boundary_join, grid_points

# Save combined resistance raster
resistance_path = rf"{OUT_DIR}\09_combined_resistance_v2.tif"
driver = gdal.GetDriverByName("GTiff")
ds = driver.Create(resistance_path, ncols, nrows, 1, gdal.GDT_Float32)
ds.SetGeoTransform((x0, CELL_SIZE, 0, y1, 0, -CELL_SIZE))
srs = osr.SpatialReference()
srs.ImportFromEPSG(EPSG)
ds.SetProjection(srs.ExportToWkt())
band = ds.GetRasterBand(1)
band.WriteArray(resistance)
band.SetNoDataValue(np.nan)
ds.FlushCache()
ds = None
print(f"  Saved combined resistance raster: {resistance_path}")
print(f"  Resistance stats: mean={np.nanmean(resistance):.1f}, min={np.nanmin(resistance):.1f}, max={np.nanmax(resistance):.1f}")

# ============================================================
# STEP 8: Identify Core Patches
# ============================================================
print("\n=== STEP 8: Identify Ancient Woodland Core Patches ===")
cores = aw_clip[aw_clip["aw_area_ha"] >= CORE_MIN_AREA_HA].copy().reset_index(drop=True)
cores["core_id"] = range(1, len(cores) + 1)
cores["centroid_x"] = cores.geometry.centroid.x
cores["centroid_y"] = cores.geometry.centroid.y
cores.to_file(OUT_GPKG, layer="10_core_patches", driver="GPKG")
print(f"  Core patches (>= {CORE_MIN_AREA_HA} ha): {len(cores)}")
print(f"  Total core area: {cores.geometry.area.sum()/1e6:.1f} km²")

if len(cores) < 2:
    print("  ERROR: Fewer than 2 core patches. Exiting.")
    exit(1)

# ============================================================
# STEP 9: Build Sparse Graph & Calculate Least-Cost Distances
# ============================================================
print("\n=== STEP 9: Least-Cost Distance Calculation ===")
resistance_filled = np.where(np.isnan(resistance), 9999.0, resistance).astype(np.float32)
del resistance

print("  Building grid graph (4-neighbour)...")
t0 = time.time()

flat_res = resistance_filled.ravel()
n_total = nrows * ncols

src_right = np.arange(n_total).reshape(nrows, ncols)[:, :-1].ravel()
dst_right = np.arange(n_total).reshape(nrows, ncols)[:, 1:].ravel()
cost_right = (flat_res[src_right] + flat_res[dst_right]) / 2.0 * CELL_SIZE

src_down = np.arange(n_total).reshape(nrows, ncols)[:-1, :].ravel()
dst_down = np.arange(n_total).reshape(nrows, ncols)[1:, :].ravel()
cost_down = (flat_res[src_down] + flat_res[dst_down]) / 2.0 * CELL_SIZE

src = np.concatenate([src_right, dst_right, src_down, dst_down])
dst = np.concatenate([dst_right, src_right, dst_down, src_down])
w = np.concatenate([cost_right, cost_right, cost_down, cost_down])

mask = w < 9999.0 * CELL_SIZE
src = src[mask]
dst = dst[mask]
w = w[mask]

adj = csr_matrix((w, (src, dst)), shape=(n_total, n_total))
print(f"  Graph: {n_total} nodes, {len(w)} edges, built in {time.time()-t0:.1f}s")

# Map core centroids to grid indices
core_indices = []
for _, row in cores.iterrows():
    cx, cy = row["centroid_x"], row["centroid_y"]
    col = int((cx - x0) / CELL_SIZE)
    row_idx = int((y1 - cy) / CELL_SIZE)
    col = max(0, min(ncols - 1, col))
    row_idx = max(0, min(nrows - 1, row_idx))
    grid_idx = row_idx * ncols + col
    core_indices.append(grid_idx)

print(f"  Computing least-cost distances from {len(core_indices)} source nodes...")
t0 = time.time()

core_pairs = []
for i, src_idx in enumerate(core_indices):
    if i % 50 == 0:
        print(f"    Source {i+1}/{len(core_indices)}... ({time.time()-t0:.0f}s)")
    dists = dijkstra(adj, indices=[src_idx], directed=False, return_predecessors=False)[0]
    
    for j in range(len(cores)):
        if j == i:
            continue
        euclidean_dist = np.sqrt(
            (cores.iloc[i]["centroid_x"] - cores.iloc[j]["centroid_x"])**2 +
            (cores.iloc[i]["centroid_y"] - cores.iloc[j]["centroid_y"])**2
        )
        if euclidean_dist <= CONNECTIVITY_THRESHOLD_M:
            cost_dist = dists[core_indices[j]]
            if cost_dist < COST_THRESHOLD and cost_dist > 0:
                core_pairs.append({
                    "source": cores.iloc[i]["core_id"],
                    "target": cores.iloc[j]["core_id"],
                    "euclidean_m": euclidean_dist,
                    "cost_distance": cost_dist,
                    "resistance_ratio": cost_dist / euclidean_dist if euclidean_dist > 0 else 0,
                })
    del dists

print(f"  Dijkstra completed in {time.time()-t0:.1f}s")

pairs_df = pd.DataFrame(core_pairs)
print(f"  Candidate connections: {len(pairs_df)}")
if len(pairs_df) > 0:
    pairs_df.to_csv(rf"{OUT_DIR}\least_cost_pairs_v2.csv", index=False)

# ============================================================
# STEP 10: Build Connectivity Network
# ============================================================
print("\n=== STEP 10: Build Connectivity Network ===")
G = nx.Graph()

for _, row in cores.iterrows():
    G.add_node(row["core_id"], area_ha=row["aw_area_ha"],
               x=row["centroid_x"], y=row["centroid_y"])

for _, p in pairs_df.iterrows():
    G.add_edge(p["source"], p["target"],
               euclidean_m=p["euclidean_m"],
               cost_distance=p["cost_distance"],
               resistance_ratio=p["resistance_ratio"],
               weight=p["cost_distance"])

print(f"  Network: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
print(f"  Connected components: {nx.number_connected_components(G)}")

# ============================================================
# STEP 11: Network Centrality Analysis
# ============================================================
print("\n=== STEP 11: Network Centrality Analysis ===")
degree_cent = nx.degree_centrality(G)
betweenness_cent = nx.betweenness_centrality(G, weight="weight")
closeness_cent = nx.closeness_centrality(G, distance="weight")

components = list(nx.connected_components(G))
component_sizes = {n: len(c) for n, c in enumerate(components)}
node_component = {}
for comp_id, comp in enumerate(components):
    for node in comp:
        node_component[node] = comp_id

centrality_records = []
for _, row in cores.iterrows():
    cid = row["core_id"]
    centrality_records.append({
        "core_id": cid,
        "area_ha": row["aw_area_ha"],
        "centroid_x": row["centroid_x"],
        "centroid_y": row["centroid_y"],
        "degree_centrality": degree_cent.get(cid, 0),
        "betweenness_centrality": betweenness_cent.get(cid, 0),
        "closeness_centrality": closeness_cent.get(cid, 0),
        "component_id": node_component.get(cid, -1),
        "component_size": component_sizes.get(node_component.get(cid, -1), 0),
        "is_isolated": G.degree(cid) == 0,
    })

cent_df = pd.DataFrame(centrality_records)
cent_gdf = gpd.GeoDataFrame(
    cent_df,
    geometry=[Point(x, y) for x, y in zip(cent_df["centroid_x"], cent_df["centroid_y"])],
    crs=f"EPSG:{EPSG}",
)

if cent_df["betweenness_centrality"].max() > 0:
    cent_gdf["betweenness_norm"] = cent_df["betweenness_centrality"] / cent_df["betweenness_centrality"].max()
else:
    cent_gdf["betweenness_norm"] = 0

cent_gdf.to_file(OUT_GPKG, layer="15_centrality", driver="GPKG")
print(f"  Saved: 15_centrality ({len(cent_gdf)} nodes)")

top_nodes = cent_df.nlargest(5, "betweenness_centrality")[
    ["core_id", "area_ha", "degree_centrality", "betweenness_centrality", "component_size"]
]
print("\n  Top 5 critical nodes (by betweenness):")
print(top_nodes.to_string(index=False))

# ============================================================
# STEP 12: Build Corridor Lines
# ============================================================
print("\n=== STEP 12: Build Corridor Lines ===")
edge_records = []
for u, v, data in G.edges(data=True):
    u_row = cores[cores["core_id"] == u].iloc[0]
    v_row = cores[cores["core_id"] == v].iloc[0]
    line = LineString([
        (u_row["centroid_x"], u_row["centroid_y"]),
        (v_row["centroid_x"], v_row["centroid_y"]),
    ])
    edge_records.append({
        "source": u, "target": v,
        "euclidean_m": data["euclidean_m"],
        "cost_distance": data["cost_distance"],
        "resistance_ratio": data["resistance_ratio"],
        "geometry": line,
    })

if edge_records:
    edges_gdf = gpd.GeoDataFrame(edge_records, crs=f"EPSG:{EPSG}")
    edges_gdf.to_file(OUT_GPKG, layer="14_connectivity_network", driver="GPKG")
    print(f"  Saved: 14_connectivity_network ({len(edges_gdf)} edges)")

# ============================================================
# STEP 13: Pinch Points & Restoration Opportunities
# ============================================================
print("\n=== STEP 13: Pinch Points & Restoration Opportunities ===")
restoration_records = []
for _, p in pairs_df.iterrows():
    if p["resistance_ratio"] > 2.0:
        src_core = cores[cores["core_id"] == p["source"]].iloc[0]
        tgt_core = cores[cores["core_id"] == p["target"]].iloc[0]
        midpoint = Point(
            (src_core["centroid_x"] + tgt_core["centroid_x"]) / 2,
            (src_core["centroid_y"] + tgt_core["centroid_y"]) / 2,
        )
        restoration_records.append({
            "source": p["source"], "target": p["target"],
            "euclidean_m": p["euclidean_m"],
            "cost_distance": p["cost_distance"],
            "resistance_ratio": p["resistance_ratio"],
            "restoration_priority": p["resistance_ratio"] * (1 / p["euclidean_m"]) * 1000,
            "geometry": midpoint,
        })

if restoration_records:
    rest_gdf = gpd.GeoDataFrame(restoration_records, crs=f"EPSG:{EPSG}")
    rest_gdf = rest_gdf.sort_values("restoration_priority", ascending=False)
    rest_gdf.to_file(OUT_GPKG, layer="17_restoration_opportunities", driver="GPKG")
    print(f"  Saved: 17_restoration_opportunities ({len(rest_gdf)} sites)")
else:
    print("  No high-resistance gaps identified")

# ============================================================
# STEP 14: Node Removal Analysis
# ============================================================
print("\n=== STEP 14: Node Removal Analysis ===")
original_components = nx.number_connected_components(G)
original_largest = max(len(c) for c in nx.connected_components(G))

removal_records = []
for node in G.nodes():
    if G.degree(node) == 0:
        continue
    G_temp = G.copy()
    G_temp.remove_node(node)
    new_components = nx.number_connected_components(G_temp)
    new_largest = max(len(c) for c in nx.connected_components(G_temp)) if G_temp.number_of_nodes() > 0 else 0
    removal_records.append({
        "core_id": node,
        "degree": G.degree(node),
        "fragmentation_impact": original_largest - new_largest,
        "components_before": original_components,
        "components_after": new_components,
    })

removal_df = pd.DataFrame(removal_records).sort_values("fragmentation_impact", ascending=False)
removal_df.to_csv(rf"{OUT_DIR}\node_removal_analysis_v2.csv", index=False)
print(f"  Saved: node_removal_analysis_v2.csv ({len(removal_df)} nodes)")

# ============================================================
# STEP 15: Summary
# ============================================================
print("\n=== STEP 15: Summary ===")
summary = {
    "version": "v2 (LCM2023 + vector overlay)",
    "study_area": "Cotswolds National Landscape",
    "focal_scenario": "Woodland-associated mammals",
    "modelling_resolution_m": CELL_SIZE,
    "lcm_source": "UKCEH LCM2023 10m classified pixels (resampled to 25m)",
    "total_core_patches": len(cores),
    "total_core_area_ha": cores.geometry.area.sum() / 10000,
    "network_nodes": G.number_of_nodes(),
    "network_edges": G.number_of_edges(),
    "connected_components": nx.number_connected_components(G),
    "isolated_nodes": sum(1 for n in G.nodes() if G.degree(n) == 0),
    "mean_betweenness": np.mean(list(betweenness_cent.values())),
    "max_betweenness": np.max(list(betweenness_cent.values())),
    "mean_degree": np.mean([d for _, d in G.degree()]),
    "restoration_candidates": len(restoration_records) if restoration_records else 0,
    "lcm_classes_used": len(LCM_RESISTANCE),
    "vector_overlays": len(VECTOR_RESISTANCE),
}

summary_df = pd.DataFrame([summary])
summary_df.to_csv(rf"{OUT_DIR}\model_summary_v2.csv", index=False)

print(f"\n{'='*60}")
print("COTSWOLDS PERMEABILITY MODEL v2 — COMPLETE")
print(f"{'='*60}")
for k, v in summary.items():
    print(f"  {k}: {v}")
print(f"\n  Output GPKG: {OUT_GPKG}")
print(f"  Output dir:  {OUT_DIR}")
