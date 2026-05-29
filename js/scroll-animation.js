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

        // --- Scroll zones (fractions of scroll travel) ---
        //   0              → ANIM_END      : animation plays frame by frame (all 192 frames)
        //   ANIM_END       → HOLD_END      : frozen on last frame, fully opaque ("pint stands proud")
        //   HOLD_END       → FADE_END      : canvas dissolves into brewery backdrop
        //   FADE_END       → LOGO_MOVE_START: canvas gone, logo stays centred and large
        //   LOGO_MOVE_START → 1.0          : logo shrinks and locks to corner
        const ANIM_END        = 555 / 700;  // 0.793 — animation finishes, fade begins almost immediately
        const HOLD_END        = 560 / 700;  // 0.800 — minimal hold
        const FADE_END        = 640 / 700;  // 0.914 — fade complete
        const LOGO_MOVE_START = 655 / 700;  // 0.936 — logo moves to corner AFTER fade

        // Glint fires between the 6th and 7th of the 9 static fade frames
        // Fade zone = HOLD_END→FADE_END (80 units). Frame 6.5 midpoint = 560 + (5.5/9)*80 ≈ 609
        const GLINT_TRIGGER = 609 / 700;
        const glintEl = document.getElementById('canvas-glint');
        let glintFired = false;

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

            // Logo/overlay fades in during the animation — stays centred and large
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

            // Logo moves to corner only AFTER the canvas fade is fully complete
            // This ensures the large logo is visible during the entire pint dissolve
            if (scrollFraction > LOGO_MOVE_START) {
                demoContent.classList.add('is-header');
            } else {
                demoContent.classList.remove('is-header');
            }

            // ── Glint effect ─────────────────────────────────────────────────
            // Fires once between the 6th and 7th fade frame; resets on scroll-back
            if (scrollFraction >= GLINT_TRIGGER && scrollFraction < FADE_END && !glintFired) {
                glintFired = true;
                if (glintEl) {
                    glintEl.classList.remove('is-glinting');
                    void glintEl.offsetWidth; // force reflow so animation restarts cleanly
                    glintEl.classList.add('is-glinting');
                }
            }
            if (scrollFraction < GLINT_TRIGGER - 0.025) {
                if (glintFired) {
                    glintFired = false;
                    if (glintEl) glintEl.classList.remove('is-glinting');
                }
            }
