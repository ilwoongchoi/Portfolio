r"""
Cotswolds Landscape Permeability & Least-Cost Connectivity Model
================================================================
Focal scenario: Woodland-associated mammals (hypothetical species-group)

Pipeline:
  1. Extract Cotswolds boundary from AONB
  2. Clip Ancient Woodland, Habitat Networks, PHI, Roads
  3. Build 25m resistance raster from vector habitat data
  4. Identify ancient woodland core patches (>1ha)
  5. Calculate least-cost distances between core patches
  6. Build connectivity network (NetworkX)
  7. Calculate centrality metrics (degree, betweenness, closeness)
  8. Identify pinch points & restoration opportunities
  9. Save all outputs to GPKG + GeoTIFF
"""

import geopandas as gpd
import pandas as pd
import numpy as np
from shapely.ops import unary_union
from shapely.geometry import Point, LineString
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree
import networkx as nx
from osgeo import gdal, osr
import zipfile, os, time, warnings

warnings.filterwarnings("ignore")

# ============================================================
# CONFIG
# ============================================================
BASE = r"D:\새 폴더"
OUT_GPKG = rf"{BASE}\cotswolds_permeability_results.gpkg"
OUT_DIR = rf"{BASE}\cotswolds_permeability_outputs"
os.makedirs(OUT_DIR, exist_ok=True)

AONB_PATH = rf"{BASE}\Areas_of_Outstanding_Natural_Beauty_England.gpkg\Areas_of_Outstanding_Natural_Beauty_England.gpkg"
AW_PATH = rf"{BASE}\Ancient_Woodland_England.gpkg (1)\Ancient_Woodland_England.gpkg"
HAB_PKG = rf"{BASE}\Habitat_Networks_Individual_England.gpkg\Habitat_Networks_Individual_England.gpkg"
PHI_PATH = rf"{BASE}\PHI_full.gpkg"
ROAD_ZIP = rf"{BASE}\oproad_essh_gb.zip"
ROAD_EXTRACT = rf"{BASE}\oproad_extracted"

CELL_SIZE = 25  # metres — modelling resolution
CORE_MIN_AREA_HA = 5.0  # minimum ancient woodland patch size to be a "core"
CONNECTIVITY_THRESHOLD_M = 3000  # max Euclidean distance for candidate connections
COST_THRESHOLD = 5000  # max accumulated cost for network edge (resistance units)
EPSG = 27700

# Resistance lookup — documented modelling assumptions
# Based on woodland-associated mammal dispersal literature
RESISTANCE_LOOKUP = {
    "ancient_woodland": 1,
    "broadleaved_woodland_network": 2,
    "ancient_semi_natural_woodland": 2,
    "lowland_calcareous_grassland": 5,
    "calcareous_grassland": 5,
    "lowland_meadows": 5,
    "heathland": 5,
    "lowland_heathland": 5,
    "phi_habitat": 4,
    "default_agricultural": 10,
    "road_motorway": 100,
    "road_a": 60,
    "road_b": 30,
    "road_minor": 15,
}

# Save resistance lookup as CSV for documentation
pd.DataFrame([
    {"land_cover_class": k, "resistance_value": v}
    for k, v in RESISTANCE_LOOKUP.items()
]).to_csv(rf"{OUT_DIR}\resistance_lookup.csv", index=False)
print(f"[0] Saved resistance_lookup.csv")

# ============================================================
# STEP 1: Extract Cotswolds boundary
# ============================================================
print("\n=== STEP 1: Cotswolds Boundary ===")
aonb = gpd.read_file(AONB_PATH).to_crs(f"EPSG:{EPSG}")
cotswolds = aonb[aonb["name"].apply(lambda x: "Cotswolds" in str(x) if x else False)].copy()
if cotswolds.empty:
    cotswolds = aonb[aonb["NAME"].apply(lambda x: "Cotswolds" in str(x) if x else False)].copy()
print(f"  Cotswolds boundary: {len(cotswolds)} feature(s), area={cotswolds.geometry.area.sum()/1e6:.0f} km²")
cotswolds_geom = unary_union(cotswolds.geometry)
cotswolds.to_file(OUT_GPKG, layer="01_study_area", driver="GPKG")
print(f"  Saved: 01_study_area")

# Get bounding box
minx, miny, maxx, maxy = cotswolds_geom.bounds
print(f"  BBox: ({minx:.0f}, {miny:.0f}, {maxx:.0f}, {maxy:.0f})")

# ============================================================
# STEP 2: Clip Ancient Woodland
# ============================================================
print("\n=== STEP 2: Clip Ancient Woodland ===")
aw = gpd.read_file(AW_PATH).to_crs(f"EPSG:{EPSG}")
aw_clip = gpd.clip(aw, cotswolds_geom).copy()
aw_clip = aw_clip[aw_clip.geometry.notna() & ~aw_clip.geometry.is_empty]
aw_clip["aw_area_ha"] = aw_clip.geometry.area / 10000.0
aw_clip.to_file(OUT_GPKG, layer="02_ancient_woodland", driver="GPKG")
print(f"  Ancient woodland patches: {len(aw_clip)}, total area: {aw_clip.geometry.area.sum()/1e6:.1f} km²")
del aw

# ============================================================
# STEP 3: Clip Habitat Networks
# ============================================================
print("\n=== STEP 3: Clip Habitat Networks ===")
habitat_layers_to_use = [
    "Broadleaved_Woodland",
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
# STEP 4: Clip PHI
# ============================================================
print("\n=== STEP 4: Clip PHI ===")
phi = gpd.read_file(PHI_PATH).to_crs(f"EPSG:{EPSG}")
phi_clip = gpd.clip(phi, cotswolds_geom).copy()
phi_clip = phi_clip[phi_clip.geometry.notna() & ~phi_clip.geometry.is_empty]
phi_clip.to_file(OUT_GPKG, layer="04_phi_habitats", driver="GPKG")
print(f"  PHI patches: {len(phi_clip)}")
del phi

# ============================================================
# STEP 5: Clip Roads
# ============================================================
print("\n=== STEP 5: Clip Roads ===")
os.makedirs(ROAD_EXTRACT, exist_ok=True)

# Determine which road tiles overlap Cotswolds bbox
with zipfile.ZipFile(ROAD_ZIP, 'r') as z:
    all_road_files = [x for x in z.namelist() if '_RoadLink.shp' in x]
    avail_tiles = sorted(set(x.split('/')[1].split('_')[0] for x in all_road_files))

# Cotswolds is in SP/SO/ST tile range
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

# Classify roads by function/class if available
road_class_col = None
for col in ["function", "Function", "class", "Class", "roadClass", "classification"]:
    if col in roads.columns:
        road_class_col = col
        break

if road_class_col:
    print(f"  Road class column: '{road_class_col}', values: {roads[road_class_col].unique()[:10]}")
else:
    print("  No road class column found — using uniform resistance")

roads.to_file(OUT_GPKG, layer="05_roads", driver="GPKG")

# ============================================================
# STEP 6: Build Resistance Raster
# ============================================================
print("\n=== STEP 6: Build Resistance Raster ===")

# Grid dimensions
x0 = int(np.floor(minx / CELL_SIZE) * CELL_SIZE)
y0 = int(np.floor(miny / CELL_SIZE) * CELL_SIZE)
x1 = int(np.ceil(maxx / CELL_SIZE) * CELL_SIZE)
y1 = int(np.ceil(maxy / CELL_SIZE) * CELL_SIZE)

ncols = int((x1 - x0) / CELL_SIZE)
nrows = int((y1 - y0) / CELL_SIZE)
print(f"  Grid: {ncols} x {nrows} cells ({ncols*nrows/1e6:.1f}M cells) at {CELL_SIZE}m")

# Start with default resistance (agricultural)
resistance = np.full((nrows, ncols), RESISTANCE_LOOKUP["default_agricultural"], dtype=np.float32)

# Create coordinate arrays for rasterization
xs = np.arange(x0 + CELL_SIZE/2, x1, CELL_SIZE)
ys = np.arange(y1 - CELL_SIZE/2, y0, -CELL_SIZE)
xx, yy = np.meshgrid(xs, ys)
flat_x = xx.ravel()
flat_y = yy.ravel()

# Build spatial index for grid points
grid_points = gpd.GeoDataFrame(
    {"grid_id": np.arange(len(flat_x))},
    geometry=[Point(x, y) for x, y in zip(flat_x, flat_y)],
    crs=f"EPSG:{EPSG}"
)

# Rasterize PHI (resistance = 4)
if len(phi_clip) > 0:
    print("  Burning PHI habitats (resistance=4)...")
    phi_join = gpd.sjoin(grid_points, phi_clip[["geometry"]], predicate="within", how="inner")
    if len(phi_join) > 0:
        idx = phi_join["grid_id"].values
        resistance.ravel()[idx] = RESISTANCE_LOOKUP["phi_habitat"]
        print(f"    {len(idx)} cells set to resistance={RESISTANCE_LOOKUP['phi_habitat']}")
    del phi_join

# Rasterize habitat networks (in order of increasing resistance so lower values overwrite)
for layer_name, res_key in [
    ("Heathland", "heathland"),
    ("Lowland_Heathland", "lowland_heathland"),
    ("Lowland_Meadows", "lowland_meadows"),
    ("Calcareous_grassland", "calcareous_grassland"),
    ("Lowland_Calcareous_Grassland", "lowland_calcareous_grassland"),
    ("Ancient_Semi_Natural_Woodland", "ancient_semi_natural_woodland"),
    ("Broadleaved_Woodland", "broadleaved_woodland_network"),
]:
    if layer_name in habitat_clipped and len(habitat_clipped[layer_name]) > 0:
        res_val = RESISTANCE_LOOKUP[res_key]
        print(f"  Burning {layer_name} (resistance={res_val})...")
        hj = gpd.sjoin(grid_points, habitat_clipped[layer_name][["geometry"]], predicate="within", how="inner")
        if len(hj) > 0:
            idx = hj["grid_id"].values
            resistance.ravel()[idx] = res_val
            print(f"    {len(idx)} cells set to resistance={res_val}")
        del hj

# Rasterize Ancient Woodland (resistance = 1, lowest — overwrites everything)
if len(aw_clip) > 0:
    print("  Burning Ancient Woodland (resistance=1)...")
    aw_join = gpd.sjoin(grid_points, aw_clip[["geometry"]], predicate="within", how="inner")
    if len(aw_join) > 0:
        idx = aw_join["grid_id"].values
        resistance.ravel()[idx] = RESISTANCE_LOOKUP["ancient_woodland"]
        print(f"    {len(idx)} cells set to resistance=1")
    del aw_join

# Rasterize roads as high-resistance barriers
if len(roads) > 0:
    print("  Burning road barriers...")
    # Buffer roads by 15m and burn as high resistance
    road_buf = roads.copy()
    road_buf["geometry"] = roads.geometry.buffer(15)

    # Try to classify by road class
    if road_class_col and road_class_col in roads.columns:
        # Motorway → 100, A road → 60, B road → 30, minor → 15
        def get_road_resistance(val):
            val_str = str(val).upper() if val is not None else ""
            if "MOT" in val_str:
                return RESISTANCE_LOOKUP["road_motorway"]
            elif val_str.startswith("A") or "PRIM" in val_str:
                return RESISTANCE_LOOKUP["road_a"]
            elif val_str.startswith("B") or "SEC" in val_str:
                return RESISTANCE_LOOKUP["road_b"]
            else:
                return RESISTANCE_LOOKUP["road_minor"]

        # Burn each road class separately (higher resistance overwrites lower)
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
        # Uniform road resistance
        rj = gpd.sjoin(grid_points, road_buf[["geometry"]], predicate="within", how="inner")
        if len(rj) > 0:
            idx = rj["grid_id"].values
            resistance.ravel()[idx] = RESISTANCE_LOOKUP["road_a"]
            print(f"    Roads (uniform resistance={RESISTANCE_LOOKUP['road_a']}): {len(idx)} cells")
        del rj

# Mask outside Cotswolds boundary
print("  Masking outside Cotswolds boundary...")
boundary_join = gpd.sjoin(grid_points, cotswolds[["geometry"]], predicate="within", how="inner")
inside_ids = set(boundary_join["grid_id"].values)
outside_mask = np.ones(nrows * ncols, dtype=bool)
outside_mask[list(inside_ids)] = False
resistance.ravel()[outside_mask] = np.nan
del boundary_join, grid_points

# Save resistance raster
resistance_path = rf"{OUT_DIR}\09_combined_resistance.tif"
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
print(f"  Saved resistance raster: {resistance_path}")

# ============================================================
# STEP 7: Identify Core Patches
# ============================================================
print("\n=== STEP 7: Identify Ancient Woodland Core Patches ===")
cores = aw_clip[aw_clip["aw_area_ha"] >= CORE_MIN_AREA_HA].copy().reset_index(drop=True)
cores["core_id"] = range(1, len(cores) + 1)
cores["centroid_x"] = cores.geometry.centroid.x
cores["centroid_y"] = cores.geometry.centroid.y
cores.to_file(OUT_GPKG, layer="10_core_patches", driver="GPKG")
print(f"  Core patches (>= {CORE_MIN_AREA_HA} ha): {len(cores)}")
print(f"  Total core area: {cores.geometry.area.sum()/1e6:.1f} km²")

if len(cores) < 2:
    print("  WARNING: Fewer than 2 core patches — cannot build network. Exiting.")
    exit(1)

# ============================================================
# STEP 8: Build Sparse Graph & Calculate Least-Cost Distances
# ============================================================
print("\n=== STEP 8: Least-Cost Distance Calculation ===")

# Replace NaN with very high resistance for pathfinding (impassable)
resistance_filled = np.where(np.isnan(resistance), 9999.0, resistance).astype(np.float32)
del resistance

# Build sparse adjacency matrix for 4-neighbour grid graph
print("  Building grid graph (4-neighbour)...")
t0 = time.time()

flat_res = resistance_filled.ravel()
n_total = nrows * ncols

# Right neighbours: (i, j) -> (i, j+1)
src_right = np.arange(n_total).reshape(nrows, ncols)[:, :-1].ravel()
dst_right = np.arange(n_total).reshape(nrows, ncols)[:, 1:].ravel()
# Cost = average of the two cells
cost_right = (flat_res[src_right] + flat_res[dst_right]) / 2.0 * CELL_SIZE

# Down neighbours: (i, j) -> (i+1, j)
src_down = np.arange(n_total).reshape(nrows, ncols)[:-1, :].ravel()
dst_down = np.arange(n_total).reshape(nrows, ncols)[1:, :].ravel()
cost_down = (flat_res[src_down] + flat_res[dst_down]) / 2.0 * CELL_SIZE

# Combine (undirected: add both directions)
src = np.concatenate([src_right, dst_right, src_down, dst_down])
dst = np.concatenate([dst_right, src_right, dst_down, src_down])
w = np.concatenate([cost_right, cost_right, cost_down, cost_down])

# Filter out very high cost edges (impassable)
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

# Run Dijkstra one source at a time to avoid memory explosion
# Only keep distances to other core nodes
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
print(f"  Candidate connections: {len(pairs_df)} (within {CONNECTIVITY_THRESHOLD_M}m Euclidean, cost < {COST_THRESHOLD})")

if len(pairs_df) > 0:
    pairs_df.to_csv(rf"{OUT_DIR}\least_cost_pairs.csv", index=False)

# ============================================================
# STEP 9: Build Connectivity Network
# ============================================================
print("\n=== STEP 9: Build Connectivity Network ===")
G = nx.Graph()

# Add nodes
for _, row in cores.iterrows():
    G.add_node(
        row["core_id"],
        area_ha=row["aw_area_ha"],
        x=row["centroid_x"],
        y=row["centroid_y"],
    )

# Add edges
for _, p in pairs_df.iterrows():
    G.add_edge(
        p["source"],
        p["target"],
        euclidean_m=p["euclidean_m"],
        cost_distance=p["cost_distance"],
        resistance_ratio=p["resistance_ratio"],
        weight=p["cost_distance"],
    )

print(f"  Network: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
print(f"  Connected components: {nx.number_connected_components(G)}")

# ============================================================
# STEP 10: Network Analysis — Centrality Metrics
# ============================================================
print("\n=== STEP 10: Network Centrality Analysis ===")

degree_cent = nx.degree_centrality(G)
betweenness_cent = nx.betweenness_centrality(G, weight="weight")
closeness_cent = nx.closeness_centrality(G, distance="weight")

# Connected components
components = list(nx.connected_components(G))
component_sizes = {n: len(c) for n, c in enumerate(components)}
node_component = {}
for comp_id, comp in enumerate(components):
    for node in comp:
        node_component[node] = comp_id

# Build centrality GeoDataFrame
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

# Normalise betweenness for mapping
if cent_df["betweenness_centrality"].max() > 0:
    cent_gdf["betweenness_norm"] = cent_df["betweenness_centrality"] / cent_df["betweenness_centrality"].max()
else:
    cent_gdf["betweenness_norm"] = 0

cent_gdf.to_file(OUT_GPKG, layer="15_centrality", driver="GPKG")
print(f"  Saved: 15_centrality ({len(cent_gdf)} nodes)")

# Print top 5 critical nodes
top_nodes = cent_df.nlargest(5, "betweenness_centrality")[
    ["core_id", "area_ha", "degree_centrality", "betweenness_centrality", "component_size"]
]
print("\n  Top 5 critical nodes (by betweenness):")
print(top_nodes.to_string(index=False))

# ============================================================
# STEP 11: Build Edge GeoDataFrame (Corridors)
# ============================================================
print("\n=== STEP 11: Build Corridor Lines ===")
edge_records = []
for u, v, data in G.edges(data=True):
    u_row = cores[cores["core_id"] == u].iloc[0]
    v_row = cores[cores["core_id"] == v].iloc[0]
    line = LineString([
        (u_row["centroid_x"], u_row["centroid_y"]),
        (v_row["centroid_x"], v_row["centroid_y"]),
    ])
    edge_records.append({
        "source": u,
        "target": v,
        "euclidean_m": data["euclidean_m"],
        "cost_distance": data["cost_distance"],
        "resistance_ratio": data["resistance_ratio"],
        "geometry": line,
    })

if edge_records:
    edges_gdf = gpd.GeoDataFrame(edge_records, crs=f"EPSG:{EPSG}")
    edges_gdf.to_file(OUT_GPKG, layer="14_connectivity_network", driver="GPKG")
    print(f"  Saved: 14_connectivity_network ({len(edges_gdf)} edges)")
else:
    print("  No edges to save")

# ============================================================
# STEP 12: Identify Pinch Points & Restoration Opportunities
# ============================================================
print("\n=== STEP 12: Pinch Points & Restoration Opportunities ===")

# Pinch points: high betweenness nodes that connect otherwise separated parts
# Restoration opportunities: pairs of cores that are close Euclidean but high cost
restoration_records = []
for _, p in pairs_df.iterrows():
    if p["resistance_ratio"] > 2.0:  # cost distance is >2x Euclidean → high intervening resistance
        src_core = cores[cores["core_id"] == p["source"]].iloc[0]
        tgt_core = cores[cores["core_id"] == p["target"]].iloc[0]
        midpoint = Point(
            (src_core["centroid_x"] + tgt_core["centroid_x"]) / 2,
            (src_core["centroid_y"] + tgt_core["centroid_y"]) / 2,
        )
        restoration_records.append({
            "source": p["source"],
            "target": p["target"],
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
    print(f"  Saved: 17_restoration_opportunities ({len(rest_gdf)} candidate sites)")
    print(f"  Top 3 restoration priorities:")
    print(rest_gdf.head(3)[["source", "target", "euclidean_m", "cost_distance", "resistance_ratio"]].to_string(index=False))
else:
    print("  No high-resistance gaps identified")

# ============================================================
# STEP 13: Node Removal Analysis (Critical Patch Assessment)
# ============================================================
print("\n=== STEP 13: Node Removal Analysis ===")
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
    fragmentation_impact = original_largest - new_largest
    removal_records.append({
        "core_id": node,
        "degree": G.degree(node),
        "fragmentation_impact": fragmentation_impact,
        "components_before": original_components,
        "components_after": new_components,
    })

removal_df = pd.DataFrame(removal_records).sort_values("fragmentation_impact", ascending=False)
removal_df.to_csv(rf"{OUT_DIR}\node_removal_analysis.csv", index=False)
print(f"  Saved: node_removal_analysis.csv ({len(removal_df)} nodes analysed)")
print(f"  Most critical node removal: core_id={removal_df.iloc[0]['core_id']}, impact={removal_df.iloc[0]['fragmentation_impact']}")

# ============================================================
# STEP 14: Summary Statistics
# ============================================================
print("\n=== STEP 14: Summary ===")
summary = {
    "study_area": "Cotswolds National Landscape",
    "focal_scenario": "Woodland-associated mammals",
    "modelling_resolution_m": CELL_SIZE,
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
    "resistance_values_documented": len(RESISTANCE_LOOKUP),
}

summary_df = pd.DataFrame([summary])
summary_df.to_csv(rf"{OUT_DIR}\model_summary.csv", index=False)

print(f"\n{'='*60}")
print("COTSWOLDS PERMEABILITY MODEL — COMPLETE")
print(f"{'='*60}")
for k, v in summary.items():
    print(f"  {k}: {v}")
print(f"\n  Output GPKG: {OUT_GPKG}")
print(f"  Output dir:  {OUT_DIR}")
print(f"  Layers saved:")
print(f"    01_study_area")
print(f"    02_ancient_woodland")
print(f"    03_hab_* (habitat networks)")
print(f"    04_phi_habitats")
print(f"    05_roads")
print(f"    09_combined_resistance.tif")
print(f"    10_core_patches")
print(f"    14_connectivity_network")
print(f"    15_centrality")
print(f"    17_restoration_opportunities")
print(f"    resistance_lookup.csv")
print(f"    least_cost_pairs.csv")
print(f"    node_removal_analysis.csv")
print(f"    model_summary.csv")
