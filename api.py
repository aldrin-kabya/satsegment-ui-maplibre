from fastapi import FastAPI, Query
from titiler.core.factory import TilerFactory
from titiler.core.errors import DEFAULT_STATUS_CODES, add_exception_handlers
from fastapi.middleware.cors import CORSMiddleware
import rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
import numpy as np
import os

app = FastAPI(title="LULC Bangladesh API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CUSTOM DYNAMIC STATS ENDPOINT ---
@app.get("/exact_stats")
def exact_stats(url: str, bbox: str):
    """
    Reads the specific area defined by bbox, resamples it to max 512x512,
    and returns pixel counts. This forces dynamic calculation.
    """
    try:
        # Parse BBOX (minx, miny, maxx, maxy)
        minx, miny, maxx, maxy = map(float, bbox.split(','))
        
        with rasterio.open(url) as src:
            # Calculate the window in the raster for this bbox
            window = from_bounds(minx, miny, maxx, maxy, src.transform)
            
            # Force read into a fixed small array (Sampling)
            # This makes it fast even if looking at the whole country
            # We use Nearest Neighbor to preserve integer classes
            data = src.read(
                1, 
                window=window, 
                out_shape=(512, 512), 
                resampling=Resampling.nearest,
                boundless=True, # Handle areas outside the map gracefully
                fill_value=0
            )
            
            # Count unique pixels
            unique, counts = np.unique(data, return_counts=True)
            
            # Convert numpy types to python native types for JSON
            result = dict(zip(unique.tolist(), counts.tolist()))
            
            # Remove NoData (0)
            if 0 in result:
                del result[0]
                
            return {"counts": result}
            
    except Exception as e:
        print(f"Error calculating stats: {e}")
        return {"counts": {}}

# Standard TiTiler COG Tiler
cog = TilerFactory()
app.include_router(cog.router, prefix="/cog", tags=["Cloud Optimized GeoTIFF"])

add_exception_handlers(app, DEFAULT_STATUS_CODES)