import os
import glob
from PIL import Image

src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "Col Animation v1"))
dest_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "Col Animation v1 Webp"))

os.makedirs(dest_dir, exist_ok=True)

jpeg_files = sorted(glob.glob(os.path.join(src_dir, "*.jpeg")))
print(f"Found {len(jpeg_files)} files to convert.")

for file in jpeg_files:
    filename = os.path.basename(file)
    webp_filename = filename.replace(".jpeg", ".webp").replace(".jpg", ".webp")
    dest_path = os.path.join(dest_dir, webp_filename)
    
    img = Image.open(file)
    # Save as WebP
    img.save(dest_path, "WEBP", quality=80)
    print(f"Converted {filename} to {webp_filename}")

print("Done!")
