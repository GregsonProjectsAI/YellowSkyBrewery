import os
import shutil

src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "darts_transparent_frames"))
dest_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "darts_sampled_frames"))

print(f"Source: {src_dir}")
print(f"Destination: {dest_dir}")

os.makedirs(dest_dir, exist_ok=True)

copied_count = 0
for i in range(40, 231, 3):
    filename = f"frame_{i:03d}.png"
    src_path = os.path.join(src_dir, filename)
    dest_path = os.path.join(dest_dir, filename)
    
    if os.path.exists(src_path):
        shutil.copy2(src_path, dest_path)
        copied_count += 1
    else:
        print(f"Warning: {filename} not found.")

print(f"Done! Copied {copied_count} frames.")
