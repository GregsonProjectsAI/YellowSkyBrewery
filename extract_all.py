import cv2
from transparent_background import Remover
from PIL import Image
import os
import sys

print("Initializing InSPyReNet Remover...")
remover = Remover()

video_path = 'assets/AI images of the crew/ColDarts.mp4'
output_dir = 'assets/darts_transparent_frames'

cap = cv2.VideoCapture(video_path)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
os.makedirs(output_dir, exist_ok=True)

print(f"Starting extraction of {total_frames} frames...")

count = 1
while True:
    ret, frame = cap.read()
    if not ret:
        break
    
    # We log every 10 frames to avoid spamming the console
    if count % 10 == 0:
        print(f"Processing frame {count}/{total_frames}...")
        
    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img_pil = Image.fromarray(img_rgb)
    out = remover.process(img_pil)
    
    # Save with zero-padded names so they sort correctly (e.g. frame_001.png)
    out.save(os.path.join(output_dir, f'frame_{count:03d}.png'))
    count += 1

cap.release()
print(f"Done! Extracted {count-1} frames to {output_dir}")
