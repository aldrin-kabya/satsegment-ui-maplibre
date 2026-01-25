import rasterio
import numpy as np
import os

# --- CONFIGURATION ---
INPUT_FILES = {
    "2019": "/media/drive2/armun/sat-segment/brickfield_segmentation_2019_masked.tif",
    "2023": "/media/drive2/armun/sat-segment/brickfield_segmentation_2023_masked.tif"
}

# Output to same folder as LULC COGs
OUTPUT_DIR = "/media/drive2/armun/sat-segment/processed_cog"

def process_brickfield(year):
    input_path = INPUT_FILES[year]
    output_path = os.path.join(OUTPUT_DIR, f"brickfield_{year}_cog.tif")

    print(f"--- Processing Brickfield {year} ---")
    
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return

    with rasterio.open(input_path) as src:
        profile = src.profile.copy()
        
        # Prepare for single band integer
        profile.update({
            "count": 1,
            "dtype": "uint8",
            "driver": "GTiff",
            "compress": "deflate",
            "tiled": True,
            "blockxsize": 512,
            "blockysize": 512,
            "nodata": 0
        })

        print("Writing COG...")
        with rasterio.open(output_path, "w", **profile) as dst:
            for i, (ij, window) in enumerate(src.block_windows(1)):
                # Read data
                data = src.read(1, window=window)
                
                # Normalize: Ensure all non-zero pixels are 1 (for easy coloring)
                # 0 remains 0 (Background)
                clean_data = np.where(data > 0, 1, 0).astype(np.uint8)

                dst.write(clean_data, 1, window=window)

            print("Building Overviews...")
            overviews = [2**j for j in range(1, 16)]
            dst.build_overviews(overviews, rasterio.enums.Resampling.nearest)
            dst.update_tags(ns='rio_overview', resampling='nearest')

    print(f"Finished {year}!")

if __name__ == "__main__":
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
    process_brickfield("2019")
    process_brickfield("2023")
