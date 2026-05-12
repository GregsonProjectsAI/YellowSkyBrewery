import cv2
import os
import glob

src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "darts_sampled_frames"))
png_files = sorted(glob.glob(os.path.join(src_dir, "frame_*.png")))

print(f"Found {len(png_files)} frames to clean up.")
print("\n=== INSTRUCTIONS ===")
print("1. Click and drag the LEFT mouse button over the blackboard to ERASE it (turns it black).")
print("2. Press the SPACEBAR to save the frame and go to the next one.")
print("3. Press 'R' to reset the current frame if you accidentally erase Colin.")
print("4. Press 'Q' to quit and close the tool early.")
print("====================\n")

drawing = False
brush_size = 30 # Size of the eraser brush

# Globals for the OpenCV callback
img_display = None
img_alpha = None
window_name = 'Manual Eraser - SPACE to Next, R to Reset, Q to Quit'

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
    
    # Ensure it's a 4-channel transparent PNG
    if original_img is None or original_img.shape[2] != 4:
        continue
        
    # Extract alpha mask and BGR color channels
    img_alpha = original_img[:, :, 3].copy()
    img_display = original_img[:, :, 0:3].copy()
    
    # Pre-blacken pixels that are already fully transparent so you can easily see what to erase
    img_display[img_alpha == 0] = [0, 0, 0]
    
    cv2.imshow(window_name, img_display)
    
    while True:
        k = cv2.waitKey(10) & 0xFF
        
        if k == ord(' '):  # SPACEBAR to save and go next
            original_img[:, :, 3] = img_alpha
            cv2.imwrite(file, original_img)
            print(f"Saved: {os.path.basename(file)}")
            break
            
        elif k == ord('r') or k == ord('R'):  # Reset
            img_alpha = original_img[:, :, 3].copy()
            img_display = original_img[:, :, 0:3].copy()
            img_display[img_alpha == 0] = [0, 0, 0]
            cv2.imshow(window_name, img_display)
            print("Reset current frame.")
            
        elif k == ord('q') or k == ord('Q'):  # Quit
            print("Quitting early.")
            cv2.destroyAllWindows()
            exit(0)

cv2.destroyAllWindows()
print("\nAll done! Frames updated.")
