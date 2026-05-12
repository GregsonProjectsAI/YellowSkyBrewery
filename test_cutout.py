import cv2
from transparent_background import Remover
from PIL import Image
import os

print("Initializing Remover (might download model...)")
remover = Remover()

cap = cv2.VideoCapture('assets/AI images of the crew/ColDarts.mp4')
os.makedirs('test_cutouts', exist_ok=True)

frames_to_test = [50, 100, 150, 200]

for f in frames_to_test:
    cap.set(cv2.CAP_PROP_POS_FRAMES, f)
    ret, frame = cap.read()
    if ret:
        print(f"Processing frame {f}...")
        # Convert BGR to RGB
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img_pil = Image.fromarray(img_rgb)
        out = remover.process(img_pil)
        out.save(f'test_cutouts/frame_{f}.png')
        print(f"Saved test_cutouts/frame_{f}.png")

cap.release()
print("Done!")
