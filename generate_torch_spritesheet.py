#!/usr/bin/env python3
"""
generate_torch_spritesheet.py
Generates the animated torch / lighter fire spritesheet (assets/torch_fire.png)
incorporating physical lighter housing, multi-frequency fluid flame physics,
incandescent core, ignition blue arc, ascending micro-embers, and bloom aura.
"""

import math
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

CELL_W, CELL_H = 64, 64
NUM_FRAMES = 8

def generate_torch_sheet():
    sheet = Image.new('RGBA', (CELL_W * NUM_FRAMES, CELL_H), (0, 0, 0, 0))
    
    for f in range(NUM_FRAMES):
        # Continuous phase from 0 to 2*pi for seamless 8-frame loop
        phase = (f / NUM_FRAMES) * 2.0 * math.pi
        
        # 2x supersampling for subpixel anti-aliasing
        SS = 2
        W_SS, H_SS = CELL_W * SS, CELL_H * SS
        cx_ss = 32 * SS
        base_y_ss = 48 * SS
        
        frame_ss = Image.new('RGBA', (W_SS, H_SS), (0, 0, 0, 0))
        draw_ss = ImageDraw.Draw(frame_ss)
        
        # --- 1. Brass Lighter Housing ---
        case_w = 11 * SS
        case_h = 10 * SS
        case_x0 = cx_ss - case_w // 2
        case_x1 = cx_ss + case_w // 2
        case_y0 = base_y_ss + 2 * SS
        case_y1 = case_y0 + case_h
        
        # Casing body
        draw_ss.rounded_rectangle(
            [case_x0, case_y0, case_x1, case_y1],
            radius=2*SS,
            fill=(42, 34, 26, 255),
            outline=(78, 64, 48, 255),
            width=SS
        )
        # Brass edge specular highlights
        draw_ss.line([case_x0 + SS, case_y0 + 2*SS, case_x0 + SS, case_y1 - 2*SS], fill=(140, 116, 75, 230), width=SS)
        draw_ss.line([case_x0 + 2*SS, case_y1 - SS, case_x1 - 2*SS, case_y1 - SS], fill=(22, 18, 14, 255), width=SS)
        
        # Angled flip-top lid
        lid_pts = [
            (case_x0, case_y0 + 2*SS),
            (case_x0 - 7*SS, case_y0 - 5*SS),
            (case_x0 - 9*SS, case_y0 - 3*SS),
            (case_x0 - 2*SS, case_y0 + 4*SS)
        ]
        draw_ss.polygon(lid_pts, fill=(35, 28, 22, 255), outline=(70, 56, 42, 255))
        draw_ss.ellipse([case_x0 - SS, case_y0 + SS, case_x0 + SS, case_y0 + 3*SS], fill=(130, 110, 80, 255))
        
        # Steel flint wheel
        wheel_box = [case_x0 - 2*SS, base_y_ss - 2*SS, case_x0 + 2*SS, base_y_ss + 2*SS]
        draw_ss.rounded_rectangle(wheel_box, radius=SS, fill=(90, 95, 102, 255), outline=(55, 60, 65, 255))
        draw_ss.line([case_x0, base_y_ss - SS, case_x0, base_y_ss + SS], fill=(140, 145, 150, 255))
        
        # Perforated wind chimney
        chimney_w = 7 * SS
        chim_x0 = cx_ss - chimney_w // 2 + SS
        chim_x1 = cx_ss + chimney_w // 2 + SS
        chim_y0 = base_y_ss - 5 * SS
        chim_y1 = base_y_ss + 2 * SS
        draw_ss.rectangle([chim_x0, chim_y0, chim_x1, chim_y1], fill=(32, 33, 36, 255), outline=(68, 70, 75, 255))
        hole_rad = int(0.8 * SS)
        for hx, hy in [(chim_x0 + 2*SS, chim_y0 + 2*SS), (chim_x1 - 2*SS, chim_y0 + 2*SS), (cx_ss + SS, chim_y0 + 4*SS)]:
            draw_ss.ellipse([hx - hole_rad, hy - hole_rad, hx + hole_rad, hy + hole_rad], fill=(14, 15, 16, 255))
        
        # Charred wick
        wick_x = cx_ss + SS
        wick_y_bot = chim_y0 + 2*SS
        wick_y_top = chim_y0 - 2*SS
        draw_ss.line([wick_x, wick_y_bot, wick_x, wick_y_top], fill=(24, 22, 20, 255), width=2*SS)
        
        # --- 2. Fluid Dynamic Flame ---
        flame_layer_ss = Image.new('RGBA', (W_SS, H_SS), (0, 0, 0, 0))
        flame_draw = ImageDraw.Draw(flame_layer_ss)
        
        wick_tip_y = wick_y_top
        flame_h = (25 + math.sin(phase) * 3.5 + math.cos(phase * 2.0) * 2.0) * SS
        flame_tip_y = wick_tip_y - flame_h
        
        num_slices = 24
        
        def compute_flame_profile(width_scale, height_ratio, x_skew_mult, phase_offset=0.0):
            left_pts = []
            right_pts = []
            top_y = wick_tip_y - flame_h * height_ratio
            for s in range(num_slices + 1):
                t = s / num_slices
                curr_y = wick_tip_y * (1 - t) + top_y * t
                if t < 0.3:
                    w = (3.0 * SS + t * 18.0 * SS) * width_scale
                else:
                    w = (1.0 - (t - 0.3) / 0.7) ** 1.1 * 8.4 * SS * width_scale
                
                wave1 = math.sin(phase + phase_offset + t * 4.5) * (3.0 * SS * (t ** 1.2))
                wave2 = math.cos(phase * 2.0 + t * 7.0) * (1.2 * SS * t)
                wave3 = math.sin(phase * 3.0 + t * 3.0) * (0.8 * SS * t)
                skew_x = (wave1 + wave2 + wave3) * x_skew_mult
                center_x = wick_x + skew_x
                
                left_pts.append((center_x - w, curr_y))
                right_pts.append((center_x + w, curr_y))
            return left_pts + right_pts[::-1]
        
        # 2a. Outer Fiery Crimson Envelope
        outer_poly = compute_flame_profile(width_scale=1.0, height_ratio=1.0, x_skew_mult=1.0)
        flame_draw.polygon(outer_poly, fill=(255, 65, 5, 235))
        
        # 2b. Secondary Flickering Flame Tongue
        tongue_dir = math.sin(phase)
        if abs(tongue_dir) > 0.25:
            tongue_poly = []
            side = 1.0 if tongue_dir > 0 else -1.0
            t_base_y = wick_tip_y - flame_h * 0.4
            t_tip_y = wick_tip_y - flame_h * (0.75 + 0.15 * math.sin(phase * 2.0))
            for s in range(12 + 1):
                t = s / 12
                cy = t_base_y * (1 - t) + t_tip_y * t
                cw = (1.0 - t) * 3.2 * SS
                cx = wick_x + side * (3.0 * SS + t * 5.0 * SS + math.sin(phase*2 + t*4)*1.5*SS)
                tongue_poly.append((cx - cw, cy))
            for s in reversed(range(12 + 1)):
                t = s / 12
                cy = t_base_y * (1 - t) + t_tip_y * t
                cw = (1.0 - t) * 3.2 * SS
                cx = wick_x + side * (3.0 * SS + t * 5.0 * SS + math.sin(phase*2 + t*4)*1.5*SS)
                tongue_poly.append((cx + cw, cy))
            flame_draw.polygon(tongue_poly, fill=(255, 95, 10, 210))
        
        # 2c. Warm Tangerine Mid-Layer
        mid_poly = compute_flame_profile(width_scale=0.76, height_ratio=0.88, x_skew_mult=0.9, phase_offset=0.2)
        flame_draw.polygon(mid_poly, fill=(255, 140, 10, 245))
        
        # 2d. Intense Golden Yellow Core
        core_poly = compute_flame_profile(width_scale=0.52, height_ratio=0.70, x_skew_mult=0.7, phase_offset=0.1)
        flame_draw.polygon(core_poly, fill=(255, 215, 30, 250))
        
        # 2e. Incandescent Near-White Center
        white_poly = compute_flame_profile(width_scale=0.28, height_ratio=0.48, x_skew_mult=0.4, phase_offset=0.0)
        flame_draw.polygon(white_poly, fill=(255, 255, 225, 255))
        
        # 2f. Blue Fuel Ignition Arc at the Wick
        blue_pts = [
            (wick_x - 3.5*SS, wick_tip_y + SS),
            (wick_x - 4.5*SS, wick_tip_y - 2.5*SS),
            (wick_x - 2.0*SS, wick_tip_y - 4.0*SS),
            (wick_x + 2.0*SS, wick_tip_y - 4.0*SS),
            (wick_x + 4.5*SS, wick_tip_y - 2.5*SS),
            (wick_x + 3.5*SS, wick_tip_y + SS)
        ]
        flame_draw.polygon(blue_pts, fill=(55, 140, 255, 220))
        flame_draw.ellipse([wick_x - 2*SS, wick_tip_y - 3*SS, wick_x + 2*SS, wick_tip_y], fill=(130, 210, 255, 240))
        
        # 2g. Rising Micro-Embers
        for e in range(4):
            e_phase = phase + e * (math.pi * 0.5)
            e_life = (e_phase / (2.0 * math.pi)) % 1.0
            e_y = (wick_tip_y - 2*SS) - e_life * (flame_h * 1.35)
            drift = math.sin(e_phase * 2.5) * 5.0 * SS + math.cos(e_life * 7.0) * 3.0 * SS
            e_x = wick_x + drift
            e_alpha = int(255 * math.sin(e_life * math.pi) ** 0.8)
            if e_alpha > 15:
                rad = max(1.0, (1.2 - e_life * 0.6) * SS)
                flame_draw.ellipse([e_x - rad*1.8, e_y - rad*1.8, e_x + rad*1.8, e_y + rad*1.8], fill=(255, 120, 20, int(e_alpha * 0.5)))
                flame_draw.ellipse([e_x - rad, e_y - rad, e_x + rad, e_y + rad], fill=(255, 240, 150, e_alpha))
        
        # Dual-stage Bloom Aura
        glow_wide = flame_layer_ss.filter(ImageFilter.GaussianBlur(radius=7.0 * SS))
        glow_tight = flame_layer_ss.filter(ImageFilter.GaussianBlur(radius=2.5 * SS))
        
        frame_ss = Image.alpha_composite(frame_ss, glow_wide)
        frame_ss = Image.alpha_composite(frame_ss, glow_tight)
        frame_ss = Image.alpha_composite(frame_ss, flame_layer_ss)
        
        frame_final = frame_ss.resize((CELL_W, CELL_H), resample=Image.Resampling.LANCZOS)
        sheet.paste(frame_final, (f * CELL_W, 0))
    
    sheet.save('assets/torch_fire.png')
    print('Successfully generated assets/torch_fire.png')

if __name__ == '__main__':
    generate_torch_sheet()
