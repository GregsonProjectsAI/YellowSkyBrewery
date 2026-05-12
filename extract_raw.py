import cv2
import os

cap = cv2.VideoCapture('assets/AI images of the crew/ColDarts.mp4')
os.makedirs('test_raw', exist_ok=True)

for f in [50, 100, 150, 200]:
    cap.set(cv2.CAP_PROP_POS_FRAMES, f)
    ret, frame = cap.read()
    if ret:
        cv2.imwrite(f'test_raw/frame_{f}.jpg', frame)
        print(f"Saved test_raw/frame_{f}.jpg")

cap.release()
