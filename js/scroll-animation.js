        const canvas      = document.getElementById('animation-canvas');
        const ctx         = canvas.getContext('2d');
        const loadingEl   = document.getElementById('loading');
        const scrollHint  = document.getElementById('scroll-hint');
        const demoContent = document.getElementById('demo-content');
        const backdropEl  = document.querySelector('.page-backdrop');

        const frameCount = 192;
        const images = [];
        let loadedImages = 0;

        // Mobile devices get a compressed frame set (960×540) to cut load from
        // 47 MB down to ~11 MB. Desktop is completely unchanged.
        const isMobile    = window.innerWidth < 768 || navigator.maxTouchPoints > 1;
        const imagePrefix = isMobile ? 'assets/flow_frames_mobile/frame_' : 'assets/flow_frames/frame_';
        const imageExtension = '.jpg';

        // Canvas resolution matches source: 960×540 on mobile, 1920×1080 on desktop
        canvas.width  = isMobile ? 960  : 1920;
        canvas.height = isMobile ? 540  : 1080;

        // Preload all frames for buttery smooth playback
        const loadingTextEl = document.getElementById('loading-text');
        const skipBtn       = document.getElementById('skip-animation-btn');

        function onFrameSettled() {
            loadedImages++;
            if (loadingTextEl) {
                loadingTextEl.innerText = `Loading Assets... ${Math.round((loadedImages / frameCount) * 100)}%`;
            }
            if (loadedImages === frameCount) {
                clearTimeout(loadingTimeout);
                clearTimeout(slowTimeout);
                startPlayback();
            }
        }

        function startPlayback() {
            loadingEl.style.display = 'none';
            scrollHint.style.display = 'block';
            canvas.style.opacity = '1';
            setTimeout(() => { canvas.style.transition = 'none'; }, 1100);
            renderFrame(0);
            // Mobile: guarantee the canvas is at the top of the viewport when
            // playback begins — the age-gate click doesn't always reset position.
            if (isMobile) window.scrollTo({ top: 0, behavior: 'instant' });
        }

        // ── Mobile: snap to #intro on touchend when animation is in final zone ──
        // Fires at the exact moment the finger lifts — before browser momentum starts.
        // This is the only reliable cross-device way to prevent overshoot.
        if (isMobile) {
            window.addEventListener('touchend', () => {
                const total = scrollContainer.offsetHeight - window.innerHeight;
                if (total <= 0) return; // animation was skipped
                const frac = Math.max(0, Math.min(1, window.scrollY / total));
                // Snap once the animation is past hold-end and nearly done
                if (frac < HOLD_END) return;
                const intro = document.getElementById('intro');
                if (!intro) return;
                // Force all end-state visuals immediately
                canvas.style.opacity = '0';
                demoContent.classList.add('is-header');
                demoContent.style.opacity = '1';
                if (backdropEl) backdropEl.style.opacity = '1';
                glintFired = true; // prevent glint re-trigger
                if (logoMovePending) { clearTimeout(logoMovePending); logoMovePending = null; }
                snapDone = true;
                // Snap to intro — finger is already up so no momentum to fight yet
                const targetY = intro.getBoundingClientRect().top + window.scrollY;
                window.scrollTo({ top: targetY, behavior: 'instant' });
            }, { passive: true });
        }

        function skipAnimation() {
            clearTimeout(loadingTimeout);
            clearTimeout(slowTimeout);
            loadingEl.style.display = 'none';
            // Collapse the scroll section so the page layout is normal without it
            const scrollContainer = document.querySelector('.scroll-container');
            if (scrollContainer) scrollContainer.style.display = 'none';
            // Show the logo in header position immediately with full opacity
            demoContent.classList.add('is-header');
            demoContent.style.opacity = '1';
            // Ensure backdrop is fully visible when animation is skipped
            if (backdropEl) backdropEl.style.opacity = '1';
            document.body.classList.remove('no-scroll');
            const intro = document.getElementById('intro');
            if (intro) intro.scrollIntoView({ behavior: 'auto' });
        }

        if (skipBtn) skipBtn.addEventListener('click', skipAnimation);

        for (let i = 1; i <= frameCount; i++) {
            const img = new Image();
            const paddedIndex = i.toString().padStart(4, '0');
            img.src = `${imagePrefix}${paddedIndex}${imageExtension}`;
            img.onload  = onFrameSettled;
            img.onerror = onFrameSettled; // count failures too
            images.push(img);
        }

        // After 6 seconds at 0%, show a helpful message and the skip button
        const slowTimeout = setTimeout(() => {
            if (loadedImages < 5) {
                if (loadingTextEl) loadingTextEl.innerText = 'Firing up the fermenters — this can take up to a minute on first visit.';
                if (skipBtn) skipBtn.style.opacity = '1';
            }
        }, 6000);

        // Hard fallback: force-start after 90 seconds regardless
        const loadingTimeout = setTimeout(() => {
            if (loadedImages < frameCount) {
                console.warn(`YSB: only ${loadedImages}/${frameCount} frames loaded — skipping animation`);
                skipAnimation();
            }
        }, 90000);

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
        const ANIM_END        = 555 / 700;  // 0.793 — animation finishes
        const HOLD_END        = 560 / 700;  // 0.800 — minimal hold
        const FADE_END        = 640 / 700;  // 0.914 — canvas fade complete
        const LOGO_MOVE_START = 655 / 700;  // 0.936 — logo moves to corner (now glint-triggered)
        // Backdrop begins emerging once the canvas is mostly gone, then rises
        // steadily so it materialises from the dark behind the content sections.
        // The scroll-container's #0d0d0d background masks the transition while
        // it's still on-screen, so there's no "reveal from below" artefact.
        const BACKDROP_START  = 592 / 700;  // = HOLD_END + 40% of canvas fade — glass is 40% black
        const BACKDROP_END    = 680 / 700;  // backdrop fully opaque well before scroll end
        // Glint fires just before the logo departs — the glint IS the trigger for movement
        const GLINT_TRIGGER = 650 / 700;
        let glintFired      = false;
        let logoMovePending = null;
        let snapDone        = false; // mobile: fire the snap-to-intro once only

        window.addEventListener('scroll', () => {
            const scrollTop = window.scrollY;
            const totalScrollDistance = scrollContainer.offsetHeight - window.innerHeight;

            // Scroll container is hidden (animation was skipped) — nothing to drive
            if (totalScrollDistance <= 0) {
                if (backdropEl) backdropEl.style.opacity = '1';
                return;
            }

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

            // Backdrop emerges slowly from near-black once the canvas is almost gone.
            // The scroll-container's dark background keeps this hidden while we're still
            // in the animation section — no visible "reveal from below".
            if (backdropEl) {
                if (scrollFraction < BACKDROP_START) {
                    backdropEl.style.opacity = '0';
                } else if (scrollFraction < BACKDROP_END) {
                    const bProgress = (scrollFraction - BACKDROP_START) / (BACKDROP_END - BACKDROP_START);
                    backdropEl.style.opacity = bProgress.toFixed(3);
                } else {
                    backdropEl.style.opacity = '1';
                }
            }

            if (scrollFraction >= GLINT_TRIGGER && !glintFired) {
                glintFired = true;
                // Bloom the logo colours
                demoContent.classList.remove('is-glinting');
                void demoContent.offsetWidth;          // restart animation if re-triggered
                demoContent.classList.add('is-glinting');
                // Logo launches at the glint's peak (30% of 1300ms = 390ms)
                // then glint fades as the logo travels, both finishing together
                logoMovePending = setTimeout(() => {
                    demoContent.classList.add('is-header');
                    // Ensure backdrop is fully visible by the time the logo arrives
                    if (backdropEl) backdropEl.style.opacity = '1';
                    logoMovePending = null;
                }, 390);
            }

            // Fast-scroll safety: if user rockets past both thresholds in one frame
            if (scrollFraction > LOGO_MOVE_START && !demoContent.classList.contains('is-header')) {
                demoContent.classList.add('is-header');
            }

            // Mobile snap reset: if user scrolls back above HOLD_END, allow re-snap
            if (isMobile && snapDone && scrollFraction < HOLD_END - 0.05) {
                snapDone = false;
                glintFired = false;
                demoContent.classList.remove('is-header');
                demoContent.classList.remove('is-glinting');
            }

            // Scroll-back: cancel pending move and reset both states
            if (scrollFraction < GLINT_TRIGGER - 0.03) {
                if (glintFired) {
                    glintFired = false;
                    if (logoMovePending) { clearTimeout(logoMovePending); logoMovePending = null; }
                    demoContent.classList.remove('is-glinting');
                    demoContent.classList.remove('is-header');
                }
            }
        }); // end scroll listener
