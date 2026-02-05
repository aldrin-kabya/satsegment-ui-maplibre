from fastapi import FastAPI, Body
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

app = FastAPI(title="LULC Bangladesh API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. VIEWPORT STATS (BBOX) ---
@app.get("/exact_stats")
def exact_stats(url: str, bbox: str):
    try:
        minx, miny, maxx, maxy = map(float, bbox.split(','))
        with rasterio.open(url) as src:
            window = from_bounds(minx, miny, maxx, maxy, src.transform)
            
            # Fast sampling for panning/zooming
            data = src.read(
                1, window=window, out_shape=(512, 512), 
                resampling=Resampling.nearest, boundless=True, fill_value=0
            )
            unique, counts = np.unique(data, return_counts=True)
            result = dict(zip(unique.tolist(), counts.tolist()))
            if 0 in result: del result[0]
            return {"counts": result}
    except Exception as e:
        print(f"BBOX Stats Error: {e}")
        return {"counts": {}}

# --- 2. REGION STATS (Polygon) ---
class GeoStatsRequest(BaseModel):
    url: str
    geojson: Dict[str, Any] 

@app.post("/exact_stats_geojson")
def exact_stats_geojson(item: GeoStatsRequest):
    try:
        geom = item.geojson
        if "geometry" in geom:
            geom = geom["geometry"]

        with rasterio.open(item.url) as src:
            # 1. Get exact bounds of the selected polygon
            minx, miny, maxx, maxy = feature_bounds(geom)
            window = from_bounds(minx, miny, maxx, maxy, src.transform)
            
            # 2. Smart Resizing Logic
            # - If shape is smaller than 2048px, read FULL resolution (Perfect for Upazilas).
            # - If shape is huge (District), cap it at 2048px to prevent slow loading.
            MAX_SIZE = 2048 
            
            width = int(window.width)
            height = int(window.height)
            
            # Calculate aspect ratio preserving resize
            if width > MAX_SIZE or height > MAX_SIZE:
                scale = min(MAX_SIZE / width, MAX_SIZE / height)
                width = max(1, int(width * scale))
                height = max(1, int(height * scale))

            # 3. Read Data (Resampled only if necessary)
            data = src.read(
                1, 
                window=window, 
                out_shape=(height, width), 
                resampling=Resampling.nearest,
                boundless=True,
                fill_value=0
            )

            # 4. Generate Exact Transform for the Mask
            # This ensures the polygon lines up perfectly with the pixels we just read
            out_transform = transform_from_bounds(minx, miny, maxx, maxy, width, height)

            # 5. Create Mask
            poly_mask = geometry_mask(
                [geom], 
                transform=out_transform, 
                invert=True, 
                out_shape=(height, width),
                all_touched=True
            )

            # 6. Filter & Count
            valid_pixels = data[poly_mask]
            unique, counts = np.unique(valid_pixels, return_counts=True)
            result = dict(zip(unique.tolist(), counts.tolist()))
            
            if 0 in result: del result[0]
            
            return {"counts": result}
            
    except Exception as e:
        print(f"GeoJSON Stats Error: {e}")
        return {"counts": {}}

# TiTiler
cog = TilerFactory()
app.include_router(cog.router, prefix="/cog", tags=["Cloud Optimized GeoTIFF"])
add_exception_handlers(app, DEFAULT_STATUS_CODES)