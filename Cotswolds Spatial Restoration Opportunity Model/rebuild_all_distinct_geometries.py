import os, sys, glob, zipfile, math, urllib.request, time
import numpy as np
import geopandas as gpd
import pandas as pd
from shapely.geometry import shape, MultiPolygon, Polygon
from shapely.ops import unary_union
import rasterio
from rasterio.transform import from_origin
from pyogrio import read_dataframe

LOG = open(os.path.join(r"D:\새 폴더\Cotswolds_Restoration_Suitability", "rebuild_log.txt"), "w", encoding="utf-8")
def log(msg):
    print(msg)
    LOG.write(msg + "\n")
    LOG.flush()

log("=================================================================")
log("  REBUILDING FROM SCRATCH: TRUE GEOMETRY EXTRACTION PIPELINE")
log("=================================================================")

BASE_DIR = r"D:\새 폴더"
NAT_PARKS_GPKG = os.path.join(BASE_DIR, "National_Parks_England_fixed.gpkg")
PHI_GPKG = os.path.join(BASE_DIR, "PHI_full.gpkg")

TWI_TIF = r"C:\Users\User\Downloads\data\twi.tif"
MRVBF_TIF = r"C:\Users\User\Downloads\data\mrvbf.tif"
DRAIN_TIF = r"C:\Users\User\Downloads\data\subsurface_drainage.tif"

src_twi = rasterio.open(TWI_TIF)
src_mrvbf = rasterio.open(MRVBF_TIF)
src_drain = rasterio.open(DRAIN_TIF)

def sample_raster_mean(geom, src):
    minx, miny, maxx, maxy = geom.bounds
    px_min, py_min = src.index(minx, maxy)
    px_max, py_max = src.index(maxx, miny)
    px_min = max(0, min(px_min, src.width - 1))
    px_max = max(0, min(px_max, src.width - 1))
    py_min = max(0, min(py_min, src.height - 1))
    py_max = max(0, min(py_max, src.height - 1))
    win_w = max(1, px_max - px_min + 1)
    win_h = max(1, py_max - py_min + 1)
    window = rasterio.windows.Window(px_min, py_min, win_w, win_h)
    arr = src.read(1, window=window)
    if arr is not None and arr.size > 0:
        valid = arr[arr > -9999]
        if valid.size > 0:
            return float(np.mean(valid))
    return 0.0

ROAD_EXTRACT_DIR = os.path.join(BASE_DIR, "oproad_extracted", "data")
def load_roads(minx, miny, maxx, maxy, tile_prefix):
    shp_files = glob.glob(os.path.join(ROAD_EXTRACT_DIR, f"{tile_prefix}*_RoadLink.shp"))
    if not shp_files:
        shp_files = glob.glob(os.path.join(ROAD_EXTRACT_DIR, "*_RoadLink.shp"))
    if not shp_files:
        return None
    bbox = (minx, miny, maxx, maxy)
    dfs = []
    for s in shp_files:
        try:
            r = read_dataframe(s, bbox=bbox)
            if r is not None and len(r) > 0:
                dfs.append(r)
        except Exception:
            pass
    if dfs:
        roads = pd.concat(dfs, ignore_index=True)
        road_buf = gpd.GeoSeries(roads.geometry).buffer(10).union_all()
        return road_buf.simplify(5)
    return None

# =========================================================================
# 1. BUILD PROJECT 1: RESTORATION SUITABILITY (Raster-Constrained Geometry)
# =========================================================================
P1_DIR = os.path.join(BASE_DIR, "Project1_Restoration_Suitability_Model")
os.makedirs(P1_DIR, exist_ok=True)
P1_GPKG = os.path.join(P1_DIR, "restoration_suitability_national_parks.gpkg")

P1_PARKS = [
    ("NEW FOREST", "Wood_Pasture_and_Parkland", "opp_new_forest", "SU", 0.10),
    ("EXMOOR", "Coastal_Habitats_Grouped", "opp_exmoor", "SS", 0.05),
    ("DARTMOOR", "Purple_Moor_Grass_and_Rush_Pasture", "opp_dartmoor", "SX", 0.08),
    ("PEAK DISTRICT", "Blanket_Bog", "opp_peak_district", "SK", 0.10),
    ("NORTH YORK MOORS", "Upland_Heathland", "opp_north_york_moors", "SE", 0.10),
    ("LAKE DISTRICT", "Upland_Calcareous_Grassland", "opp_lake_district", "NY", 0.10),
    ("THE BROADS", "Reedbeds", "opp_the_broads", "TG", 0.05),
    ("SOUTH DOWNS", "Traditional_Orchards", "opp_south_downs", "SU", 0.10),
    ("NORTHUMBERLAND", "Upland_Fens_Flushes_and_Swamps", "opp_northumberland", "NY", 0.08),
    ("YORKSHIRE DALES", "Limestone_Pavement", "opp_yorkshire_dales", "SD", 0.10)
]

log("\n--- Running Project 1: Environmental Filtering Pipeline ---")
np_gdf = gpd.read_file(NAT_PARKS_GPKG)

for park_name, hab_layer, out_layer, tile_prefix, min_ha in P1_PARKS:
    from pyogrio import list_layers
    if os.path.exists(P1_GPKG):
        existing = [l[0] for l in list_layers(P1_GPKG)]
        if out_layer in existing:
            log(f"\n[Project 1] SKIP {park_name} (already saved)")
            continue
    t0 = time.time()
    log(f"\n[Project 1] Generating Raw Geometries for: {park_name}")
    park_geom = np_gdf[np_gdf["name"].str.upper().str.contains(park_name, na=False)]
    if park_geom.empty:
        park_geom = np_gdf[np_gdf["name"].str.upper().str.contains(park_name.split()[0], na=False)]
    
    park_poly = park_geom.geometry.union_all()
    minx, miny, maxx, maxy = park_poly.bounds
    bbox = (minx, miny, maxx, maxy)
    
    # 1. Load PHI & clip to park
    phi = read_dataframe(PHI_GPKG, bbox=bbox)
    phi = gpd.GeoDataFrame(phi, geometry='geometry', crs='EPSG:27700')
    phi = phi[phi.geometry.intersects(park_poly)].copy()
    phi["geometry"] = phi.geometry.make_valid()
    phi["geometry"] = phi.geometry.intersection(park_poly)
    phi = phi[~phi.geometry.is_empty]
    log(f"  -> PHI loaded: {len(phi)} patches in {time.time()-t0:.1f}s")
    
    # 2. Road barrier excision (spatial index: only difference intersecting patches)
    t1 = time.time()
    road_buf = load_roads(minx, miny, maxx, maxy, tile_prefix)
    if road_buf and not road_buf.is_empty:
        hits = phi.sindex.query(road_buf, predicate='intersects')
        if len(hits) > 0:
            idx = phi.index[hits]
            phi.loc[idx, "geometry"] = phi.loc[idx, "geometry"].difference(road_buf)
            phi = phi[~phi.geometry.is_empty]
        log(f"  -> After road excision: {len(phi)} patches in {time.time()-t1:.1f}s")
    
    # 3. Explode multipolygons
    phi = phi.explode(index_parts=False).reset_index(drop=True)
    phi["area_ha"] = phi.geometry.area / 10000.0
    phi = phi[phi["area_ha"] >= min_ha].copy()
    log(f"  -> After explode+area filter: {len(phi)} patches")
    
    # 4. Raster Zonal Sampling (TWI & Drainage)
    twi_vals, drain_vals = [], []
    for geom in phi.geometry:
        twi_vals.append(sample_raster_mean(geom, src_twi))
        drain_vals.append(sample_raster_mean(geom, src_drain))
    phi["twi_val"] = twi_vals
    phi["drain_val"] = drain_vals
    
    # 5. Scientific Filtering Rule
    if "bog" in hab_layer.lower() or "reed" in hab_layer.lower() or "swamp" in hab_layer.lower():
        phi_filtered = phi[phi["twi_val"] >= 6.0].copy()
    else:
        phi_filtered = phi[phi["twi_val"] <= 14.0].copy()
    
    if len(phi_filtered) == 0:
        log(f"  -> WARNING: No patches after TWI filter, using all")
        phi_filtered = phi.copy()
        
    # Score
    t_min, t_max = phi_filtered["twi_val"].min(), phi_filtered["twi_val"].max()
    norm_twi = (phi_filtered["twi_val"] - t_min) / (t_max - t_min) if t_max > t_min else 0.5
    norm_area = phi_filtered["area_ha"] / phi_filtered["area_ha"].max()
    
    phi_filtered["composite_score"] = (norm_twi * 0.40) + (norm_area * 0.60)
    phi_filtered.to_file(P1_GPKG, layer=out_layer, driver="GPKG")
    log(f"  -> Saved {len(phi_filtered)} patches (Layer: {out_layer}) in {time.time()-t0:.1f}s total")

# =========================================================================
# 2. BUILD PROJECT 2: PEATLAND HYDROLOGICAL RESTORATION (Pure Peat Geometries)
# =========================================================================
P2_DIR = os.path.join(BASE_DIR, "Project2_Peatland_Restoration_GIS")
os.makedirs(P2_DIR, exist_ok=True)
P2_GPKG = os.path.join(P2_DIR, "peatland_wetland_restoration.gpkg")

PEAT_CONFIG = [
    ("PEAK DISTRICT", "Blanket_Bog", "peat_opp_peak_district", "SK"),
    ("DARTMOOR", "Purple_Moor_Grass_and_Rush_Pasture", "peat_opp_dartmoor", "SX"),
    ("THE BROADS", "Reedbeds", "peat_opp_the_broads", "TG"),
    ("NORTHUMBERLAND", "Upland_Fens_Flushes_and_Swamps", "peat_opp_northumberland", "NY"),
    ("NORTH YORK MOORS", "Upland_Heathland", "peat_opp_north_york_moors", "SE")
]

log("\n--- Running Project 2: Pure Peatland & Wetland Hydrological Geometry Extraction ---")

for park_name, hab_target, out_layer, tile_prefix in PEAT_CONFIG:
    from pyogrio import list_layers
    if os.path.exists(P2_GPKG):
        existing = [l[0] for l in list_layers(P2_GPKG)]
        if out_layer in existing:
            log(f"\n[Project 2] SKIP {park_name} (already saved)")
            continue
    t0 = time.time()
    log(f"\n[Project 2] Generating Pure Peatland Geometries for: {park_name}")
    park_geom = np_gdf[np_gdf["name"].str.upper().str.contains(park_name, na=False)]
    if park_geom.empty:
        park_geom = np_gdf[np_gdf["name"].str.upper().str.contains(park_name.split()[0], na=False)]
    park_poly = park_geom.geometry.union_all()
    minx, miny, maxx, maxy = park_poly.bounds
    bbox = (minx, miny, maxx, maxy)
    
    # 1. Load PHI filtered STRICTLY by Peatland/Wetland classification keywords
    phi = read_dataframe(PHI_GPKG, bbox=bbox)
    phi = gpd.GeoDataFrame(phi, geometry='geometry', crs='EPSG:27700')
    phi = phi[phi.geometry.intersects(park_poly)].copy()
    log(f"  -> PHI loaded: {len(phi)} patches in {time.time()-t0:.1f}s")
    
    # Filter only genuine peatland/mire/fen/bog/rush priority habitats
    peat_keywords = "bog|mire|fen|swamp|peat|reed|flush|moor|heath|wet"
    phi_peat = phi[phi["mainhabs"].str.contains(peat_keywords, case=False, na=False) |
                   phi["addhabs"].str.contains(peat_keywords, case=False, na=False)].copy()
    log(f"  -> After peat keyword filter: {len(phi_peat)} patches")
    
    if phi_peat.empty:
        phi_peat = phi.copy()
        log(f"  -> WARNING: No peat keywords found, using all PHI")
        
    phi_peat["geometry"] = phi_peat.geometry.make_valid()
    phi_peat["geometry"] = phi_peat.geometry.intersection(park_poly)
    phi_peat = phi_peat[~phi_peat.geometry.is_empty]
    
    # 2. Road barrier subtraction (spatial index: only difference intersecting patches)
    t1 = time.time()
    road_buf = load_roads(minx, miny, maxx, maxy, tile_prefix)
    if road_buf and not road_buf.is_empty:
        hits = phi_peat.sindex.query(road_buf, predicate='intersects')
        if len(hits) > 0:
            idx = phi_peat.index[hits]
            phi_peat.loc[idx, "geometry"] = phi_peat.loc[idx, "geometry"].difference(road_buf)
            phi_peat = phi_peat[~phi_peat.geometry.is_empty]
        log(f"  -> After road excision: {len(phi_peat)} patches in {time.time()-t1:.1f}s")
    
    phi_peat = phi_peat.explode(index_parts=False).reset_index(drop=True)
    phi_peat["area_ha"] = phi_peat.geometry.area / 10000.0
    phi_peat = phi_peat[phi_peat["area_ha"] >= 0.2].copy()
    log(f"  -> After explode+area filter: {len(phi_peat)} patches")
    
    # 3. Sample MRVBF & TWI
    mrvbf_vals, twi_vals = [], []
    for geom in phi_peat.geometry:
        mrvbf_vals.append(sample_raster_mean(geom, src_mrvbf))
        twi_vals.append(sample_raster_mean(geom, src_twi))
    phi_peat["mrvbf_val"] = mrvbf_vals
    phi_peat["twi_val"] = twi_vals
    
    # Score
    norm_twi = phi_peat["twi_val"] / phi_peat["twi_val"].max()
    norm_mrvbf = phi_peat["mrvbf_val"] / (phi_peat["mrvbf_val"].max() if phi_peat["mrvbf_val"].max() > 0 else 1.0)
    norm_area = phi_peat["area_ha"] / phi_peat["area_ha"].max()
    
    phi_peat["peat_restoration_score"] = (norm_twi * 0.40) + (norm_mrvbf * 0.30) + (norm_area * 0.30)
    phi_peat.to_file(P2_GPKG, layer=out_layer, driver="GPKG")
    log(f"  -> Saved {len(phi_peat)} patches (Layer: {out_layer}) in {time.time()-t0:.1f}s total")

log("\n=================================================================")
log("  TRUE DISTINCT GEOMETRIES CREATED ACROSS BOTH PROJECTS!")
log("=================================================================")
LOG.close()