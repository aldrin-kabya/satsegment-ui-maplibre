from fastapi import FastAPI
from titiler.core.factory import TilerFactory
from titiler.core.errors import DEFAULT_STATUS_CODES, add_exception_handlers
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="LULC Bangladesh API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper to check if files exist
@app.get("/check-files")
def check_files():
    base_path = "/media/drive2/armun/sat-segment/processed_cog"
    return {
        "2019": os.path.exists(os.path.join(base_path, "2019_cog.tif")),
        "2023": os.path.exists(os.path.join(base_path, "2023_cog.tif"))
    }

# Create Tiler
cog = TilerFactory()
app.include_router(cog.router, prefix="/cog", tags=["Cloud Optimized GeoTIFF"])

add_exception_handlers(app, DEFAULT_STATUS_CODES)
