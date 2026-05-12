import cv2
import os
import glob
import numpy as np

src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "darts_sampled_frames"))
dest_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "darts_ink_frames"))

os.makedirs(dest_dir, exist_ok=True)

png_files = sorted(glob.glob(os.path.join(src_dir, "frame_*.png")))
print(f"Found {len(png_files)} frames to stylize into Comic Ink.")

for png_path in png_files:
    img = cv2.imread(png_path, cv2.IMREAD_UNCHANGED)
    if img is None or img.shape[2] != 4:
        continue

    # Extract original alpha cutout
    alpha = img[:, :, 3]
    bgr = img[:, :, 0:3]

    # Convert to grayscale
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    # Apply a slight blur to reduce video noise before calculating edges
    gray = cv2.bilateralFilter(gray, 5, 50, 50)

    # Boost contrast to force stark shadows
    gray = cv2.convertScaleAbs(gray, alpha=1.5, beta=-20)

    # Apply adaptive thresholding to generate distinct, crisp "ink" lines
    # Black lines on white background
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 21, 5)

    # Invert so ink lines are 255 (white) and negative space is 0 (black)
    lines_mask = cv2.bitwise_not(thresh)

    # We want pure black ink (0, 0, 0)
    out_bgr = np.zeros_like(bgr)

    # The new alpha: A pixel is opaque ONLY IF it was opaque in the original cutout AND it is a black ink line.
    # This makes all the skin, shirt, etc. completely transparent so the Yellow Sky background shines through!
    new_alpha = cv2.bitwise_and(alpha, lines_mask)

    # Combine BGR (pure black) with new dynamic alpha
    out_img = np.dstack((out_bgr, new_alpha))

    filename = os.path.basename(png_path)
    dest_path = os.path.join(dest_dir, filename)
    cv2.imwrite(dest_path, out_img)

print(f"Ink stylization complete! Saved perfectly consistent stencil frames to: {dest_dir}")
