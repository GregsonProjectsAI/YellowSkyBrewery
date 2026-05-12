import cv2
from transparent_background import Remover
from PIL import Image
import os
import argparse

def main():
    parser = argparse.ArgumentParser(description="Remove background from a video and extract frames as transparent PNGs.")
    parser.add_argument("--source", type=str, required=True, help="Path to the input video file (e.g., input.mp4)")
    parser.add_argument("--dest", type=str, required=True, help="Directory to save the transparent PNG frames")
    args = parser.parse_args()

    video_path = args.source
    output_dir = args.dest

    if not os.path.exists(video_path):
        print(f"Error: Source video '{video_path}' not found.")
        return

    os.makedirs(output_dir, exist_ok=True)
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"Video loaded: {total_frames} total frames.")
    print("Checking for existing frames to resume progress...")

    # Initialize remover only when we are sure we need it (saves time if already done)
    remover = None
    
    count = 1
    processed_this_session = 0
    skipped = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        output_filename = os.path.join(output_dir, f'frame_{count:03d}.png')
        
        # RESUME CAPABILITY: If the frame already exists, skip processing
        if os.path.exists(output_filename):
            skipped += 1
            count += 1
            continue

        # Lazy load the AI model only when we hit an un-processed frame
        if remover is None:
            print("Initializing InSPyReNet AI Model (this might take a moment...)")
            remover = Remover()

        if processed_this_session % 10 == 0:
            print(f"Processing frame {count}/{total_frames}...")
            
        # Convert BGR (OpenCV) to RGB (PIL)
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img_pil = Image.fromarray(img_rgb)
        
        # Process the image through the AI
        out = remover.process(img_pil)
        out.save(output_filename)
        
        processed_this_session += 1
        count += 1

    cap.release()
    print(f"\nDone! Skipped {skipped} existing frames. Processed {processed_this_session} new frames.")
    print(f"Total transparent frames available in '{output_dir}': {count-1}")

if __name__ == "__main__":
    main()
