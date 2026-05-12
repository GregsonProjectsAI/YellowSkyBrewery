import cv2
import os
import glob
from PIL import Image

src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "darts_sampled_frames"))
all_png_files = sorted(glob.glob(os.path.join(src_dir, "frame_*.png")))

# Filter for frames 154 to 187
png_files = []
for f in all_png_files:
    basename = os.path.basename(f)
    frame_num = int(basename.replace("frame_", "").replace(".png", ""))
    if 154 <= frame_num <= 187:
        png_files.append(f)

print(f"Found {len(png_files)} frames in the target range (154-187).")
print("\n=== INSTRUCTIONS ===")
print("1. Click and drag the LEFT mouse button to ERASE.")
print("2. Press the SPACEBAR to save the frame and go to the next one.")
print("3. Press 'R' to reset the current frame.")
print("4. Press 'Q' to quit.")
print("====================\n")

drawing = False
brush_size = 30 
img_display = None
img_alpha = None
window_name = 'Targeted Eraser (154-187) - SPACE to Next'

def draw_mask(event, x, y, flags, param):
    global drawing, img_display, img_alpha
    if event == cv2.EVENT_LBUTTONDOWN:
        drawing = True
        cv2.circle(img_alpha, (x, y), brush_size, 0, -1)
        cv2.circle(img_display, (x, y), brush_size, (0, 0, 0), -1)
        cv2.imshow(window_name, img_display)
    elif event == cv2.EVENT_MOUSEMOVE:
        if drawing:
            cv2.circle(img_alpha, (x, y), brush_size, 0, -1)
            cv2.circle(img_display, (x, y), brush_size, (0, 0, 0), -1)
            cv2.imshow(window_name, img_display)
    elif event == cv2.EVENT_LBUTTONUP:
        drawing = False
        cv2.circle(img_alpha, (x, y), brush_size, 0, -1)
        cv2.circle(img_display, (x, y), brush_size, (0, 0, 0), -1)
        cv2.imshow(window_name, img_display)

cv2.namedWindow(window_name)
cv2.setMouseCallback(window_name, draw_mask)

for file in png_files:
    original_img = cv2.imread(file, cv2.IMREAD_UNCHANGED)
    if original_img is None or original_img.shape[2] != 4:
        continue
    
    img_alpha = original_img[:, :, 3].copy()
    img_display = original_img[:, :, 0:3].copy()
    img_display[img_alpha == 0] = [0, 0, 0]
    
    cv2.imshow(window_name, img_display)
    
    while True:
        k = cv2.waitKey(10) & 0xFF
        if k == ord(' '): 
            original_img[:, :, 3] = img_alpha
            cv2.imwrite(file, original_img)
            print(f"Saved: {os.path.basename(file)}")
            break
        elif k == ord('r') or k == ord('R'): 
            img_alpha = original_img[:, :, 3].copy()
            img_display = original_img[:, :, 0:3].copy()
            img_display[img_alpha == 0] = [0, 0, 0]
            cv2.imshow(window_name, img_display)
        elif k == ord('q') or k == ord('Q'): 
            cv2.destroyAllWindows()
            exit(0)

cv2.destroyAllWindows()

# Automatically update the solid JPGs for these newly edited frames!
dest_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "darts_solid_frames"))
os.makedirs(dest_dir, exist_ok=True)

print("\nUpdating the solid JPGs for EbSynth...")
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

print("All done! JPGs successfully updated.")
