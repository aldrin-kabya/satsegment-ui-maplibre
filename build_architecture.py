"""
Generate a high-level system architecture diagram for the
Bangladesh LULC WebGIS platform (journal paper figure).

Uses real logo PNG files from the logos/ directory.

Usage:   python build_architecture.py
Output:  architecture_diagram.png  (300 DPI, white background)
"""

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Ellipse
from matplotlib.offsetbox import OffsetImage, AnnotationBbox
import matplotlib.image as mpimg
import numpy as np
import os

# ── Global style ─────────────────────────────────────────────────
plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["DejaVu Sans", "Liberation Sans", "Arial"],
    "font.size": 12,
})

# ── Colour palette ───────────────────────────────────────────────
BG          = "#FFFFFF"
TIER_BG     = "#F0F4FA"
TIER_BORDER = "#A0B0C8"
BOX_BG      = "#FFFFFF"
BOX_BORDER  = "#4A6080"
ARROW_CLR   = "#2C4060"
ARROW_INT   = "#5A7090"   # internal arrows (lighter)
LABEL_CLR   = "#151F2E"
SUBLABEL    = "#506880"

# Database cylinder colours
CYL_BODY    = "#D0DAE8"
CYL_TOP     = "#A8B8D0"
CYL_BORDER  = "#4A6080"

# Line widths
LW_TIER  = 3.5
LW_BOX   = 2.8
LW_ARROW = 3.5
LW_ARROW_INT = 2.8
LW_CYL   = 2.5

LOGO_DIR = "/home/kabya/sat-segment-maplibre/logos"

# ══════════════════════════════════════════════════════════════════
#  LOGO LOADING
# ══════════════════════════════════════════════════════════════════

def load_logo(filename):
    """Load a logo PNG from the logos directory."""
    path = os.path.join(LOGO_DIR, filename)
    if os.path.exists(path):
        return mpimg.imread(path)
    return None


def place_logo(ax, img, cx, cy, zoom=0.035):
    """Place a logo image centered at (cx, cy) in axes coords."""
    if img is None:
        return
    im = OffsetImage(img, zoom=zoom)
    im.image.axes = ax
    ab = AnnotationBbox(im, (cx, cy), frameon=False,
                        xycoords="data", zorder=8)
    ax.add_artist(ab)


# ══════════════════════════════════════════════════════════════════
#  MINI-ICON DRAWING (for items without real logos)
# ══════════════════════════════════════════════════════════════════

def draw_icon_compare(ax, cx, cy, s=0.018):
    ax.add_patch(mpatches.Rectangle(
        (cx - s, cy - s*0.7), s*0.9, s*1.4,
        facecolor="#90CAF9", edgecolor=BOX_BORDER, linewidth=1.5, zorder=8))
    ax.add_patch(mpatches.Rectangle(
        (cx + s*0.1, cy - s*0.7), s*0.9, s*1.4,
        facecolor="#A5D6A7", edgecolor=BOX_BORDER, linewidth=1.5, zorder=8))
    ax.plot([cx + s*0.05]*2, [cy - s*0.85, cy + s*0.85],
            color=BOX_BORDER, linewidth=2.5, zorder=9)


def draw_icon_change(ax, cx, cy, s=0.018):
    ax.add_patch(mpatches.FancyBboxPatch(
        (cx - s*0.7, cy - s*0.2), s*1.0, s*1.0,
        boxstyle="round,pad=0.002", facecolor="#FFCDD2",
        edgecolor="#C62828", linewidth=1.8, zorder=8))
    ax.add_patch(mpatches.FancyBboxPatch(
        (cx - s*0.3, cy - s*0.7), s*1.0, s*1.0,
        boxstyle="round,pad=0.002", facecolor="#C8E6C9",
        edgecolor="#2E7D32", linewidth=1.8, zorder=8))
    ax.text(cx + s*0.15, cy - s*0.2, "Δ", fontsize=13, fontweight="bold",
            color="#1B5E20", ha="center", va="center", zorder=9)


def draw_icon_stats(ax, cx, cy, s=0.018):
    ax.add_patch(plt.Circle((cx, cy), s*0.85, facecolor="#E8EAF6",
                              edgecolor="#3F51B5", linewidth=2.0, zorder=8))
    ax.text(cx, cy, "Σ", fontsize=15, fontweight="bold",
            color="#283593", ha="center", va="center", zorder=9)


def draw_icon_geojson(ax, cx, cy, s=0.018):
    from matplotlib.path import Path
    verts = [
        (cx - s*0.6, cy - s*0.9),
        (cx + s*0.3, cy - s*0.9),
        (cx + s*0.6, cy - s*0.5),
        (cx + s*0.6, cy + s*0.9),
        (cx - s*0.6, cy + s*0.9),
        (cx - s*0.6, cy - s*0.9),
    ]
    codes = [Path.MOVETO] + [Path.LINETO]*4 + [Path.CLOSEPOLY]
    ax.add_patch(mpatches.PathPatch(
        Path(verts, codes), facecolor="#FFF9C4", edgecolor="#F9A825",
        linewidth=1.8, zorder=8))
    for dy in [0.35, 0, -0.35]:
        ax.plot([cx-s*0.35, cx+s*0.35], [cy+s*dy]*2,
                color="#F57F17", linewidth=1.5, zorder=9)


def draw_icon_browser(ax, cx, cy, s=0.026):
    ax.add_patch(mpatches.FancyBboxPatch(
        (cx - s*1.6, cy - s*0.4), s*3.2, s*2.2,
        boxstyle="round,pad=0.003", facecolor="#E3F2FD",
        edgecolor="#37474F", linewidth=2.8, zorder=8))
    ax.add_patch(mpatches.Rectangle(
        (cx - s*1.55, cy + s*1.3), s*3.1, s*0.38,
        facecolor="#37474F", edgecolor="none", zorder=9))
    for i, clr in enumerate(["#E53935", "#FDD835", "#43A047"]):
        ax.add_patch(plt.Circle(
            (cx - s*1.2 + i*s*0.32, cy + s*1.49),
            s*0.085, color=clr, zorder=10))
    ax.plot([cx]*2, [cy - s*0.45, cy - s*0.85],
            color="#37474F", linewidth=3.0, zorder=8)
    ax.plot([cx - s*0.55, cx + s*0.55], [cy - s*0.85]*2,
            color="#37474F", linewidth=3.0, zorder=8)


# ══════════════════════════════════════════════════════════════════
#  DRAWING HELPERS
# ══════════════════════════════════════════════════════════════════

def draw_tier_box(ax, x, y, w, h, label):
    tier = FancyBboxPatch(
        (x, y), w, h, boxstyle="round,pad=0.012",
        facecolor=TIER_BG, edgecolor=TIER_BORDER,
        linewidth=LW_TIER, zorder=1)
    ax.add_patch(tier)
    ax.text(x + 0.035, y + h / 2, label,
            fontsize=16, fontweight="bold", color=LABEL_CLR,
            ha="center", va="center", rotation=90, zorder=5)


def draw_component_box(ax, cx, cy, w, h, title, subtitle=None,
                       icon_fn=None, icon_offset_y=0.026,
                       logo_img=None, logo_zoom=0.035):
    """Draw a component box. Use logo_img for real logos, icon_fn for drawn ones."""
    bx, by = cx - w/2, cy - h/2
    ax.add_patch(FancyBboxPatch(
        (bx, by), w, h, boxstyle="round,pad=0.006",
        facecolor=BOX_BG, edgecolor=BOX_BORDER,
        linewidth=LW_BOX, zorder=3))

    if logo_img is not None:
        place_logo(ax, logo_img, cx, cy + icon_offset_y, zoom=logo_zoom)
        text_y = cy - 0.018
    elif icon_fn:
        icon_fn(ax, cx, cy + icon_offset_y)
        text_y = cy - 0.018
    else:
        text_y = cy + 0.008

    ax.text(cx, text_y, title, fontsize=13.5, fontweight="bold",
            color=LABEL_CLR, ha="center", va="center", zorder=5)
    if subtitle:
        ax.text(cx, text_y - 0.020, subtitle, fontsize=10.5,
                color=SUBLABEL, ha="center", va="center", zorder=5,
                style="italic")


def draw_cylinder(ax, cx, cy, w, h, label, sublabel=None):
    """Draw a solid database cylinder (no gaps, no top glint)."""
    bx = cx - w/2
    ell_h = h * 0.35

    # Shadow
    shadow_off = 0.003
    ax.add_patch(mpatches.Rectangle(
        (bx + shadow_off, cy - h/2 - shadow_off), w, h,
        facecolor="#C0C8D4", edgecolor="none", linewidth=0, zorder=2))
    ax.add_patch(Ellipse(
        (cx + shadow_off, cy + h/2 - shadow_off), w, ell_h,
        facecolor="#C0C8D4", edgecolor="none", linewidth=0, zorder=2))

    # Body rectangle
    ax.add_patch(mpatches.Rectangle(
        (bx, cy - h/2), w, h,
        facecolor=CYL_BODY, edgecolor="none", linewidth=0, zorder=3))

    # Left and right vertical edges (draw explicitly to avoid bottom line)
    ax.plot([bx, bx], [cy - h/2, cy + h/2],
            color=CYL_BORDER, linewidth=LW_CYL, zorder=4, solid_capstyle="butt")
    ax.plot([bx + w, bx + w], [cy - h/2, cy + h/2],
            color=CYL_BORDER, linewidth=LW_CYL, zorder=4, solid_capstyle="butt")

    # Bottom ellipse (solid fill, border visible)
    ax.add_patch(Ellipse(
        (cx, cy - h/2), w, ell_h,
        facecolor=CYL_BODY, edgecolor=CYL_BORDER, linewidth=LW_CYL, zorder=3))

    # Top ellipse (darker lid, no highlight)
    ax.add_patch(Ellipse(
        (cx, cy + h/2), w, ell_h,
        facecolor=CYL_TOP, edgecolor=CYL_BORDER, linewidth=LW_CYL, zorder=5))

    # Text
    ax.text(cx, cy + 0.005, label, fontsize=12.5, fontweight="bold",
            color=LABEL_CLR, ha="center", va="center", zorder=6)
    if sublabel:
        ax.text(cx, cy - 0.018, sublabel, fontsize=10,
                color=SUBLABEL, ha="center", va="center", zorder=6,
                style="italic")


def draw_arrow(ax, x1, y1, x2, y2, label=None, bidirectional=False,
               color=None, label_side="right", fontsize=11, lw=None):
    c = color or ARROW_CLR
    w = lw or LW_ARROW
    style = "<->" if bidirectional else "->"
    ax.add_patch(FancyArrowPatch(
        (x1, y1), (x2, y2),
        arrowstyle=style, mutation_scale=25,
        linewidth=w, color=c, zorder=6))
    if label:
        mx, my = (x1+x2)/2, (y1+y2)/2
        if label_side == "right":
            ax.text(mx + 0.016, my, label, fontsize=fontsize,
                    color=c, ha="left", va="center", zorder=7,
                    fontweight="bold", style="italic")
        else:
            ax.text(mx - 0.016, my, label, fontsize=fontsize,
                    color=c, ha="right", va="center", zorder=7,
                    fontweight="bold", style="italic")


# ══════════════════════════════════════════════════════════════════
#  MAIN FIGURE
# ══════════════════════════════════════════════════════════════════

def build_diagram():
    fig, ax = plt.subplots(1, 1, figsize=(16, 16), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1.040)
    ax.set_aspect("equal")
    ax.axis("off")
    fig.patch.set_facecolor(BG)

    # ── Load logos ───────────────────────────────────────────────
    logo_nextjs    = load_logo("nextjs.png")
    logo_maplibre  = load_logo("maplibre.png")
    logo_chartjs   = load_logo("chartjs.png")
    logo_fastapi   = load_logo("fastapi.png")
    logo_titiler   = load_logo("titiler.png")
    logo_rasterio  = load_logo("rasterio-numpy.png")

    LM = 0.05
    TW = 0.90

    # ── Tier positions (bottom-y, height) ────────────────────────
    t3_y, t3_h = 0.025, 0.16     # Data Storage
    t2_y, t2_h = 0.265, 0.36     # Server-Side
    t1_y, t1_h = 0.705, 0.13     # Client-Side
    tb_y, tb_h = 0.915, 0.09     # Browser

    # ── Unified component box size for ALL tiers ─────────────────
    BW = 0.155  # box width
    BH = 0.09   # box height

    # ══════════════════════════════════════════════════════════════
    #  TIER: Browser
    # ══════════════════════════════════════════════════════════════
    draw_tier_box(ax, LM, tb_y, TW, tb_h, "")
    draw_icon_browser(ax, 0.50, tb_y + tb_h/2 + 0.012)
    ax.text(0.50, tb_y + tb_h/2 - 0.028, "Web Browser",
            fontsize=17, fontweight="bold", color=LABEL_CLR,
            ha="center", va="center", zorder=5)

    # ══════════════════════════════════════════════════════════════
    #  TIER: Client-Side
    # ══════════════════════════════════════════════════════════════
    draw_tier_box(ax, LM, t1_y, TW, t1_h, "Client Side")

    cy_cl = t1_y + t1_h/2

    draw_component_box(ax, 0.22, cy_cl, BW, BH,
                       "Next.js / React", "UI Framework",
                       logo_img=logo_nextjs, logo_zoom=0.080,
                       icon_offset_y=0.022)
    draw_component_box(ax, 0.42, cy_cl, BW, BH,
                       "MapLibre GL JS", "Map Rendering",
                       logo_img=logo_maplibre, logo_zoom=0.04,
                       icon_offset_y=0.022)
    draw_component_box(ax, 0.62, cy_cl, BW, BH,
                       "Chart.js", "Data Visualization",
                       logo_img=logo_chartjs, logo_zoom=0.06,
                       icon_offset_y=0.022)
    draw_component_box(ax, 0.82, cy_cl, BW, BH,
                       "GL Compare", "Temporal Swipe",
                       icon_fn=draw_icon_compare, icon_offset_y=0.022)

    # ══════════════════════════════════════════════════════════════
    #  TIER: Server-Side (Hub-and-Spoke Routing)
    # ══════════════════════════════════════════════════════════════
    draw_tier_box(ax, LM, t2_y, TW, t2_h, "Server Side")

    # Three vertical slots for the compute engines (Center Column)
    cy_mid = t2_y + t2_h / 2
    cy_top = cy_mid + 0.115
    cy_bot = cy_mid - 0.115

    # FastAPI (Left Column)
    draw_component_box(ax, 0.22, cy_mid, BW, BH,
                       "FastAPI", "REST API Server",
                       logo_img=logo_fastapi, logo_zoom=0.0065,
                       icon_offset_y=0.022)

    # Compute Engines (Center Column)
    draw_component_box(ax, 0.52, cy_top, BW, BH,
                       "TiTiler", "COG Tile Server",
                       logo_img=logo_titiler, logo_zoom=0.075,
                       icon_offset_y=0.020)
    
    draw_component_box(ax, 0.52, cy_mid, BW, BH,
                       "Change Detection", "Pixel-Level Comparison",
                       icon_fn=draw_icon_change, icon_offset_y=0.022)

    draw_component_box(ax, 0.52, cy_bot, BW, BH,
                       "Zonal Statistics", "Area Computation",
                       icon_fn=draw_icon_stats, icon_offset_y=0.022)

    # Rasterio / NumPy (Right Column)
    draw_component_box(ax, 0.82, cy_mid, BW, BH,
                       "Rasterio / NumPy", "Spatial Processing",
                       logo_img=logo_rasterio, logo_zoom=0.080,
                       icon_offset_y=0.022)

    # ── Internal arrows ───────
    api_x_right = 0.22 + BW/2 + 0.004
    eng_x_left  = 0.52 - BW/2 - 0.004
    eng_x_right = 0.52 + BW/2 + 0.004
    ras_x_left  = 0.82 - BW/2 - 0.004

    # FastAPI -> Engines
    draw_arrow(ax, api_x_right, cy_mid + 0.03, eng_x_left, cy_top, color=ARROW_INT, lw=LW_ARROW_INT)
    ax.text(api_x_right + 0.038, cy_top - 0.025, "Base Tiles", fontsize=8.5, color=ARROW_INT, ha="center", va="top", style="italic", fontweight="bold")

    draw_arrow(ax, api_x_right, cy_mid,        eng_x_left, cy_mid, color=ARROW_INT, lw=LW_ARROW_INT)
    ax.text(api_x_right + 0.060, cy_mid + 0.008, "Compare Layers", fontsize=8.5, color=ARROW_INT, ha="center", va="bottom", style="italic", fontweight="bold")

    draw_arrow(ax, api_x_right, cy_mid - 0.03, eng_x_left, cy_bot, color=ARROW_INT, lw=LW_ARROW_INT)
    ax.text(api_x_right + 0.025, cy_bot + 0.025, "Analyze Polygon", fontsize=8.5, color=ARROW_INT, ha="center", va="bottom", style="italic", fontweight="bold")

    # Engines <-> Rasterio/NumPy
    draw_arrow(ax, eng_x_right, cy_top, ras_x_left, cy_mid + 0.03, color=ARROW_INT, lw=LW_ARROW_INT, bidirectional=True)
    ax.text(eng_x_right + 0.115, cy_top - 0.025, "Read Image Data", fontsize=8.5, color=ARROW_INT, ha="center", va="top", style="italic", fontweight="bold")

    draw_arrow(ax, eng_x_right, cy_mid, ras_x_left, cy_mid,        color=ARROW_INT, lw=LW_ARROW_INT, bidirectional=True)
    ax.text(eng_x_right + 0.068, cy_mid + 0.008, "Fetch Dual Years", fontsize=8.5, color=ARROW_INT, ha="center", va="bottom", style="italic", fontweight="bold")

    draw_arrow(ax, eng_x_right, cy_bot, ras_x_left, cy_mid - 0.03, color=ARROW_INT, lw=LW_ARROW_INT, bidirectional=True)
    ax.text(eng_x_right + 0.115, cy_bot + 0.025, "Vector Masking", fontsize=8.5, color=ARROW_INT, ha="center", va="bottom", style="italic", fontweight="bold")

    # ══════════════════════════════════════════════════════════════
    #  TIER: Data Storage (consolidated, centered)
    # ══════════════════════════════════════════════════════════════
    draw_tier_box(ax, LM, t3_y, TW, t3_h, "Data Storage")

    cy_dt = t3_y + t3_h/2 + 0.003
    cyl_w = 0.135
    cyl_h = 0.085

    draw_cylinder(ax, 0.22, cy_dt, cyl_w, cyl_h,
                  "LULC Maps", "COG")
    draw_cylinder(ax, 0.42, cy_dt, cyl_w + 0.01, cyl_h,
                  "Brickfield Maps", "COG")
    draw_cylinder(ax, 0.62, cy_dt, cyl_w + 0.02, cyl_h,
                  "Bing Satellite", "COG")

    draw_component_box(ax, 0.82, cy_dt, BW, BH,
                       "Boundary &\nInstitutions", "GeoJSON / CSV",
                       icon_fn=draw_icon_geojson, icon_offset_y=0.026)

    # ══════════════════════════════════════════════════════════════
    #  INTER-TIER ARROWS
    # ══════════════════════════════════════════════════════════════

    # Browser ↔ Client
    draw_arrow(ax, 0.50, tb_y - 0.006, 0.50, t1_y + t1_h + 0.006,
               bidirectional=True, label="HTTP", fontsize=11)

    # Client ↔ Server (left)
    draw_arrow(ax, 0.32, t1_y - 0.006, 0.32, t2_y + t2_h + 0.006,
               bidirectional=True,
               label="Tile Requests\n& ROI Queries", label_side="left",
               fontsize=10)

    # Server → Client (right)
    draw_arrow(ax, 0.68, t2_y + t2_h + 0.006, 0.68, t1_y - 0.006,
               bidirectional=False,
               label="Rendered Tiles\n& JSON Statistics",
               fontsize=10)

    # Server → Data (left)
    draw_arrow(ax, 0.32, t2_y - 0.006, 0.32, t3_y + t3_h + 0.006,
               bidirectional=False,
               label="Read Raster\nWindows", label_side="left",
               fontsize=10)

    # Server → Data (right)
    draw_arrow(ax, 0.68, t2_y - 0.006, 0.68, t3_y + t3_h + 0.006,
               bidirectional=False,
               label="Read Vector\n& Institutional Data",
               fontsize=10)

    # ── Save ─────────────────────────────────────────────────────
    out_png = "/home/kabya/sat-segment-maplibre/architecture_diagram.png"
    out_pdf = "/home/kabya/sat-segment-maplibre/architecture_diagram.pdf"
    
    fig.savefig(out_png, dpi=300, bbox_inches="tight",
                facecolor=BG, edgecolor="none", pad_inches=0.01)
    fig.savefig(out_pdf, dpi=300, bbox_inches="tight",
                facecolor=BG, edgecolor="none", pad_inches=0.01)
    plt.close(fig)
    print(f"Saved to {out_png} and {out_pdf}")

if __name__ == "__main__":
    build_diagram()
