import os
import glob
from PIL import Image

src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "darts_ink_frames"))
dest_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "darts_webp_frames"))

os.makedirs(dest_dir, exist_ok=True)

png_files = sorted(glob.glob(os.path.join(src_dir, "*.png")))

print(f"Found {len(png_files)} PNG files to convert.")

converted_count = 0
for png_path in png_files:
    filename = os.path.basename(png_path)
    base_name, _ = os.path.splitext(filename)
    webp_filename = f"{base_name}.webp"
    webp_path = os.path.join(dest_dir, webp_filename)
    
    with Image.open(png_path) as img:
        # Convert to WebP, preserving transparency
        img.save(webp_path, format="webp", lossless=False, quality=80)
        
    converted_count += 1
    if converted_count % 10 == 0:
        print(f"Converted {converted_count}/{len(png_files)}...")

print(f"Done! Successfully converted {converted_count} frames to WebP.")
print(f"Destination: {dest_dir}")
