const sequenceImg = document.getElementById('colin-sequence');
const textElement = document.getElementById('our-beers-text');
const container = document.getElementById('animation-container');

// Configuration
const frames = [];
let currentFrameIndex = 0;
let isPlaying = false;
let animationPlayed = false;

// Generate filenames (frame_040 to frame_145, step 3)
for (let i = 40; i <= 145; i += 3) {
    const paddedNum = String(i).padStart(3, '0');
    frames.push(`../../assets/Col Animation v1 Webp/frame_${paddedNum}.webp`);
}

// Preload images to avoid flickering
const preloadedImages = [];
let loadedCount = 0;

function preloadImages() {
    frames.forEach((src) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            loadedCount++;
            if (loadedCount === frames.length) {
                console.log('All frames preloaded');
                // Set initial frame
                sequenceImg.src = frames[0];
                setupObserver();
            }
        };
        img.onerror = () => {
            console.error('Failed to load frame:', src);
        }
        preloadedImages.push(img);
    });
}

// Setup IntersectionObserver
function setupObserver() {
    const options = {
        root: null,
        rootMargin: '0px',
        threshold: 0.5 // Trigger when 50% of the container is visible
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !animationPlayed) {
                playAnimation();
            }
        });
    }, options);

    observer.observe(container);
}

// Playback Engine
function playAnimation() {
    if (isPlaying) return;
    isPlaying = true;
    animationPlayed = true; // Only play once per scroll view
    
    // 10 frames per second = 100ms per frame
    const frameDuration = 100;
    
    const interval = setInterval(() => {
        currentFrameIndex++;
        
        if (currentFrameIndex >= frames.length) {
            clearInterval(interval);
            isPlaying = false;
            return;
        }
        
        sequenceImg.src = frames[currentFrameIndex];
        
        // Trigger text fade-in when dart is thrown (around frame index 15)
        if (currentFrameIndex === 15) {
            textElement.classList.add('active');
        }
        
    }, frameDuration);
}

// Start preloading
preloadImages();
