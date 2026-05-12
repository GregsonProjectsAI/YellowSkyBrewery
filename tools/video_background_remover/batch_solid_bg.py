import os
import glob
from PIL import Image

src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "darts_sampled_frames"))
dest_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "darts_solid_frames"))

os.makedirs(dest_dir, exist_ok=True)

png_files = sorted(glob.glob(os.path.join(src_dir, "frame_*.png")))
print(f"Found {len(png_files)} transparent frames.")
print("Adding solid black backgrounds to ALL frames for EbSynth...")

for png_path in png_files:
    filename = os.path.basename(png_path)
    base_name, _ = os.path.splitext(filename)
    jpg_filename = f"{base_name}.jpg"
    dest_path = os.path.join(dest_dir, jpg_filename)
    
    with Image.open(png_path) as img:
        img = img.convert("RGBA")
        bg = Image.new("RGBA", img.size, (0, 0, 0, 255))
        bg.paste(img, (0, 0), img)
        final_img = bg.convert("RGB")
        final_img.save(dest_path, "JPEG", quality=100)

print(f"Success! All frames converted and saved to: {dest_dir}")
