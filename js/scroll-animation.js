        const canvas = document.getElementById('animation-canvas');
        const ctx = canvas.getContext('2d');
        const loadingEl = document.getElementById('loading');
        const scrollHint = document.getElementById('scroll-hint');
        const demoContent = document.getElementById('demo-content');

        const frameCount = 192;
        const images = [];
        let loadedImages = 0;

        const imagePrefix = 'assets/flow_frames/frame_';
        const imageExtension = '.jpg';

        // Set canvas resolution to match source video (1920x1080)
        canvas.width = 1920;
        canvas.height = 1080;

        // Preload all frames for buttery smooth playback
        for (let i = 1; i <= frameCount; i++) {
            const img = new Image();
            const paddedIndex = i.toString().padStart(4, '0');
            img.src = `${imagePrefix}${paddedIndex}${imageExtension}`;

            img.onload = () => {
                loadedImages++;
                loadingEl.innerText = `Loading Assets... ${Math.round((loadedImages / frameCount) * 100)}%`;

                if (loadedImages === frameCount) {
                    loadingEl.style.display = 'none';
                    scrollHint.style.display = 'block';
                    canvas.style.opacity = '1';

                    // Remove CSS transition after load fade-in — scroll drives opacity directly after that
                    setTimeout(() => { canvas.style.transition = 'none'; }, 1100);

                    renderFrame(0);
                }
            };
            images.push(img);
        }

        // Draw a specific frame to the canvas
        function renderFrame(index) {
            if (images[index] && images[index].complete) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(images[index], 0, 0, canvas.width, canvas.height);
            }
        }

        const scrollContainer = document.querySelector('.scroll-container');

        // --- Scroll zones (fractions of 800vh total travel; container is 900vh) ---
        //   0     → ANIM_END  : animation plays frame by frame
        //   ANIM_END → HOLD_END: frozen on last frame, fully opaque ("pint stands proud")
        //   HOLD_END → FADE_END: canvas dissolves into brewery backdrop
        //   FADE_END → 1.0    : canvas gone, logo locks to corner
        const ANIM_END = 500 / 700;   // 0.714  — animation finishes
        const HOLD_END = 575 / 700;   // 0.821  — hold ends (~75vh, ≈1.5s)
        const FADE_END = 650 / 700;   // 0.929  — fade complete, logo locks (~50vh left)

        window.addEventListener('scroll', () => {
            const scrollTop = window.scrollY;
            const totalScrollDistance = scrollContainer.offsetHeight - window.innerHeight;

            let scrollFraction = 0;
            if (totalScrollDistance > 0) {
                scrollFraction = Math.max(0, Math.min(1, scrollTop / totalScrollDistance));
            }

            // Video progress — only advances during the animation zone
            const videoProgress = Math.min(1, scrollFraction / ANIM_END);

            // Frame index clamps at the last frame during hold + fade
            const frameIndex = Math.min(frameCount - 1, Math.floor(videoProgress * frameCount));
            requestAnimationFrame(() => renderFrame(frameIndex));

            // Scroll hint disappears once scrolling starts
            if (scrollTop > 50) {
                scrollHint.style.opacity = '0';
                scrollHint.style.transition = 'opacity 0.5s';
            } else {
                scrollHint.style.opacity = '1';
            }

            // Logo/overlay fades in during the animation
            if (videoProgress > 0.4) {
                demoContent.style.opacity = Math.min(1, (videoProgress - 0.4) * 3);
            } else {
                demoContent.style.opacity = '0';
            }

            // Canvas opacity — hold fully visible, then dissolve into brewery backdrop
            if (scrollFraction < HOLD_END) {
                canvas.style.opacity = '1';
            } else if (scrollFraction < FADE_END) {
                const fadeProgress = (scrollFraction - HOLD_END) / (FADE_END - HOLD_END);
                canvas.style.opacity = Math.max(0, 1 - fadeProgress).toString();
            } else {
                canvas.style.opacity = '0';
            }

            // Logo snaps to corner once the fade is complete
            if (scrollFraction > FADE_END) {
                demoContent.classList.add('is-header');
            } else {
                demoContent.classList.remove('is-header');
            }
        });
