import os
from PIL import Image

# Setup paths for frame 229 (the actual final frame in our sequence)
src_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "darts_sampled_frames", "frame_229.png"))
dest_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "darts_sampled_frames", "frame_229_solid.jpg"))

print(f"Reading: {src_path}")

img = Image.open(src_path).convert("RGBA")
bg = Image.new("RGBA", img.size, (0, 0, 0, 255))
bg.paste(img, (0, 0), img)
final_img = bg.convert("RGB")
final_img.save(dest_path, "JPEG", quality=100)

print(f"Success! Saved solid background image to: {dest_path}")
