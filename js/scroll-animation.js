        const canvas = document.getElementById('animation-canvas');
        const ctx = canvas.getContext('2d');
        const loadingEl = document.getElementById('loading');
        const scrollHint = document.getElementById('scroll-hint');
        const demoContent = document.getElementById('demo-content');
        
        const frameCount = 192;
        const images = [];
        let loadedImages = 0;

        // Configuration for the images we just generated
        const imagePrefix = 'assets/flow_frames/frame_';
        const imageExtension = '.jpg';

        // Set canvas resolution to match the source video resolution (1920x1080)
        canvas.width = 1920;
        canvas.height = 1080;

        // Preload all images so the scroll is buttery smooth
        for (let i = 1; i <= frameCount; i++) {
            const img = new Image();
            // Pad index with zeros (e.g., 0001, 0002)
            const paddedIndex = i.toString().padStart(4, '0');
            const imagePath = `${imagePrefix}${paddedIndex}${imageExtension}`;
            
            img.src = imagePath;
            img.onload = () => {
                loadedImages++;
                loadingEl.innerText = `Loading Assets... ${Math.round((loadedImages / frameCount) * 100)}%`;
                
                // If all images are successfully loaded
                if (loadedImages === frameCount) {
                    loadingEl.style.display = 'none';
                    scrollHint.style.display = 'block';
                    canvas.style.opacity = '1';
                    
                    // Draw the very first frame immediately
                    renderFrame(0);
                }
            };
            images.push(img);
        }

        // Draw the specific frame to canvas
        function renderFrame(index) {
            if (images[index] && images[index].complete) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(images[index], 0, 0, canvas.width, canvas.height);
            }
        }

        const scrollContainer = document.querySelector('.scroll-container');

        // Update the animation on scroll
        window.addEventListener('scroll', () => {
            // Calculate how far down the user has scrolled
            const scrollTop = window.scrollY;
            // The total scroll distance for the entire container
            const totalScrollDistance = scrollContainer.offsetHeight - window.innerHeight;
            
            // Get a value from 0.0 (top) to 1.0 (bottom of the 600vh container)
            let scrollFraction = 0;
            if (totalScrollDistance > 0) {
                scrollFraction = Math.max(0, Math.min(1, scrollTop / totalScrollDistance));
            }
            
            // We want the video animation to finish at 5/6 of the scroll (which is 500vh out of 600vh)
            const videoEndFraction = 5 / 6;
            
            // Calculate progress strictly for the video portion (0.0 to 1.0)
            const videoProgress = Math.min(1, scrollFraction / videoEndFraction);
            
            // Determine which frame corresponds to the current video progress
            const frameIndex = Math.min(
                frameCount - 1,
                Math.floor(videoProgress * frameCount)
            );
            
            // Render it via requestAnimationFrame for max performance
            requestAnimationFrame(() => renderFrame(frameIndex));
            
            // Hide the scroll hint once they start scrolling
            if (scrollTop > 50) {
                scrollHint.style.opacity = '0';
                scrollHint.style.transition = 'opacity 0.5s';
            } else {
                scrollHint.style.opacity = '1';
            }
            
            // Fade in the logo based on the video progress
            if (videoProgress > 0.4) {
                demoContent.style.opacity = Math.min(1, (videoProgress - 0.4) * 3);
            } else {
                demoContent.style.opacity = '0';
            }

            // Move the logo to the corner ONLY when scrolling past the video ending point
            if (scrollFraction > videoEndFraction) {
                demoContent.classList.add('is-header');
            } else {
                demoContent.classList.remove('is-header');
            }
        });
