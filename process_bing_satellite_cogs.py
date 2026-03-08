import argparse
import os
import subprocess
import sys

# python3 process_bing_satellite_cogs.py --year 2023

def main():
    parser = argparse.ArgumentParser(description="Process Bangladesh GeoTIFFs into Cloud Optimized GeoTIFFs (COG).")
    parser.add_argument(
        "--year", 
        type=str, 
        choices=["2019", "2023"], 
        required=True, 
        help="The year of the satellite imagery to process: '2019' or '2023'."
    )
    args = parser.parse_args()
    year = args.year

    # Input files mapped by year
    inputs = {
        "2019": "/media/drive2/armun/sat-segment/BD_2019_Full.tif",
        "2023": "/media/drive2/armun/sat-segment/Bangladesh_BING_2023.tif"
    }
    
    boundary_geojson = "/home/kabya/sat-segment-maplibre/bgd_admbnda_adm0_bbs_20201113.json"
    
    # Output directory
    output_dir = "/media/drive2/armun/sat-segment/processed_cog"
    
    # Output file logic
    output_path = os.path.join(output_dir, f"bing_satellite_{year}_cog.tif")
    input_path = inputs[year]
    
    # Resource configuration
    # To avoid OOM, GDAL_CACHEMAX is lowered from 80000 to 20000 (20GB).
    # Warp memory limit is kept tight at 2048 MB to leave room for threading overhead.
    memory_limit_mb = "2048"
    num_threads = "16"  # Reducing threads to prevent memory from scaling out of control
    
    # Ensure output directory exists
    print(f"Creating output directory at: {output_dir}")
    os.makedirs(output_dir, exist_ok=True)
    
    # Set GDAL temp directory explicitly to output dir to avoid filling up the OS /tmp drive
    os.environ['CPL_TMPDIR'] = output_dir
    os.environ['TMPDIR'] = output_dir
    
    def process_image(in_path, out_path, proc_year):
        print(f"\n[{proc_year}] Starting processing for {in_path}...")
        
        # Step 1: Create a VRT (Virtual Dataset) applying the cutline.
        # This is extremely fast and takes basically zero memory.
        vrt_path = out_path.replace(".tif", ".vrt")
        cmd_vrt = [
            "gdalwarp",
            "-of", "VRT",
            "-cutline", boundary_geojson,
            "-crop_to_cutline",
            "-dstalpha",
            "-wm", memory_limit_mb,
            in_path,
            vrt_path
        ]
        
        # Step 2: Translate the VRT to a COG.
        # This is much more memory-efficient than doing `gdalwarp -of COG` in one step.
        # Added GTIFF_IGNORE_READ_ERRORS to prevent crashing on slightly corrupted internal TIFF blocks.
        cmd_cog = [
            "gdal_translate",
            "-of", "COG",
            "--config", "GDAL_CACHEMAX", "20000",
            "--config", "GTIFF_IGNORE_READ_ERRORS", "YES",
            "-co", "COMPRESS=DEFLATE",
            "-co", "PREDICTOR=2",
            "-co", f"NUM_THREADS={num_threads}",
            "-co", "BIGTIFF=YES",
            vrt_path,
            out_path
        ]
        
        try:
            print(f"[{proc_year}] Creating VRT...\n{' '.join(cmd_vrt)}")
            subprocess.run(cmd_vrt, check=True)
            
            print(f"[{proc_year}] Translating VRT to COG...\n{' '.join(cmd_cog)}")
            subprocess.run(cmd_cog, check=True)
            
            print(f"[{proc_year}] Successfully created {out_path}")
            
            # Clean up the temporary VRT
            if os.path.exists(vrt_path):
                os.remove(vrt_path)
                
        except subprocess.CalledProcessError as e:
            print(f"[{proc_year}] Error occurred while processing {in_path}", file=sys.stderr)
            print(f"[{proc_year}] Command failed with exit status {e.returncode}", file=sys.stderr)
            sys.exit(1)
        except FileNotFoundError:
            print("\nError: GDAL tools not found in PATH.", file=sys.stderr)
            sys.exit(1)
            
    # Process chosen dataset
    if not os.path.exists(input_path):
        print(f"Error: Could not find input file {input_path}")
        sys.exit(1)
    else:
        process_image(input_path, output_path, year)

if __name__ == "__main__":
    main()
