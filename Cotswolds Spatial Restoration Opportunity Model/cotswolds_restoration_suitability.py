r"""
Cotswolds Spatial Restoration Opportunity Model
================================================
Identifies and prioritises areas for native broadleaved woodland
expansion using a raster-based Multi-Criteria Suitability Analysis.

Three policy scenarios:
  A — Connectivity-first:  prioritises joining existing habitat networks
  B — Biodiversity-first:   prioritises proximity to high-value habitat
  C — Carbon-first:         prioritises physical/environmental suitability

Integrates with the Cotswolds Permeability Model v2 results (pinch points,
corridors, centrality) to quantify before/after connectivity improvement
for each candidate restoration parcel.

Data sources:
  - UKCEH LCM2023 (10m raster) → land cover suitability & constraints
  - Topographic Wetness Index (50m) → soil wetness suitability
  - Subsurface drainage (50m) → soil drainage suitability
  - Geomorphons (50m) → landform classification
  - Natural capital pedotopes (50m) → soil type suitability
  - Ancient Woodland Inventory (vector) → proximity scoring
  - Priority Habitat Inventory (vector) → constraint (don't convert)
  - OS Open Roads (vector) → barrier constraint
  - Cotswolds Permeability v2 GPKG → connectivity input

Outputs:
  - GeoPackage with all vector layers
  - 3 GeoTIFF suitability rasters (one per scenario)
  - Constraint mask GeoTIFF
  - CSV summary of top restoration parcels
"""

import os, time, warnings
import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, box
from shapely.ops import unary_union
from osgeo import gdal, osr
from scipy.ndimage import distance_transform_edt

warnings.filterwarnings("ignore")
gdal.UseExceptions()

# ============================================================
# CONFIG
# ============================================================
BASE = r"D:\새 폴더"
OUT_DIR = os.path.join(BASE, "Cotswolds_Restoration_Suitability")
os.makedirs(OUT_DIR, exist_ok=True)
OUT_GPKG = os.path.join(OUT_DIR, "cotswolds_restoration_suitability.gpkg")

# Source data paths
AONB_PATH = os.path.join(BASE, r"Areas_of_Outstanding_Natural_Beauty_England.gpkg\Areas_of_Outstanding_Natural_Beauty_England.gpkg")
AW_PATH = os.path.join(BASE, r"Ancient_Woodland_England.gpkg (1)\Ancient_Woodland_England.gpkg")
PHI_PATH = os.path.join(BASE, "PHI_full.gpkg")
ROAD_ZIP = os.path.join(BASE, "oproad_essh_gb.zip")
ROAD_EXTRACT = os.path.join(BASE, "oproad_extracted")
LCM_PATH = os.path.join(BASE, r"FME_346C3835_1788723753818_27021\data\LCM.tif")
PERM_V2_GPKG = os.path.join(BASE, "cotswolds_permeability_v2_results.gpkg")

# Raster data paths (50m UK-wide)
TWI_TIF = r"C:\Users\User\Downloads\data\twi.tif"
DRAINAGE_TIF = r"C:\Users\User\Downloads\data\subsurface_drainage.tif"
GEOMORPHONS_TIF = r"C:\Users\User\Downloads\data\geomorphons.tif"
PEDOTOPES_TIF = r"C:\Users\User\Downloads\data\natural_capital_pedotopes.tif"

EPSG = 27700
CELL_SIZE = 50  # modelling resolution (metres)

# LCM2023 class → woodland establishment suitability (0-1)
# 1 = excellent for broadleaved woodland, 0 = impossible
LCM_SUITABILITY = {
    0: 0.0,    # NoData / water
    1: 0.9,    # Broadleaved woodland — already woodland, high suitability for expansion
    2: 0.7,    # Coniferous woodland — could be converted to broadleaved
    3: 0.5,    # Cropland / arable — moderate (agroforestry / natural regeneration)
    4: 0.6,    # Improved grassland — moderate-high (less intensive, easier to convert)
    6: 0.7,    # Neutral grassland — high (low intervention, good for woodland)
    7: 0.65,   # Calcareous grassland — moderate-high (but may be high-value habitat)
    9: 0.3,    # Bog — low (carbon habitat, shouldn't convert)
    10: 0.5,   # Heather — moderate
    12: 0.5,   # Heather grass — moderate
    14: 0.0,   # Saltwater — impossible
    20: 0.0,   # Urban — impossible
    21: 0.15,  # Suburban — very low
}

# Classes that are absolute constraints (no restoration allowed)
CONSTRAINT_CLASSES = {0, 14, 20}  # NoData, Saltwater, Urban

# Geomorphons classes → woodland suitability (0-1)
# 1=Flat, 2=Summit, 3=Ridge, 4=Shoulder, 5=Spur, 6=Slope,
# 7=Hollow, 8=Footslope, 9=Valley, 10=Depression, 0=Unknown
GEOMORPHON_SUITABILITY = {
    0: 0.5,   # Unknown
    1: 0.7,   # Flat — good for woodland
    2: 0.3,   # Summit — exposed, poor
    3: 0.35,  # Ridge — exposed
    4: 0.5,   # Shoulder — moderate
    5: 0.6,   # Spur — moderate-good
    6: 0.65,  # Slope — good (sheltered)
    7: 0.75,  # Hollow — very good (sheltered, moisture)
    8: 0.8,   # Footslope — excellent (moisture + shelter)
    9: 0.7,   # Valley — good (moisture)
    10: 0.6,  # Depression — moderate (waterlogging risk)
}

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def load_and_clip_raster(src_path, dst_path, bounds, cell_size=CELL_SIZE):
    """Clip and resample a raster to the study area bounds at given cell size."""
    minx, miny, maxx, maxy = bounds
    xsize = int(np.ceil((maxx - minx) / cell_size))
    ysize = int(np.ceil((maxy - miny) / cell_size))
    
    gdal.Warp(
        dst_path, src_path,
        dstSRS=f"EPSG:{EPSG}",
        outputBounds=[minx, miny, maxx, maxy],
        xRes=cell_size, yRes=cell_size,
        resampleAlg=gdal.GRA_NearestNeighbour,
        targetAlignedPixels=True,
        creationOptions=["COMPRESS=LZW", "TILED=YES"],
    )
    ds = gdal.Open(dst_path)
    arr = ds.GetRasterBand(1).ReadAsArray()
    gt = ds.GetGeoTransform()
    return arr, gt, ds


def rasterize_vector(gdf, gt, shape, attr_value=1, all_touched=True):
    """Rasterize a vector layer onto a numpy array matching gt/shape."""
    mem_drv = gdal.GetDriverByName("MEM")
    ds = mem_drv.Create("", shape[1], shape[0], 1, gdal.GDT_Float32)
    ds.SetGeoTransform(gt)
    ds.SetProjection(f"EPSG:{EPSG}")
    
    lyr = ds.CreateLayer("temp", srs=osr.SpatialReference())
    lyr.CreateField(gdal.ogr.FieldDefn("val", gdal.ogr.OFTReal))
    
    for _, row in gdf.iterrows():
        feat = gdal.ogr.Feature(lyr.GetLayerDefn())
        feat.SetField("val", float(attr_value))
        geom = gdal.ogr.CreateGeometryFromWkb(row.geometry.wkb)
        feat.SetGeometry(geom)
        lyr.CreateFeature(feat)
    
    gdal.RasterizeLayer(ds, [1], lyr, options=["ALL_TOUCHED=true" if all_touched else "ALL_TOUCHED=false", "ATTRIBUTE=val"])
    return ds.GetRasterBand(1).ReadAsArray()


def proximity_raster(gdf, gt, shape, max_distance_m=5000):
    """Compute Euclidean distance (metres) from each cell to nearest vector feature."""
    # Rasterize presence (1 = feature, 0 = empty)
    presence = rasterize_vector(gdf, gt, shape, attr_value=1)
    
    # Distance transform: distance from non-feature cells to nearest feature
    # presence==1 are features; we want distance from 0-cells to nearest 1-cell
    if presence.sum() == 0:
        return np.full(shape, max_distance_m, dtype=np.float32)
    
    dist_pixels = distance_transform_edt(presence == 0)
    dist_metres = dist_pixels * gt[1]  # cell size in metres
    dist_metres = np.clip(dist_metres, 0, max_distance_m)
    return dist_metres.astype(np.float32)


def normalize(arr, invert=False):
    """Min-max normalize to 0-1. If invert, subtract from 1 (closer = higher score)."""
    valid = arr[np.isfinite(arr)]
    if valid.size == 0:
        return np.zeros_like(arr, dtype=np.float32)
    vmin, vmax = valid.min(), valid.max()
    if vmax - vmin < 1e-10:
        return np.full_like(arr, 0.5, dtype=np.float32)
    norm = (arr - vmin) / (vmax - vmin)
    if invert:
        norm = 1.0 - norm
    return norm.astype(np.float32)


def save_raster(arr, path, gt, nodata=-9999):
    """Save numpy array as GeoTIFF."""
    drv = gdal.GetDriverByName("GTiff")
    ds = drv.Create(path, arr.shape[1], arr.shape[0], 1, gdal.GDT_Float32,
                    options=["COMPRESS=LZW", "TILED=YES"])
    ds.SetGeoTransform(gt)
    ds.SetProjection(f"EPSG:{EPSG}")
    band = ds.GetRasterBand(1)
    band.SetNoDataValue(nodata)
    band.WriteArray(arr.astype(np.float32))
    band.FlushCache()
    ds = None


def array_to_points(arr, gt, threshold=0.5, min_cluster_pixels=4):
    """Convert raster cells above threshold to vector points with attributes."""
    rows, cols = np.where(arr >= threshold)
    if len(rows) == 0:
        return gpd.GeoDataFrame(columns=["suitability", "geometry"], crs=f"EPSG:{EPSG}")
    
    x = gt[0] + (cols + 0.5) * gt[1]
    y = gt[3] + (rows + 0.5) * gt[5]
    vals = arr[rows, cols]
    
    geoms = [Point(xi, yi) for xi, yi in zip(x, y)]
    gdf = gpd.GeoDataFrame({"suitability": vals, "geometry": geoms}, crs=f"EPSG:{EPSG}")
    
    # Filter small clusters: keep only cells with enough neighbours
    if min_cluster_pixels > 1:
        from scipy.ndimage import label
        binary = arr >= threshold
        labeled, n = label(binary)
        sizes = np.bincount(labeled.ravel())
        keep_labels = set(np.where(sizes >= min_cluster_pixels)[0])
        # Map each point to its label
        point_labels = labeled[rows, cols]
        keep_mask = np.array([pl in keep_labels for pl in point_labels])
        gdf = gdf[keep_mask].reset_index(drop=True)
    
    return gdf


# ============================================================
# STEP 1: Study Area
# ============================================================
print("\n=== STEP 1: Cotswolds Boundary ===")
aonb = gpd.read_file(AONB_PATH).to_crs(f"EPSG:{EPSG}")
cotswolds = aonb[aonb["name"].apply(lambda x: "Cotswolds" in str(x) if x else False)].copy()
cotswolds_geom = unary_union(cotswolds.geometry)
minx, miny, maxx, maxy = cotswolds_geom.bounds
# Add 2km buffer for edge effects
buf = 2000
minx -= buf; miny -= buf; maxx += buf; maxy += buf
bounds = (minx, miny, maxx, maxy)
print(f"  Area: {cotswolds_geom.area/1e6:.0f} km²")
print(f"  BBox (with 2km buffer): ({minx:.0f}, {miny:.0f}, {maxx:.0f}, {maxy:.0f})")

# Grid dimensions
nx = int(np.ceil((maxx - minx) / CELL_SIZE))
ny = int(np.ceil((maxy - miny) / CELL_SIZE))
gt_out = (minx, CELL_SIZE, 0, maxy, 0, -CELL_SIZE)
shape = (ny, nx)
print(f"  Grid: {nx} x {ny} cells at {CELL_SIZE}m")

# Save study area
cotswolds.to_file(OUT_GPKG, layer="01_study_area", driver="GPKG")

# Rasterize AONB mask
aonb_mask = rasterize_vector(cotswolds, gt_out, shape, attr_value=1).astype(bool)
print(f"  AONB cells: {aonb_mask.sum()}")

# ============================================================
# STEP 2: Land Cover Suitability & Constraints
# ============================================================
print("\n=== STEP 2: Land Cover (LCM2023) ===")
lcm_clip_path = os.path.join(OUT_DIR, "_tmp_lcm_clip.tif")
lcm_arr, lcm_gt, lcm_ds = load_and_clip_raster(LCM_PATH, lcm_clip_path, bounds, CELL_SIZE)

# Map LCM classes to suitability
lcm_suit = np.full(shape, 0.5, dtype=np.float32)
for cls, val in LCM_SUITABILITY.items():
    lcm_suit[lcm_arr == cls] = val

# Constraint mask: urban, water, NoData
constraint = np.zeros(shape, dtype=np.float32)
for cls in CONSTRAINT_CLASSES:
    constraint[lcm_arr == cls] = 1.0

print(f"  LCM classes present: {np.unique(lcm_arr)}")
print(f"  Constraint cells: {constraint.sum():.0f}")

# ============================================================
# STEP 3: Environmental Rasters
# ============================================================
print("\n=== STEP 3: Environmental Layers ===")

# TWI — moderate TWI is best for woodland (not too dry, not waterlogged)
print("  Loading TWI...")
twi_clip_path = os.path.join(OUT_DIR, "_tmp_twi_clip.tif")
twi_arr, twi_gt, _ = load_and_clip_raster(TWI_TIF, twi_clip_path, bounds, CELL_SIZE)
# Ideal TWI for broadleaved woodland: ~8-15; too low = dry, too high = waterlogged
twi_arr_masked = np.where(twi_arr <= -9998, np.nan, twi_arr).astype(np.float32)
twi_suit = np.exp(-0.5 * ((twi_arr_masked - 11.0) / 4.0) ** 2)
twi_suit = np.nan_to_num(twi_suit, nan=0.5)
twi_suit = np.clip(twi_suit, 0, 1).astype(np.float32)
print(f"  TWI range: {np.nanmin(twi_arr_masked):.1f} - {np.nanmax(twi_arr_masked):.1f}")

# Subsurface drainage — well-drained soils are better for woodland
print("  Loading subsurface drainage...")
drain_clip_path = os.path.join(OUT_DIR, "_tmp_drain_clip.tif")
drain_arr, drain_gt, _ = load_and_clip_raster(DRAINAGE_TIF, drain_clip_path, bounds, CELL_SIZE)
# Higher drainage value = better drained = more suitable for woodland
drain_arr_masked = np.where(drain_arr <= 0, np.nan, drain_arr).astype(np.float32)
drain_suit = normalize(drain_arr_masked)
drain_suit = np.nan_to_num(drain_suit, nan=0.5)
print(f"  Drainage range: {np.nanmin(drain_arr):.1f} - {np.nanmax(drain_arr):.1f}")

# Geomorphons — landform suitability
print("  Loading geomorphons...")
geom_clip_path = os.path.join(OUT_DIR, "_tmp_geom_clip.tif")
geom_arr, geom_gt, _ = load_and_clip_raster(GEOMORPHONS_TIF, geom_clip_path, bounds, CELL_SIZE)
geom_suit = np.full(shape, 0.5, dtype=np.float32)
for cls, val in GEOMORPHON_SUITABILITY.items():
    geom_suit[geom_arr == cls] = val
# 255 is NoData in geomorphons
geom_suit[geom_arr == 255] = 0.5
print(f"  Geomorphon classes: {np.unique(geom_arr)}")

# Pedotopes — soil type suitability (higher pedotope class = more mature soil = better)
print("  Loading pedotopes...")
pedo_clip_path = os.path.join(OUT_DIR, "_tmp_pedo_clip.tif")
pedo_arr, pedo_gt, _ = load_and_clip_raster(PEDOTOPES_TIF, pedo_clip_path, bounds, CELL_SIZE)
pedo_arr_masked = np.where(pedo_arr <= 0, np.nan, pedo_arr).astype(np.float32)
pedo_suit = normalize(pedo_arr_masked)
pedo_suit = np.nan_to_num(pedo_suit, nan=0.5)
print(f"  Pedotopes range: {np.nanmin(pedo_arr):.1f} - {np.nanmax(pedo_arr):.1f}")

# ============================================================
# STEP 4: Vector Proximity Layers
# ============================================================
print("\n=== STEP 4: Vector Proximity ===")

# Ancient Woodland proximity
print("  Loading Ancient Woodland...")
aw = gpd.read_file(AW_PATH).to_crs(f"EPSG:{EPSG}")
aw_clipped = gpd.clip(aw, gpd.GeoDataFrame(geometry=[box(minx, miny, maxx, maxy)], crs=f"EPSG:{EPSG}"))
aw_dist = proximity_raster(aw_clipped, gt_out, shape, max_distance_m=5000)
aw_prox = normalize(aw_dist, invert=True)  # closer = higher score
print(f"  AW patches: {len(aw_clipped)}, mean proximity: {aw_prox[aonb_mask].mean():.3f}")

# Roads — constraint buffer
print("  Loading roads...")
road_data_dir = os.path.join(ROAD_EXTRACT, "data")
# Cotswolds falls in SO and SP OS tiles
road_tiles = ["SO_RoadLink.shp", "SP_RoadLink.shp", "SU_RoadLink.shp", "ST_RoadLink.shp"]
road_frames = []
for tile in road_tiles:
    tile_path = os.path.join(road_data_dir, tile)
    if os.path.exists(tile_path):
        print(f"    Reading {tile}...")
        road_frames.append(gpd.read_file(tile_path))
if road_frames:
    roads = pd.concat(road_frames, ignore_index=True)
    roads = gpd.GeoDataFrame(roads, geometry="geometry", crs=road_frames[0].crs).to_crs(f"EPSG:{EPSG}")
else:
    raise FileNotFoundError(f"No road shapefiles found in {road_data_dir}")
roads_clipped = gpd.clip(roads, gpd.GeoDataFrame(geometry=[box(minx, miny, maxx, maxy)], crs=f"EPSG:{EPSG}"))
# Buffer major roads by 30m as constraint — use 'function' or 'class' column if present
road_col = None
for c in ["function", "class", "roadClass", "ROADCLASS", "Function"]:
    if c in roads_clipped.columns:
        road_col = c
        break
if road_col:
    major_roads = roads_clipped[roads_clipped[road_col].apply(
        lambda x: any(k in str(x).upper() for k in ["MOTORWAY", "A ROAD", "TRUNK", "PRIMARY", "A-ROAD"])
    )]
else:
    # If no classification column, use all roads as moderate constraint
    major_roads = roads_clipped
if len(major_roads) > 0:
    road_buf = major_roads.geometry.buffer(30)
    road_gdf = gpd.GeoDataFrame(geometry=road_buf, crs=f"EPSG:{EPSG}")
    road_constraint = rasterize_vector(road_gdf, gt_out, shape, attr_value=1)
    constraint = np.maximum(constraint, road_constraint)
    print(f"  Major roads buffered: {len(major_roads)}")
else:
    print("  No major roads found in study area")

# PHI — existing high-value habitat constraint (don't convert)
print("  Loading PHI...")
try:
    # Load PHI with bbox filter to avoid loading entire 2.7GB file
    phi = gpd.read_file(PHI_PATH, bbox=(minx, miny, maxx, maxy)).to_crs(f"EPSG:{EPSG}")
    phi_clipped = phi
except Exception as e:
    print(f"    Warning: PHI bbox filter failed ({e}), trying clip instead...")
    phi = gpd.read_file(PHI_PATH).to_crs(f"EPSG:{EPSG}")
    phi_clipped = gpd.clip(phi, gpd.GeoDataFrame(geometry=[box(minx, miny, maxx, maxy)], crs=f"EPSG:{EPSG}"))
if len(phi_clipped) > 0:
    phi_constraint = rasterize_vector(phi_clipped, gt_out, shape, attr_value=1)
    constraint = np.maximum(constraint, phi_constraint)
    print(f"  PHI polygons: {len(phi_clipped)}")

# Apply AONB mask (only score within Cotswolds)
constraint[~aonb_mask] = 1.0  # outside AONB = constrained

# Save constraint raster
save_raster(constraint, os.path.join(OUT_DIR, "constraint_mask.tif"), gt_out)
print(f"  Total constraint cells: {constraint.sum():.0f}")

# ============================================================
# STEP 5: Connectivity Input from Permeability Model
# ============================================================
print("\n=== STEP 5: Permeability Model Integration ===")

# Load pinch points / restoration opportunities from v2
try:
    pinch = gpd.read_file(PERM_V2_GPKG, layer="17_restoration_opportunities")
    pinch_clipped = gpd.clip(pinch, gpd.GeoDataFrame(geometry=[box(minx, miny, maxx, maxy)], crs=f"EPSG:{EPSG}"))
    print(f"  Pinch points loaded: {len(pinch_clipped)}")
    
    # Proximity to pinch points
    pinch_dist = proximity_raster(pinch_clipped, gt_out, shape, max_distance_m=3000)
    pinch_prox = normalize(pinch_dist, invert=True)
except Exception as e:
    print(f"  Warning: could not load pinch points: {e}")
    pinch_prox = np.zeros(shape, dtype=np.float32)

# Load connectivity network edges
try:
    network = gpd.read_file(PERM_V2_GPKG, layer="14_connectivity_network")
    network_clipped = gpd.clip(network, gpd.GeoDataFrame(geometry=[box(minx, miny, maxx, maxy)], crs=f"EPSG:{EPSG}"))
    print(f"  Network edges loaded: {len(network_clipped)}")
    
    # Proximity to corridors
    corridor_dist = proximity_raster(network_clipped, gt_out, shape, max_distance_m=2000)
    corridor_prox = normalize(corridor_dist, invert=True)
except Exception as e:
    print(f"  Warning: could not load network: {e}")
    corridor_prox = np.zeros(shape, dtype=np.float32)

# ============================================================
# STEP 6: Build Suitability Surfaces (3 Scenarios)
# ============================================================
print("\n=== STEP 6: Scenario Suitability Surfaces ===")

# Base factors (all normalized 0-1)
f_land = lcm_suit
f_twi = twi_suit
f_drain = drain_suit
f_geom = geom_suit
f_pedo = pedo_suit
f_aw_prox = aw_prox
f_pinch = pinch_prox
f_corridor = corridor_prox

# Environmental composite (physical suitability for woodland)
f_env = (f_land * 0.30 + f_twi * 0.20 + f_drain * 0.15 + f_geom * 0.15 + f_pedo * 0.20)

# Scenario A: Connectivity-first
# Weights: corridor proximity 30%, pinch point proximity 20%, AW proximity 20%, env 30%
suit_A = (f_corridor * 0.30 + f_pinch * 0.20 + f_aw_prox * 0.20 + f_env * 0.30)

# Scenario B: Biodiversity-first
# Weights: AW proximity 35%, land cover 25%, env 25%, corridor 15%
suit_B = (f_aw_prox * 0.35 + f_land * 0.25 + f_env * 0.25 + f_corridor * 0.15)

# Scenario C: Carbon-first
# Weights: env 50%, pedotopes 20%, TWI 15%, drainage 15%
suit_C = (f_env * 0.50 + f_pedo * 0.20 + f_twi * 0.15 + f_drain * 0.15)

# Apply constraints (set to 0 where constrained)
for suit in [suit_A, suit_B, suit_C]:
    suit[constraint > 0] = 0.0
    suit[~aonb_mask] = 0.0
 
# Clip to 0-1
suit_A = np.clip(suit_A, 0, 1).astype(np.float32)
suit_B = np.clip(suit_B, 0, 1).astype(np.float32)
suit_C = np.clip(suit_C, 0, 1).astype(np.float32)
 
# Save rasters
save_raster(suit_A, os.path.join(OUT_DIR, "suitability_A_connectivity.tif"), gt_out)
save_raster(suit_B, os.path.join(OUT_DIR, "suitability_B_biodiversity.tif"), gt_out)
save_raster(suit_C, os.path.join(OUT_DIR, "suitability_C_carbon.tif"), gt_out)
print(f"  Scenario A (connectivity) mean: {suit_A[aonb_mask].mean():.3f}")
print(f"  Scenario B (biodiversity)  mean: {suit_B[aonb_mask].mean():.3f}")
print(f"  Scenario C (carbon)        mean: {suit_C[aonb_mask].mean():.3f}")
 
# Save factor rasters for transparency
save_raster(f_env, os.path.join(OUT_DIR, "factor_environmental.tif"), gt_out)
save_raster(f_aw_prox, os.path.join(OUT_DIR, "factor_aw_proximity.tif"), gt_out)
save_raster(f_corridor, os.path.join(OUT_DIR, "factor_corridor_proximity.tif"), gt_out)
save_raster(f_pinch, os.path.join(OUT_DIR, "factor_pinch_proximity.tif"), gt_out)
 
# ============================================================
# STEP 7: Extract Candidate Restoration Parcels
# ============================================================
print("\n=== STEP 7: Candidate Restoration Parcels ===")
 
# Threshold to identify candidate areas
THRESHOLD = 0.6
MIN_PARCEL_HA = 2.0  # minimum 2 hectares
min_pixels = int(MIN_PARCEL_HA * 10000 / (CELL_SIZE ** 2))
 
from scipy.ndimage import label as nd_label
 
def extract_parcels(suit_arr, scenario_name, threshold, min_px):
    """Extract vector polygons from suitability raster above threshold."""
    binary = (suit_arr >= threshold) & aonb_mask & (constraint == 0)
    labeled, n_clusters = nd_label(binary)
    
    if n_clusters == 0:
        return gpd.GeoDataFrame(columns=[
            "scenario", "parcel_id", "area_ha", "mean_suitability",
            "centroid_x", "centroid_y", "geometry"
        ], crs=f"EPSG:{EPSG}")
    
    records = []
    for i in range(1, n_clusters + 1):
        mask_i = labeled == i
        n_cells = mask_i.sum()
        if n_cells < min_px:
            continue
        
        area_ha = n_cells * (CELL_SIZE ** 2) / 10000.0
        mean_suit = suit_arr[mask_i].mean()
        
        # Build polygon from cluster bounding box (simplified)
        rows, cols = np.where(mask_i)
        r_min, r_max = rows.min(), rows.max()
        c_min, c_max = cols.min(), cols.max()
        
        x_min = gt_out[0] + c_min * gt_out[1]
        x_max = gt_out[0] + (c_max + 1) * gt_out[1]
        y_max = gt_out[3] + r_min * gt_out[5]
        y_min = gt_out[3] + (r_max + 1) * gt_out[5]
        
        poly = box(x_min, y_min, x_max, y_max)
        cx = (x_min + x_max) / 2
        cy = (y_min + y_max) / 2
        
        records.append({
            "scenario": scenario_name,
            "parcel_id": i,
            "area_ha": area_ha,
            "mean_suitability": mean_suit,
            "centroid_x": cx,
            "centroid_y": cy,
            "geometry": poly,
        })
    
    if len(records) == 0:
        return gpd.GeoDataFrame(columns=[
            "scenario", "parcel_id", "area_ha", "mean_suitability",
            "centroid_x", "centroid_y", "geometry"
        ], crs=f"EPSG:{EPSG}")
    return gpd.GeoDataFrame(records, crs=f"EPSG:{EPSG}")
 
parcels_A = extract_parcels(suit_A, "A_connectivity", THRESHOLD, min_pixels)
parcels_B = extract_parcels(suit_B, "B_biodiversity", THRESHOLD, min_pixels)
parcels_C = extract_parcels(suit_C, "C_carbon", THRESHOLD, min_pixels)
 
print(f"  Scenario A parcels: {len(parcels_A)} ({parcels_A['area_ha'].sum():.0f} ha)")
print(f"  Scenario B parcels: {len(parcels_B)} ({parcels_B['area_ha'].sum():.0f} ha)")
print(f"  Scenario C parcels: {len(parcels_C)} ({parcels_C['area_ha'].sum():.0f} ha)")
 
# Save to GPKG
if len(parcels_A) > 0:
    parcels_A.to_file(OUT_GPKG, layer="02_parcels_A_connectivity", driver="GPKG")
if len(parcels_B) > 0:
    parcels_B.to_file(OUT_GPKG, layer="03_parcels_B_biodiversity", driver="GPKG")
if len(parcels_C) > 0:
    parcels_C.to_file(OUT_GPKG, layer="04_parcels_C_carbon", driver="GPKG")
 
# ============================================================
# STEP 8: Scenario Comparison — Where does the solution change?
# ============================================================
print("\n=== STEP 8: Scenario Comparison ===")
 
# Difference rasters
diff_AB = suit_A - suit_B
diff_AC = suit_A - suit_C
diff_BC = suit_B - suit_C
 
save_raster(diff_AB, os.path.join(OUT_DIR, "difference_A_minus_B.tif"), gt_out)
save_raster(diff_AC, os.path.join(OUT_DIR, "difference_A_minus_C.tif"), gt_out)
save_raster(diff_BC, os.path.join(OUT_DIR, "difference_B_minus_C.tif"), gt_out)
 
# Agreement map: where all 3 scenarios agree (high suitability)
agreement = np.minimum(np.minimum(suit_A, suit_B), suit_C)
save_raster(agreement, os.path.join(OUT_DIR, "scenario_agreement.tif"), gt_out)
 
# Conflict map: where scenarios disagree most
disagreement = np.maximum(
    np.abs(suit_A - suit_B),
    np.maximum(np.abs(suit_A - suit_C), np.abs(suit_B - suit_C))
)
save_raster(disagreement, os.path.join(OUT_DIR, "scenario_disagreement.tif"), gt_out)
 
print(f"  Agreement mean: {agreement[aonb_mask].mean():.3f}")
print(f"  Disagreement mean: {disagreement[aonb_mask].mean():.3f}")
 
# ============================================================
# STEP 9: Before/After Connectivity Improvement
# ============================================================
print("\n=== STEP 9: Before/After Connectivity Assessment ===")
 
# For top parcels in Scenario A (connectivity-first), estimate
# connectivity improvement by checking if the parcel sits on a
# pinch point or gap between core patches.
 
try:
    core_patches = gpd.read_file(PERM_V2_GPKG, layer="10_core_patches")
    core_clipped = gpd.clip(core_patches, gpd.GeoDataFrame(
        geometry=[box(minx, miny, maxx, maxy)], crs=f"EPSG:{EPSG}"))
    
    # For each Scenario A parcel, compute distance to nearest 2 core patches
    from scipy.spatial import cKDTree
    
    core_centroids = np.array([[g.centroid.x, g.centroid.y] for g in core_clipped.geometry])
    tree = cKDTree(core_centroids)
    
    improvement_records = []
    for _, row in parcels_A.iterrows():
        cx, cy = row["centroid_x"], row["centroid_y"]
        dists, idxs = tree.query([cx, cy], k=2)
        
        # Improvement heuristic: if parcel is between two cores within 3km,
        # restoring it would bridge the gap
        gap_distance = dists[0] + dists[1]
        if gap_distance < 6000:  # 6km total gap
            # Before: cost ~ gap_distance * mean_resistance
            # After: parcel restored → resistance drops → cost decreases
            improvement_score = 1.0 - (gap_distance / 6000.0)
        else:
            improvement_score = 0.0
        
        improvement_records.append({
            "parcel_id": row["parcel_id"],
            "area_ha": row["area_ha"],
            "mean_suitability": row["mean_suitability"],
            "nearest_core_dist_m": dists[0],
            "second_core_dist_m": dists[1],
            "gap_distance_m": gap_distance,
            "connectivity_improvement": improvement_score,
            "geometry": row["geometry"],
        })
    
    improvement_df = gpd.GeoDataFrame(improvement_records, crs=f"EPSG:{EPSG}")
    if len(improvement_df) > 0:
        improvement_df.to_file(OUT_GPKG, layer="05_connectivity_improvement", driver="GPKG")
        
        # Summary stats
        top10 = improvement_df.nlargest(10, "connectivity_improvement")
        print(f"  Parcels assessed: {len(improvement_df)}")
        print(f"  Top 10 improvement scores: {top10['connectivity_improvement'].values}")
        
        top10.to_csv(os.path.join(OUT_DIR, "top10_restoration_parcels.csv"), index=False)
 
except Exception as e:
    print(f"  Connectivity assessment skipped: {e}")
 
# ============================================================
# STEP 10: Summary & Metadata
# ============================================================
print("\n=== STEP 10: Summary ===")
 
summary = {
    "study_area_km2": cotswolds_geom.area / 1e6,
    "cell_size_m": CELL_SIZE,
    "grid_cells": int(nx * ny),
    "constraint_cells": int(constraint.sum()),
    "available_cells": int((constraint == 0).sum() & aonb_mask.sum()),
    "scenario_A_parcels": len(parcels_A),
    "scenario_A_area_ha": float(parcels_A["area_ha"].sum()) if len(parcels_A) > 0 else 0,
    "scenario_B_parcels": len(parcels_B),
    "scenario_B_area_ha": float(parcels_B["area_ha"].sum()) if len(parcels_B) > 0 else 0,
    "scenario_C_parcels": len(parcels_C),
    "scenario_C_area_ha": float(parcels_C["area_ha"].sum()) if len(parcels_C) > 0 else 0,
    "scenario_A_mean": float(suit_A[aonb_mask].mean()),
    "scenario_B_mean": float(suit_B[aonb_mask].mean()),
    "scenario_C_mean": float(suit_C[aonb_mask].mean()),
    "agreement_mean": float(agreement[aonb_mask].mean()),
    "disagreement_mean": float(disagreement[aonb_mask].mean()),
}
 
summary_df = pd.DataFrame([summary])
summary_df.to_csv(os.path.join(OUT_DIR, "model_summary.csv"), index=False)
 
# Save scenario weights as CSV
weights = pd.DataFrame([
    {"scenario": "A_connectivity", "corridor_prox": 0.30, "pinch_prox": 0.20,
     "aw_prox": 0.20, "environmental": 0.30, "land_cover": 0, "twi": 0,
     "drainage": 0, "geomorphons": 0, "pedotopes": 0},
    {"scenario": "B_biodiversity", "corridor_prox": 0.15, "pinch_prox": 0,
     "aw_prox": 0.35, "environmental": 0.25, "land_cover": 0.25, "twi": 0,
     "drainage": 0, "geomorphons": 0, "pedotopes": 0},
    {"scenario": "C_carbon", "corridor_prox": 0, "pinch_prox": 0,
     "aw_prox": 0, "environmental": 0.50, "land_cover": 0, "twi": 0.15,
     "drainage": 0.15, "geomorphons": 0, "pedotopes": 0.20},
])
weights.to_csv(os.path.join(OUT_DIR, "scenario_weights.csv"), index=False)
 
# Clean up temp files
for tmp in ["_tmp_lcm_clip.tif", "_tmp_twi_clip.tif", "_tmp_drain_clip.tif",
            "_tmp_geom_clip.tif", "_tmp_pedo_clip.tif"]:
    tmp_path = os.path.join(OUT_DIR, tmp)
    if os.path.exists(tmp_path):
        try:
            os.remove(tmp_path)
        except Exception as e:
            print(f"  Warning: could not delete {tmp}: {e}")
 
print(f"\n{'='*60}")
print(f"RESTORATION SUITABILITY MODEL COMPLETE")
print(f"{'='*60}")
print(f"  Output directory: {OUT_DIR}")
print(f"  GeoPackage: {OUT_GPKG}")
print(f"  Rasters: 3 suitability + 4 factor + 3 difference + 2 agreement/disagreement")
print(f"  CSVs: model_summary, scenario_weights, top10_parcels")
print(f"  Scenario A: {summary['scenario_A_parcels']} parcels ({summary['scenario_A_area_ha']:.0f} ha)")
print(f"  Scenario B: {summary['scenario_B_parcels']} parcels ({summary['scenario_B_area_ha']:.0f} ha)")