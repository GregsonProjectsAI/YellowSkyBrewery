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

        // ── Mobile: contained-scroll wrapper ───────────────────────────────────
        // On mobile we move the scroll-container into a fixed 100vh div that has
        // its own internal scroll. The scroll physically stops at the bottom —
        // no momentum overshoot is possible because the browser has nowhere left
        // to scroll to. Desktop layout is completely untouched.
        const scrollContainer = document.querySelector('.scroll-container');
        let   scrollSource    = window;      // what we listen to for 'scroll'
        let   getScrollTop    = () => window.scrollY;
        let   getScrollRange  = () => scrollContainer.offsetHeight - window.innerHeight;

        let continueBtn = null; // mobile-only "Continue →" button

        if (isMobile && scrollContainer) {
            // Create the fixed wrapper
            const wrapper = document.createElement('div');
            wrapper.id = 'anim-wrapper';
            // Styles applied inline so they work without waiting for CSS parse
            Object.assign(wrapper.style, {
                position:           'fixed',
                top:                '0',
                left:               '0',
                width:              '100vw',
                height:             '100vh',
                overflowY:          'scroll',
                overscrollBehavior: 'none',
                zIndex:             '50',
                background:         '#0d0d0d', // opaque — page content must not bleed through
            });

            // Move the backdrop INTO the wrapper so it sits at z-index 0 within
            // the wrapper's stacking context (below canvas at z-index 1).
            // As the canvas fades, the brewery image reveals — not the page below.
            if (backdropEl) wrapper.appendChild(backdropEl);

            // Move scroll-container into wrapper, insert wrapper where it was
            scrollContainer.parentNode.insertBefore(wrapper, scrollContainer);
            wrapper.appendChild(scrollContainer);

            // Keep #loading accessible above the wrapper for the skip button
            if (loadingEl) loadingEl.style.zIndex = '110';

            // Redirect scroll source to the wrapper
            scrollSource   = wrapper;
            getScrollTop   = () => wrapper.scrollTop;
            getScrollRange = () => scrollContainer.offsetHeight - wrapper.clientHeight;

            // "Continue →" button — appears when animation completes
            continueBtn = document.createElement('button');
            continueBtn.id        = 'anim-continue-btn';
            continueBtn.textContent = 'Continue →';
            Object.assign(continueBtn.style, {
                position:      'fixed',
                top:           '50%',
                left:          '50%',
                transform:     'translate(-50%, -50%)',
                zIndex:        '200',
                opacity:       '0',
                pointerEvents: 'none',
                transition:    'opacity 0.6s ease',
                background:    'transparent',
                border:        '1px solid rgba(212,175,55,0.7)',
                color:         'rgba(212,175,55,0.9)',
                fontFamily:    "'Helvetica Neue', Arial, sans-serif",
                fontSize:      '0.85rem',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                padding:       '12px 32px',
                borderRadius:  '4px',
                cursor:        'pointer',
            });
            document.body.appendChild(continueBtn);

            continueBtn.addEventListener('click', () => {
                // Hide button immediately on tap
                continueBtn.style.opacity      = '0';
                continueBtn.style.pointerEvents = 'none';
                // Restore backdrop to body BEFORE hiding wrapper so main site
                // still has its background after the animation completes
                if (backdropEl) {
                    backdropEl.style.opacity = '1';
                    document.body.appendChild(backdropEl);
                }
                wrapper.style.transition = 'opacity 0.4s ease';
                wrapper.style.opacity    = '0';
                setTimeout(() => {
                    wrapper.style.display = 'none';
                    // Remove button from DOM so it doesn't float over the main site
                    if (continueBtn.parentNode) continueBtn.parentNode.removeChild(continueBtn);
                    const intro = document.getElementById('intro');
                    if (intro) intro.scrollIntoView({ behavior: 'instant' });
                }, 400);
            });
        }

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
        }

        function skipAnimation() {
            clearTimeout(loadingTimeout);
            clearTimeout(slowTimeout);
            loadingEl.style.display = 'none';
            // On mobile, dismiss the wrapper entirely.
            // The backdrop was moved inside the wrapper during setup — restore it
            // to the body BEFORE hiding the wrapper so the page doesn't go dark.
            if (isMobile) {
                if (backdropEl) {
                    backdropEl.style.opacity = '1';
                    document.body.appendChild(backdropEl);
                }
                const wrapper = document.getElementById('anim-wrapper');
                if (wrapper) wrapper.style.display = 'none';
                if (continueBtn && continueBtn.parentNode) continueBtn.parentNode.removeChild(continueBtn);
            } else {
                // Desktop: collapse the scroll section so layout is normal
                if (scrollContainer) scrollContainer.style.display = 'none';
            }
            demoContent.classList.add('is-header');
            demoContent.style.opacity = '1';
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
        const BACKDROP_START  = 592 / 700;
        const BACKDROP_END    = 680 / 700;
        // Glint fires just before the logo departs — the glint IS the trigger for movement
        const GLINT_TRIGGER = 650 / 700;
        let glintFired      = false;
        let logoMovePending = null;
        let continueShown   = false; // mobile: show Continue button once only

        let scrollTicking = false;
        scrollSource.addEventListener('scroll', () => {
            if (!scrollTicking) {
                window.requestAnimationFrame(() => {
                    processScrollFrame();
                    scrollTicking = false;
                });
                scrollTicking = true;
            }
        });

        function processScrollFrame() {
            const scrollTop           = getScrollTop();
            const totalScrollDistance = getScrollRange();

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
                demoContent.classList.remove('is-glinting');
                void demoContent.offsetWidth;
                demoContent.classList.add('is-glinting');
                logoMovePending = setTimeout(() => {
                    demoContent.classList.add('is-header');
                    if (backdropEl) backdropEl.style.opacity = '1';
                    logoMovePending = null;
                    // Fade in Continue button as logo travels to corner.
                    // 500ms delay lets the logo get clear of center first.
                    if (isMobile && continueBtn && !continueShown) {
                        setTimeout(() => {
                            continueShown = true;
                            continueBtn.style.opacity      = '1';
                            continueBtn.style.pointerEvents = 'auto';
                        }, 500);
                    }
                }, 390);
            }

            // Fast-scroll safety: if user rockets past both thresholds in one frame
            if (scrollFraction > LOGO_MOVE_START && !demoContent.classList.contains('is-header')) {
                demoContent.classList.add('is-header');
                if (isMobile && continueBtn && !continueShown) {
                    setTimeout(() => {
                        continueShown = true;
                        continueBtn.style.opacity      = '1';
                        continueBtn.style.pointerEvents = 'auto';
                    }, 500);
                }
            }

            // Mobile: hide Continue if user scrolls back before logo departs
            if (isMobile && continueShown && continueBtn && scrollFraction < GLINT_TRIGGER - 0.03) {
                continueShown = false;
                continueBtn.style.opacity      = '0';
                continueBtn.style.pointerEvents = 'none';
            }

            // Scroll-back: cancel pending move and reset both states
            if (scrollFraction < GLINT_TRIGGER - 0.03) {
                if (glintFired) {
                    glintFired = false;
                    if (logoMovePending) { clearTimeout(logoMovePending); logoMovePending = null; }
                    demoContent.classList.remove('is-glinting');
                    demoContent.classList.remove('is-header');
                }
                // Hide Continue button if user scrolls back
                if (isMobile && continueShown && continueBtn) {
                    continueShown = false;
                    continueBtn.style.opacity      = '0';
                    continueBtn.style.pointerEvents = 'none';
                }
            }
        } // end processScrollFrame

        // Skip animation when arriving from a profile page back button.
        // A sessionStorage flag is set by the back button on profile pages
        // and cleared immediately here so refreshes don't re-trigger the skip.
        const skipToSection = sessionStorage.getItem('ysb_skipTo');
        if (skipToSection) {
            sessionStorage.removeItem('ysb_skipTo');
            skipAnimation();
            const target = document.querySelector(skipToSection);
            if (target) target.scrollIntoView({ behavior: 'instant' });
        }
