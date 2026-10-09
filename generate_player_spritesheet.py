#!/usr/bin/env python3
"""
generate_player_spritesheet.py
Generates the authentic "Frail Limbo Boy" spritesheet (assets/player_spritesheet.png).
Features:
- Subtly thin, frail boy proportions (no robes, no wizard cloak)
- Tousled messy hair tufts (iconic Playdead's Limbo silhouette)
- Piercing glowing white circular eyes with soft ethereal bloom
- Slender torso, thin arms, spindly articulated legs
- Standardized 160x160 cells across 5 animation rows (1280x800 RGBA)
"""

import math
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

CELL = 160
NUM_COLS = 8
NUM_ROWS = 5
PIVOT_X = 80
PIVOT_Y = 144

def create_limbo_boy_spritesheet():
    sheet = Image.new('RGBA', (CELL * NUM_COLS, CELL * NUM_ROWS), (0, 0, 0, 0))
    
    # 2x supersampling for razor sharp anti-aliasing and subpixel curves
    SS = 2
    CELL_SS = CELL * SS
    PIV_X_SS = PIVOT_X * SS
    PIV_Y_SS = PIVOT_Y * SS

    def draw_limbo_boy(
        draw,
        torso_x, torso_y,
        lean_angle=0.0,
        breathe=0.0,
        left_leg_angle=0.0, left_knee_bend=0.0,
        right_leg_angle=0.0, right_knee_bend=0.0,
        left_arm_angle=0.0, left_elbow_bend=0.0,
        right_arm_angle=0.0, right_elbow_bend=0.0,
        eye_blink=1.0,
        crouch=False,
        hang=False
    ):
        """Draws the frail boy silhouette with Limbo styling."""
        head_r = 17 * SS
        neck_len = 5 * SS
        torso_len = 24 * SS
        torso_w = 11 * SS
        limb_w = int(3.6 * SS)
        
        # Center coordinates
        tx = torso_x
        ty = torso_y + breathe

        if crouch:
            # Low crouching on all fours
            hip_x, hip_y = tx - 8 * SS, ty + 12 * SS
            chest_x, chest_y = tx + 10 * SS, ty + 8 * SS
            neck_x, neck_y = chest_x + 4 * SS, chest_y - 2 * SS
            head_x, head_y = neck_x + 8 * SS, neck_y - 8 * SS
            
            # Back spine
            draw.line([hip_x, hip_y, chest_x, chest_y], fill=(8, 10, 14, 255), width=int(torso_w * 0.9))
            draw.ellipse([hip_x - 5*SS, hip_y - 4*SS, hip_x + 5*SS, hip_y + 4*SS], fill=(8, 10, 14, 255))
            draw.ellipse([chest_x - 6*SS, chest_y - 5*SS, chest_x + 6*SS, chest_y + 5*SS], fill=(8, 10, 14, 255))
        elif hang:
            # Hanging from ledge
            chest_x, chest_y = tx, ty - 10 * SS
            hip_x, hip_y = tx - 2 * SS, ty + 18 * SS
            head_x, head_y = tx + 2 * SS, chest_y - 14 * SS
            
            # Torso
            draw.line([chest_x, chest_y, hip_x, hip_y], fill=(8, 10, 14, 255), width=torso_w)
            draw.ellipse([chest_x - 5*SS, chest_y - 4*SS, chest_x + 5*SS, chest_y + 4*SS], fill=(8, 10, 14, 255))
            draw.ellipse([hip_x - 5*SS, hip_y - 4*SS, hip_x + 5*SS, hip_y + 4*SS], fill=(8, 10, 14, 255))
        else:
            # Upright standing / running
            rad = math.radians(lean_angle)
            hip_x, hip_y = tx - math.sin(rad) * 6 * SS, ty + 14 * SS
            chest_x, chest_y = tx + math.sin(rad) * 6 * SS, ty - 10 * SS
            head_x = chest_x + math.sin(rad) * 12 * SS
            head_y = chest_y - neck_len - head_r * 0.75

            # Slender child torso (fitted shirt & shorts)
            draw.line([chest_x, chest_y, hip_x, hip_y], fill=(8, 10, 14, 255), width=torso_w)
            draw.ellipse([chest_x - 6*SS, chest_y - 5*SS, chest_x + 6*SS, chest_y + 5*SS], fill=(8, 10, 14, 255))
            draw.ellipse([hip_x - 5*SS, hip_y - 4*SS, hip_x + 5*SS, hip_y + 4*SS], fill=(8, 10, 14, 255))

        # --- 1. Head & Messy Tousled Hair ---
        # Base round child head
        draw.ellipse([head_x - head_r, head_y - head_r, head_x + head_r, head_y + head_r], fill=(8, 10, 14, 255))
        
        # Iconic Limbo messy hair tufts (spiky silhouettes on top and rear of head)
        hair_tufts = [
            (-head_r * 0.7, -head_r * 0.6, -head_r * 1.05, -head_r * 0.95),
            (-head_r * 0.4, -head_r * 0.85, -head_r * 0.65, -head_r * 1.3),
            (-head_r * 0.1, -head_r * 0.95, -head_r * 0.25, -head_r * 1.35),
            (head_r * 0.2, -head_r * 0.9, head_r * 0.15, -head_r * 1.25),
            (head_r * 0.5, -head_r * 0.75, head_r * 0.65, -head_r * 1.1),
            (-head_r * 0.95, -head_r * 0.2, -head_r * 1.3, -head_r * 0.45),
            (-head_r * 0.9, head_r * 0.1, -head_r * 1.25, head_r * 0.05),
        ]
        for bx, by, tx_h, ty_h in hair_tufts:
            draw.polygon([
                (head_x + bx - 2*SS, head_y + by),
                (head_x + tx_h, head_y + ty_h),
                (head_x + bx + 2*SS, head_y + by)
            ], fill=(8, 10, 14, 255))

        # --- 2. Glowing White Piercing Eye (Limbo Style) ---
        if eye_blink > 0.1:
            eye_cx = head_x + head_r * 0.45
            eye_cy = head_y + 1 * SS
            eye_w = 4.2 * SS
            eye_h = 3.5 * SS * eye_blink
            
            # Brilliant white glowing eye
            draw.ellipse([eye_cx - eye_w, eye_cy - eye_h, eye_cx + eye_w, eye_cy + eye_h], fill=(255, 255, 255, 255))
            # Ethereal outer iris glow
            draw.ellipse([eye_cx - eye_w*1.4, eye_cy - eye_h*1.4, eye_cx + eye_w*1.4, eye_cy + eye_h*1.4], outline=(230, 240, 255, 120), width=SS)

        # --- 3. Spindly Legs (Hip -> Knee -> Foot) ---
        thigh_len = 16 * SS
        shin_len = 16 * SS

        def draw_leg(hip_pos, angle_deg, bend_deg, is_front=True):
            rad1 = math.radians(angle_deg)
            kx = hip_pos[0] + math.sin(rad1) * thigh_len
            ky = hip_pos[1] + math.cos(rad1) * thigh_len
            
            rad2 = math.radians(angle_deg + bend_deg)
            fx = kx + math.sin(rad2) * shin_len
            fy = ky + math.cos(rad2) * shin_len
            
            color = (8, 10, 14, 255) if is_front else (4, 6, 8, 255)
            # Thigh
            draw.line([hip_pos[0], hip_pos[1], kx, ky], fill=color, width=limb_w)
            # Shin
            draw.line([kx, ky, fx, fy], fill=color, width=limb_w)
            # Small boy shoe / foot
            draw.line([fx - SS, fy, fx + 5 * SS, fy + SS], fill=color, width=int(limb_w * 1.1))

        # Back leg first, then front leg
        draw_leg((hip_x - 2*SS, hip_y), right_leg_angle, right_knee_bend, is_front=False)
        draw_leg((hip_x + 2*SS, hip_y), left_leg_angle, left_knee_bend, is_front=True)

        # --- 4. Slender Arms (Shoulder -> Elbow -> Hand) ---
        upper_arm_len = 13 * SS
        forearm_len = 13 * SS

        def draw_arm(shoulder_pos, angle_deg, bend_deg, is_front=True):
            rad1 = math.radians(angle_deg)
            ex = shoulder_pos[0] + math.sin(rad1) * upper_arm_len
            ey = shoulder_pos[1] + math.cos(rad1) * upper_arm_len
            
            rad2 = math.radians(angle_deg + bend_deg)
            hx = ex + math.sin(rad2) * forearm_len
            hy = ey + math.cos(rad2) * forearm_len
            
            color = (8, 10, 14, 255) if is_front else (4, 6, 8, 255)
            draw.line([shoulder_pos[0], shoulder_pos[1], ex, ey], fill=color, width=limb_w)
            draw.line([ex, ey, hx, hy], fill=color, width=limb_w)
            # Small hand knob
            draw.ellipse([hx - 2*SS, hy - 2*SS, hx + 2*SS, hy + 2*SS], fill=color)

        if not hang and not crouch:
            # Back arm behind chest
            draw_arm((chest_x - 3*SS, chest_y), right_arm_angle, right_elbow_bend, is_front=False)
            # Front arm in front
            draw_arm((chest_x + 3*SS, chest_y), left_arm_angle, left_elbow_bend, is_front=True)
        elif hang:
            # Both arms reaching up grasping ledge lip
            draw.line([chest_x - 2*SS, chest_y, chest_x + 8*SS, chest_y - 28*SS], fill=(8, 10, 14, 255), width=limb_w)
            draw.line([chest_x + 2*SS, chest_y, chest_x + 12*SS, chest_y - 30*SS], fill=(8, 10, 14, 255), width=limb_w)
            # Hands clutching stone lip
            draw.ellipse([chest_x + 6*SS, chest_y - 32*SS, chest_x + 14*SS, chest_y - 26*SS], fill=(8, 10, 14, 255))
        elif crouch:
            # Arms supporting crouch
            draw_arm((chest_x - 2*SS, chest_y), 45, 30, is_front=False)
            draw_arm((chest_x + 2*SS, chest_y), 30, 45, is_front=True)

    # --- Render All 5 Rows ---
    for row in range(NUM_ROWS):
        if row == 0:
            # ================= IDLE (6 frames) =================
            for f in range(6):
                phase = (f / 6.0) * 2.0 * math.pi
                breathe = math.sin(phase) * 1.8 * SS
                blink = 0.2 if f == 3 else 1.0 # subtle blink on frame 3
                
                frame_ss = Image.new('RGBA', (CELL_SS, CELL_SS), (0, 0, 0, 0))
                draw = ImageDraw.Draw(frame_ss)
                
                draw_limbo_boy(
                    draw,
                    torso_x=PIV_X_SS,
                    torso_y=PIV_Y_SS - 46 * SS,
                    lean_angle=3.0,
                    breathe=breathe,
                    left_leg_angle=4.0, left_knee_bend=0.0,
                    right_leg_angle=-4.0, right_knee_bend=0.0,
                    left_arm_angle=20.0, left_elbow_bend=45.0, # front arm holding torch
                    right_arm_angle=-10.0, right_elbow_bend=15.0,
                    eye_blink=blink
                )
                
                frame = frame_ss.resize((CELL, CELL), resample=Image.Resampling.LANCZOS)
                sheet.paste(frame, (f * CELL, row * CELL))
                
        elif row == 1:
            # ================= RUN (8 frames) =================
            # Kinetic 8-frame walk/run cycle for thin boy
            run_data = [
                # (lean, l_leg, l_knee, r_leg, r_knee, l_arm, r_arm)
                (10.0, 32.0, 15.0, -38.0, 50.0, -25.0, 35.0),  # 0: left contact
                (12.0, 18.0, 10.0, -20.0, 65.0, -10.0, 20.0),  # 1: passing
                (14.0, -15.0, 25.0, 15.0, 20.0, 15.0, -10.0),  # 2: right drive
                (12.0, -38.0, 55.0, 34.0, 10.0, 30.0, -25.0),  # 3: right extension
                (10.0, -35.0, 50.0, 30.0, 15.0, 35.0, -25.0),  # 4: right contact
                (12.0, -18.0, 60.0, 16.0, 10.0, 20.0, -10.0),  # 5: passing
                (14.0, 15.0, 20.0, -15.0, 25.0, -10.0, 15.0),  # 6: left drive
                (12.0, 35.0, 10.0, -36.0, 55.0, -25.0, 30.0),  # 7: left extension
            ]
            for f in range(8):
                lean, lla, llk, rla, rlk, laa, raa = run_data[f]
                bob = abs(math.sin(f * math.pi / 4.0)) * 3.5 * SS
                
                frame_ss = Image.new('RGBA', (CELL_SS, CELL_SS), (0, 0, 0, 0))
                draw = ImageDraw.Draw(frame_ss)
                
                draw_limbo_boy(
                    draw,
                    torso_x=PIV_X_SS + 2 * SS,
                    torso_y=PIV_Y_SS - 46 * SS + bob,
                    lean_angle=lean,
                    breathe=0.0,
                    left_leg_angle=lla, left_knee_bend=llk,
                    right_leg_angle=rla, right_knee_bend=rlk,
                    left_arm_angle=laa + 15.0, left_elbow_bend=35.0,
                    right_arm_angle=raa, right_elbow_bend=20.0,
                    eye_blink=1.0
                )
                
                frame = frame_ss.resize((CELL, CELL), resample=Image.Resampling.LANCZOS)
                sheet.paste(frame, (f * CELL, row * CELL))
                
        elif row == 2:
            # ================= JUMP (6 frames) =================
            jump_data = [
                # 0: Launch anticipation (compress)
                (5.0, 20.0, 40.0, 15.0, 45.0, -30.0, -25.0, 10.0 * SS),
                # 1: Rising leap (stretch upward)
                (12.0, -15.0, 20.0, -25.0, 15.0, 35.0, -15.0, -4.0 * SS),
                # 2: Apex float (knees tucked)
                (8.0, 25.0, 50.0, 15.0, 55.0, 25.0, 10.0, -6.0 * SS),
                # 3: Glide
                (6.0, 10.0, 25.0, -5.0, 30.0, 15.0, -5.0, -2.0 * SS),
                # 4: Fall descent (legs extending)
                (4.0, -5.0, 15.0, 5.0, 10.0, 5.0, -10.0, 2.0 * SS),
                # 5: Landing anticipation (absorbing impact)
                (6.0, 22.0, 35.0, 18.0, 40.0, -15.0, -10.0, 8.0 * SS),
            ]
            for f in range(6):
                lean, lla, llk, rla, rlk, laa, raa, y_off = jump_data[f]
                
                frame_ss = Image.new('RGBA', (CELL_SS, CELL_SS), (0, 0, 0, 0))
                draw = ImageDraw.Draw(frame_ss)
                
                draw_limbo_boy(
                    draw,
                    torso_x=PIV_X_SS,
                    torso_y=PIV_Y_SS - 46 * SS + y_off,
                    lean_angle=lean,
                    left_leg_angle=lla, left_knee_bend=llk,
                    right_leg_angle=rla, right_knee_bend=rlk,
                    left_arm_angle=laa, left_elbow_bend=30.0,
                    right_arm_angle=raa, right_elbow_bend=25.0,
                    eye_blink=1.0
                )
                
                frame = frame_ss.resize((CELL, CELL), resample=Image.Resampling.LANCZOS)
                sheet.paste(frame, (f * CELL, row * CELL))
                
        elif row == 3:
            # ================= CRAWL & SLIDE (6 frames) =================
            for f in range(6):
                frame_ss = Image.new('RGBA', (CELL_SS, CELL_SS), (0, 0, 0, 0))
                draw = ImageDraw.Draw(frame_ss)
                
                if f == 3:
                    # Frame 3 is Sprint Slide
                    draw.polygon([
                        (PIV_X_SS - 24*SS, PIV_Y_SS - 8*SS),
                        (PIV_X_SS + 18*SS, PIV_Y_SS - 14*SS),
                        (PIV_X_SS + 24*SS, PIV_Y_SS - 6*SS),
                        (PIV_X_SS - 20*SS, PIV_Y_SS - 2*SS)
                    ], fill=(8, 10, 14, 255))
                    # Head low in slide
                    draw.ellipse([PIV_X_SS + 16*SS, PIV_Y_SS - 24*SS, PIV_X_SS + 32*SS, PIV_Y_SS - 8*SS], fill=(8, 10, 14, 255))
                    # Eye in slide
                    draw.ellipse([PIV_X_SS + 27*SS, PIV_Y_SS - 18*SS, PIV_X_SS + 31*SS, PIV_Y_SS - 14*SS], fill=(255, 255, 255, 255))
                else:
                    # Low crawl on all fours
                    crawl_phase = (f / 5.0) * math.pi * 2
                    draw_limbo_boy(
                        draw,
                        torso_x=PIV_X_SS - 6 * SS,
                        torso_y=PIV_Y_SS - 22 * SS,
                        crouch=True,
                        left_leg_angle=60.0 + math.sin(crawl_phase)*20, left_knee_bend=60.0,
                        right_leg_angle=70.0 - math.sin(crawl_phase)*20, right_knee_bend=55.0,
                        breathe=math.sin(crawl_phase)*SS
                    )
                
                frame = frame_ss.resize((CELL, CELL), resample=Image.Resampling.LANCZOS)
                sheet.paste(frame, (f * CELL, row * CELL))
                
        elif row == 4:
            # ================= HANG & MANTLE (6 frames) =================
            for f in range(6):
                frame_ss = Image.new('RGBA', (CELL_SS, CELL_SS), (0, 0, 0, 0))
                draw = ImageDraw.Draw(frame_ss)
                
                sway = math.sin(f * 0.8) * 3.0
                draw_limbo_boy(
                    draw,
                    torso_x=PIV_X_SS - 4 * SS + sway * SS,
                    torso_y=PIV_Y_SS - 50 * SS,
                    hang=True,
                    left_leg_angle=-8.0 + sway, left_knee_bend=15.0,
                    right_leg_angle=-14.0 + sway, right_knee_bend=25.0
                )
                
                frame = frame_ss.resize((CELL, CELL), resample=Image.Resampling.LANCZOS)
                sheet.paste(frame, (f * CELL, row * CELL))

    sheet.save('assets/player_spritesheet.png')
    print('Generated authentic Limbo frail boy spritesheet at assets/player_spritesheet.png (1280x800 RGBA)!')

if __name__ == '__main__':
    create_limbo_boy_spritesheet()
