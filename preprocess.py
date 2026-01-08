import rasterio
import numpy as np
import json
import os
from rasterio.windows import Window

# --- CONFIGURATION ---
# Mapped input files
INPUT_FILES = {
    "2019": "/media/drive2/armun/sat-segment/segmentation_2019_masked.tif",
    "2023": "/media/drive2/armun/sat-segment/segmentation_2023_masked.tif"
}

# OUTPUT LOCATION (External Drive)
OUTPUT_DIR = "/media/drive2/armun/sat-segment/processed_cog"

# YOUR SPECIFIC CLASS MAP
# (R, G, B) -> Class ID
COLOR_MAP = {
    (0, 0, 0):      0,  # bg / No Data
    (0, 255, 0):    4,  # farmland
    (0, 0, 255):    3,  # water
    (0, 255, 255):  1,  # forest (Cyan)
    (255, 0, 0):    2,  # built_up
    (255, 255, 0):  5,  # meadow
}

# Default class if a pixel has a color not in the map
DEFAULT_CLASS = 0 

def process_year(year):
    input_path = INPUT_FILES[year]
    output_path = os.path.join(OUTPUT_DIR, f"{year}_cog.tif")
    stats_path = os.path.join(OUTPUT_DIR, f"{year}_stats.json")

    print(f"--- Processing {year} ---")
    print(f"Input: {input_path}")
    print(f"Output: {output_path}")
    
    if not os.path.exists(input_path):
        print(f"ERROR: Input file not found at {input_path}")
        return

    # Initialize stats counters
    global_stats = {id: 0 for id in COLOR_MAP.values()}
    global_stats[DEFAULT_CLASS] = 0

    with rasterio.open(input_path) as src:
        profile = src.profile.copy()
        
        # Update profile for Single Band Integer
        profile.update({
            "count": 1,
            "dtype": "uint8",
            "driver": "GTiff",
            "compress": "deflate", 
            "tiled": True,
            "blockxsize": 512,
            "blockysize": 512,
            "photometric": "MINISBLACK",
            "nodata": 0
        })

        print("Creating output file...")
        with rasterio.open(output_path, "w", **profile) as dst:
            # Process in blocks (windows) to save RAM
            windows = list(src.block_windows(1))
            total_windows = len(windows)
            
            print(f"Total blocks to process: {total_windows}")

            for i, (ij, window) in enumerate(windows):
                # Read only this small window
                r = src.read(1, window=window)
                g = src.read(2, window=window)
                b = src.read(3, window=window)

                # Create empty array for this block
                out_block = np.full(r.shape, DEFAULT_CLASS, dtype=np.uint8)

                # Vectorized Mapping
                for rgb, class_id in COLOR_MAP.items():
                    r_t, g_t, b_t = rgb
                    # Create boolean mask for this color
                    mask = (r == r_t) & (g == g_t) & (b == b_t)
                    out_block[mask] = class_id
                    
                    # Update Stats
                    count = np.count_nonzero(mask)
                    if count > 0:
                        global_stats[class_id] += int(count)

                # Write the processed block
                dst.write(out_block, 1, window=window)

                # Progress Bar
                if i % 100 == 0:
                    percent = (i / total_windows) * 100
                    print(f"  Progress: {percent:.2f}%", end="\r")

            print(f"  Progress: 100%      ")

            # Build Overviews
            print("Building Overviews (this takes time)...")
            overviews = [2**j for j in range(1, 16)]
            dst.build_overviews(overviews, rasterio.enums.Resampling.nearest)
            dst.update_tags(ns='rio_overview', resampling='nearest')

    # Save Stats
    with open(stats_path, "w") as f:
        json.dump(global_stats, f)
    print(f"Saved stats to {stats_path}")
    print(f"Finished {year}!")

if __name__ == "__main__":
    # Ensure output dir exists
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    process_year("2019")
    process_year("2023")
