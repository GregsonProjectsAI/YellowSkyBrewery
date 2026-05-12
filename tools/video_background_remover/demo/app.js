const sequenceImg = document.getElementById('colin-sequence');
const dart = document.getElementById('css-dart');
const scrollContainer = document.querySelector('.scroll-container');

// Video configuration
const totalFrames = 64;
const startFrame = 40;
const frameStep = 3;

// We estimate the dart leaves his hand around 60% of the way through the clip
const throwFrameIndex = Math.floor(totalFrames * 0.60); 

let currentFrameIndex = 0;
let dartFired = false;

// 1. PRELOAD IMAGES
// We preload all 64 WebP frames into memory immediately. 
// This guarantees zero flickering or loading delays while scrolling.
const preloadedImages = [];
for (let i = 0; i < totalFrames; i++) {
    const frameNum = startFrame + (i * frameStep);
    // Ensure numbers are padded like frame_040.webp
    const paddedNum = String(frameNum).padStart(3, '0');
    const url = `../../../assets/darts_webp_frames/frame_${paddedNum}.webp`;
    
    preloadedImages.push(url);
    
    const img = new Image();
    img.src = url;
}

// 2. SCROLL LISTENER
window.addEventListener('scroll', () => {
    // Get the exact dimensions and position of our tall scroll container
    const containerRect = scrollContainer.getBoundingClientRect();
    
    // Calculate how much distance is actually scrollable within the container
    const scrollableDistance = containerRect.height - window.innerHeight;
    
    // Calculate scroll progress strictly inside the container (0 to 1)
    let scrollFraction = -containerRect.top / scrollableDistance;
    
    // Clamp the fraction between 0 and 1 so we don't try to load frame -5 or 80
    scrollFraction = Math.max(0, Math.min(1, scrollFraction));
    
    // Map the scroll fraction (0 to 1) to our array of frames (0 to 63)
    const newFrameIndex = Math.floor(scrollFraction * (totalFrames - 1));
    
    // Only update the DOM if the frame actually changed
    if (newFrameIndex !== currentFrameIndex) {
        currentFrameIndex = newFrameIndex;
        sequenceImg.src = preloadedImages[currentFrameIndex];
        
        // 3. TRIGGER DART ANIMATION
        // If we hit the exact frame where his arm extends, fire the dart!
        if (currentFrameIndex >= throwFrameIndex && !dartFired) {
            dart.classList.remove('hidden');
            dart.classList.add('flying');
            dartFired = true;
        } 
        // If the user scrolls backwards up the page, reset the dart
        else if (currentFrameIndex < throwFrameIndex && dartFired) {
            dart.classList.remove('flying');
            dart.classList.add('hidden');
            dartFired = false;
        }
    }
});
