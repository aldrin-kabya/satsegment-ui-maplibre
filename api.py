from fastapi import FastAPI, Body, Response
from titiler.core.factory import TilerFactory
from titiler.core.errors import DEFAULT_STATUS_CODES, add_exception_handlers
from fastapi.middleware.cors import CORSMiddleware
import rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from rasterio.features import bounds as feature_bounds, geometry_mask
from rasterio.transform import from_bounds as transform_from_bounds
import numpy as np
from pydantic import BaseModel
from typing import Dict, Any
from rio_tiler.io import COGReader
from PIL import Image
import io

app = FastAPI(title="LULC Bangladesh API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- FILE PATH CONFIGURATION ---
BASE_PATH = "/media/drive2/armun/sat-segment/processed_cog"
PATHS = {
    "l19": f"{BASE_PATH}/2019_cog.tif",
    "l23": f"{BASE_PATH}/2023_cog.tif",
    "b19": f"{BASE_PATH}/brickfield_2019_cog.tif",
    "b23": f"{BASE_PATH}/brickfield_2023_cog.tif"
}

# --- INTERNAL RENDERING LOGIC ---
COLORS = {
    1: (0, 255, 255),   # Forest (Cyan)
    2: (255, 0, 0),     # Urban (Red)
    3: (0, 0, 255),     # Water (Blue)
    4: (0, 255, 0),     # Farmland (Green)
    5: (255, 255, 0)    # Meadow (Yellow)
}
GREY = (128, 128, 128)
FALLBACK_RED = (255, 0, 255) 

# --- HELPER: Aggressive Sanitization ---
def safe_convert(arr):
    try:
        # 1. Handle Masked Arrays (common in rio_tiler)
        if np.ma.is_masked(arr):
            arr = arr.filled(0)
        
        # 2. Convert to Float32 first to handle any potential inf/nan safely
        arr_float = np.array(arr, dtype=np.float32)
        
        # 3. Replace inf/nan with 0 (Critical Step)
        np.nan_to_num(arr_float, copy=False, nan=0.0, posinf=0.0, neginf=0.0)
        
        # 4. Clip to valid byte range (0-255)
        np.clip(arr_float, 0, 255, out=arr_float)
        
        # 5. Cast to uint8
        return arr_float.astype(np.uint8)
        
    except Exception as e:
        print(f"Sanitization Failed: {e}")
        # Return a safe empty array of default tile size
        return np.zeros((256, 256), dtype=np.uint8)

def render_change_tile_internal(b19, b23, l19, l23):
    # Ensure all inputs are safe uint8
    b19 = safe_convert(b19)
    b23 = safe_convert(b23)
    l19 = safe_convert(l19)
    l23 = safe_convert(l23)

    height, width = b19.shape
    img = np.zeros((height, width, 4), dtype=np.uint8)
    
    is_brick_19 = b19 > 0
    is_brick_23 = b23 > 0
    
    # 1. UNCHANGED (Grey)
    mask_unchanged = is_brick_19 & is_brick_23
    img[mask_unchanged] = (*GREY, 255)
    
    # 2. LOST (Brick -> Other)
    mask_lost = is_brick_19 & (~is_brick_23)
    img[mask_lost] = (*FALLBACK_RED, 255) # Default Base
    
    for cls_id, rgb in COLORS.items():
        class_mask = mask_lost & (l23 == cls_id)
        img[class_mask] = (*rgb, 255)

    # 3. GAINED (Other -> Brick)
    mask_gained = (~is_brick_19) & is_brick_23
    img[mask_gained] = (*FALLBACK_RED, 255) # Default Base
    
    # Stripes
    # Force integer dimensions for indices generation
    y_indices, x_indices = np.indices((int(height), int(width)))
    stripe_mask = (x_indices + y_indices) % 8 < 3
    
    for cls_id, rgb in COLORS.items():
        class_mask = mask_gained & (l19 == cls_id)
        img[class_mask] = (*rgb, 255)
        # Apply Stripes
        img[class_mask & stripe_mask] = (255, 255, 255, 255)

    # Apply Stripes to fallback gained as well
    fallback_gained = mask_gained & (img[..., 0] == 255) & (img[..., 1] == 0) & (img[..., 2] == 255)
    img[fallback_gained & stripe_mask] = (255, 255, 255, 255)

    image = Image.fromarray(img)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()

def render_lulc_change_tile_internal(target_id, l19, l23):
    l19 = safe_convert(l19)
    l23 = safe_convert(l23)

    height, width = l19.shape
    img = np.zeros((height, width, 4), dtype=np.uint8)
    
    is_target_19 = l19 == target_id
    is_target_23 = l23 == target_id
    
    # 1. UNCHANGED (Grey)
    mask_unchanged = is_target_19 & is_target_23
    img[mask_unchanged] = (*GREY, 255)
    
    # 2. LOST (Target -> Other LULC)
    mask_lost = is_target_19 & (~is_target_23)
    
    for cls_id, rgb in COLORS.items():
        if cls_id == target_id: continue
        class_mask = mask_lost & (l23 == cls_id)
        img[class_mask] = (*rgb, 255)

    # 3. GAINED (Other LULC -> Target)
    mask_gained = (~is_target_19) & is_target_23
    
    y_indices, x_indices = np.indices((int(height), int(width)))
    stripe_mask = (x_indices + y_indices) % 8 < 3
    
    for cls_id, rgb in COLORS.items():
        if cls_id == target_id: continue
        class_mask = mask_gained & (l19 == cls_id)
        img[class_mask] = (*rgb, 255)
        # Apply Stripes
        img[class_mask & stripe_mask] = (255, 255, 255, 255)

    image = Image.fromarray(img)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()

# --- ENDPOINTS ---

# --- 3. NEW: BRICKFIELD CHANGE DETECTION TILE ---
@app.get("/brickfield_change/{z}/{x}/{y}.png")
def brickfield_change(z: int, x: int, y: int):
    try:
        def get_data(path, name):
            try:
                with COGReader(path) as src:
                    # Fix: argument order is x, y, z for rio_tiler < 4.0, or check signature
                    # Standard rio_tiler.io.COGReader.tile(tile_x, tile_y, tile_z)
                    img = src.tile(x, y, z)
                    # Extract first band
                    return img.data[0]
            except Exception as e:
                print(f"Read Error {name}: {e}")
                return np.zeros((256, 256), dtype=np.uint8)

        # 1. Read Brickfield layers
        # Pass the name argument correctly
        b19_raw = get_data(PATHS["b19"], "b19")
        b23_raw = get_data(PATHS["b23"], "b23")
        
        # Sanitize immediately
        b19 = safe_convert(b19_raw)
        b23 = safe_convert(b23_raw)

        # Optimization: If both are empty, return transparent tile
        if np.max(b19) == 0 and np.max(b23) == 0:
             empty = np.zeros((256, 256, 4), dtype=np.uint8)
             img = Image.fromarray(empty)
             buf = io.BytesIO()
             img.save(buf, format="PNG")
             return Response(content=buf.getvalue(), media_type="image/png")

        # 2. Read LULC layers
        l19_raw = get_data(PATHS["l19"], "l19")
        l23_raw = get_data(PATHS["l23"], "l23")
        
        l19 = safe_convert(l19_raw)
        l23 = safe_convert(l23_raw)

        # 3. Render
        png_bytes = render_change_tile_internal(b19, b23, l19, l23)
        return Response(content=png_bytes, media_type="image/png")

    except Exception as e:
        print(f"Error in tile {z}/{x}/{y}: {e}")
        empty = np.zeros((256, 256, 4), dtype=np.uint8)
        img = Image.fromarray(empty)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return Response(content=buf.getvalue(), media_type="image/png")

@app.get("/lulc_change/{target_id}/{z}/{x}/{y}.png")
def lulc_change(target_id: int, z: int, x: int, y: int):
    try:
        def get_data(path, name):
            try:
                with COGReader(path) as src:
                    img = src.tile(x, y, z)
                    return img.data[0]
            except Exception as e:
                print(f"Read Error {name}: {e}")
                return np.zeros((256, 256), dtype=np.uint8)

        l19_raw = get_data(PATHS["l19"], "l19")
        l23_raw = get_data(PATHS["l23"], "l23")
        
        l19 = safe_convert(l19_raw)
        l23 = safe_convert(l23_raw)

        if np.max(l19) == 0 and np.max(l23) == 0:
             empty = np.zeros((256, 256, 4), dtype=np.uint8)
             img = Image.fromarray(empty)
             buf = io.BytesIO()
             img.save(buf, format="PNG")
             return Response(content=buf.getvalue(), media_type="image/png")

        png_bytes = render_lulc_change_tile_internal(target_id, l19, l23)
        return Response(content=png_bytes, media_type="image/png")

    except Exception as e:
        print(f"Error in tile {z}/{x}/{y}: {e}")
        empty = np.zeros((256, 256, 4), dtype=np.uint8)
        img = Image.fromarray(empty)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return Response(content=buf.getvalue(), media_type="image/png")

# ... (Rest of Stats Endpoints) ...
class GeoStatsRequest(BaseModel):
    url: str
    geojson: Dict[str, Any] 

@app.get("/exact_stats")
def exact_stats(url: str, bbox: str):
    try:
        minx, miny, maxx, maxy = map(float, bbox.split(','))
        with rasterio.open(url) as src:
            window = from_bounds(minx, miny, maxx, maxy, src.transform)
            data = src.read(1, window=window, out_shape=(512, 512), resampling=Resampling.nearest, boundless=True, fill_value=0)
            unique, counts = np.unique(data, return_counts=True)
            result = dict(zip(unique.tolist(), counts.tolist()))
            if 0 in result: del result[0]
            return {"counts": result}
    except Exception: return {"counts": {}}

@app.post("/exact_stats_geojson")
def exact_stats_geojson(item: GeoStatsRequest):
    try:
        geom = item.geojson
        if "geometry" in geom: geom = geom["geometry"]
        with rasterio.open(item.url) as src:
            minx, miny, maxx, maxy = feature_bounds(geom)
            window = from_bounds(minx, miny, maxx, maxy, src.transform)
            MAX_SIZE = 2048 
            width, height = int(window.width), int(window.height)
            if width > MAX_SIZE or height > MAX_SIZE:
                scale = min(MAX_SIZE / width, MAX_SIZE / height)
                width, height = max(1, int(width * scale)), max(1, int(height * scale))
            data = src.read(1, window=window, out_shape=(height, width), resampling=Resampling.nearest, boundless=True, fill_value=0)
            out_transform = transform_from_bounds(minx, miny, maxx, maxy, width, height)
            poly_mask = geometry_mask([geom], transform=out_transform, invert=True, out_shape=(height, width), all_touched=True)
            valid_pixels = data[poly_mask]
            unique, counts = np.unique(valid_pixels, return_counts=True)
            result = dict(zip(unique.tolist(), counts.tolist()))
            if 0 in result: del result[0]
            return {"counts": result}
    except Exception: return {"counts": {}}

cog = TilerFactory()
app.include_router(cog.router, prefix="/cog", tags=["Cloud Optimized GeoTIFF"])
add_exception_handlers(app, DEFAULT_STATUS_CODES)