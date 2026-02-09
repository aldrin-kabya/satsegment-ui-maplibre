import numpy as np
from PIL import Image
import io

# LULC Colors (R, G, B)
COLORS = {
    1: (0, 255, 255),   # Forest
    2: (255, 0, 0),     # Urban
    3: (0, 0, 255),     # Water
    4: (0, 255, 0),     # Farm
    5: (255, 255, 0)    # Meadow
}
GREY = (128, 128, 128)
FALLBACK_RED = (255, 0, 255) # Magenta (Debug Color)

def render_change_tile(b19, b23, l19, l23):
    height, width = b19.shape
    img = np.zeros((height, width, 4), dtype=np.uint8)
    
    # --- LOGIC ---
    # Ensure inputs are treated as simple masks (0=No, >0=Yes)
    # The raw files might use 1, 255, or other values for "Brickfield"
    is_brick_19 = b19 > 0
    is_brick_23 = b23 > 0
    
    # 1. UNCHANGED (Grey)
    mask_unchanged = is_brick_19 & is_brick_23
    img[mask_unchanged] = (*GREY, 255)
    
    # 2. LOST (Brick -> Other)
    mask_lost = is_brick_19 & (~is_brick_23)
    
    # Paint lost areas
    # Default to Magenta if no LULC match found (Debug)
    img[mask_lost] = (*FALLBACK_RED, 255) 
    
    for cls_id, rgb in COLORS.items():
        # Match LULC 2023
        class_mask = mask_lost & (l23 == cls_id)
        img[class_mask] = (*rgb, 255)

    # 3. GAINED (Other -> Brick)
    mask_gained = (~is_brick_19) & is_brick_23
    
    # Paint gained areas
    y_indices, x_indices = np.indices((height, width))
    stripe_mask = (x_indices + y_indices) % 8 < 3
    
    # Default Gained Base = Magenta (Debug)
    img[mask_gained] = (*FALLBACK_RED, 255)
    
    for cls_id, rgb in COLORS.items():
        # Match LULC 2019
        class_mask = mask_gained & (l19 == cls_id)
        img[class_mask] = (*rgb, 255)
        
    # Apply stripes to ALL gained areas (even if fallback color)
    img[mask_gained & stripe_mask] = (255, 255, 255, 255)

    image = Image.fromarray(img)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()