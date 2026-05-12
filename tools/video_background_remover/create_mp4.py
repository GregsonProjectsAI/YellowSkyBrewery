import cv2
import os
import glob

src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "darts_solid_frames"))
output_video_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "darts_solid_video.mp4"))

# Get all JPG frames and sort them numerically
jpg_files = sorted(glob.glob(os.path.join(src_dir, "frame_*.jpg")))

if not jpg_files:
    print("No frames found!")
    exit(1)

print(f"Found {len(jpg_files)} frames. Generating MP4...")

# Read the first frame to get the exact width and height for the video
first_frame = cv2.imread(jpg_files[0])
height, width, layers = first_frame.shape

# Define the codec and create VideoWriter object
# 'mp4v' is the standard codec for .mp4 files in OpenCV
fourcc = cv2.VideoWriter_fourcc(*'mp4v')

# Since we originally extracted every 3rd frame from what was likely a 30fps video,
# we need to set the video playback to 10fps so it plays at normal speed!
fps = 10 
video = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))

for i, image_path in enumerate(jpg_files):
    img = cv2.imread(image_path)
    video.write(img)
    
    if i % 10 == 0:
        print(f"Processed {i}/{len(jpg_files)} frames...")

# Cleanup
video.release()
print(f"Success! MP4 perfectly stitched and saved to: {output_video_path}")
