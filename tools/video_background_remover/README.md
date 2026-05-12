# Video Background Remover (InSPyReNet)

This tool automatically removes the background from a video file and exports each frame as a transparent PNG. It uses **InSPyReNet** (`transparent-background`), which is an advanced AI model highly specialized for complex human boundaries and low-contrast scenes (it performs significantly better than standard `rembg`/U2-Net).

## Features
- **Highly Accurate:** Specializes in removing backgrounds behind humans even in complex or dark scenes.
- **Auto-Resume Capability:** If the process is paused, killed, or crashes, simply run the exact same command again. The script will automatically skip all frames that have already been generated and instantly pick up exactly where it left off.
- **Local & Free:** Runs entirely locally on your machine. No subscriptions or internet connection required after the initial model download.

## Requirements

Ensure you have Python installed, then install the required dependencies:

```bash
pip install transparent-background opencv-python Pillow
```
*(Note: On the first run, the AI model weights will automatically download to your machine. This is a one-time download of approx ~150MB).*

## How to Use

Run the script from your terminal, passing in the `--source` video file and the `--dest` folder where you want the transparent frames to be saved.

```bash
python video_background_remover.py --source "path/to/your/video.mp4" --dest "path/to/output_folder"
```

### Example:
```bash
python video_background_remover.py --source "../../assets/AI images of the crew/ColDarts.mp4" --dest "../../assets/darts_transparent_frames"
```

## Pausing & Resuming
To **pause** the script at any time, press `Ctrl + C` in your terminal. 

To **resume**, just hit the `Up Arrow` in your terminal to bring up your exact same command, and press `Enter`. The script will instantly skip the existing PNG files and resume rendering the next frame.
