document.addEventListener('DOMContentLoaded', () => {
    // Age Gate Logic
    const ageGate = document.getElementById('age-gate');
    const btnYes = document.getElementById('btn-yes');
    const btnNo = document.getElementById('btn-no');
    const ageError = document.getElementById('age-error');
    const body = document.body;

    // Check if user has already verified age in this session
    if (sessionStorage.getItem('ageVerified') === 'true') {
        ageGate.style.display = 'none';
        body.classList.remove('no-scroll');
    }

    btnYes.addEventListener('click', () => {
        // User is 18+
        sessionStorage.setItem('ageVerified', 'true');
        ageGate.classList.add('fade-out');

        // Wait for animation to finish before hiding and enabling scroll
        setTimeout(() => {
            ageGate.style.display = 'none';
            body.classList.remove('no-scroll');
        }, 500); // Matches the CSS transition duration
    });

    btnNo.addEventListener('click', () => {
        // User is under 18
        ageError.style.display = 'block';

        // Optional: Redirect them away after a few seconds
        setTimeout(() => {
            window.location.href = 'https://www.google.com';
        }, 2000);
    });

    // Intersection Observer for scroll animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.2 // Trigger when 20% of the element is visible
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    const fadeUpElements = document.querySelectorAll('.fade-up');
    fadeUpElements.forEach(el => observer.observe(el));

    // Staggered Intersection Observer for Beer Grid
    const beerGridObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const cards = entry.target.querySelectorAll('.beer-animate');
                cards.forEach((card, index) => {
                    setTimeout(() => {
                        card.classList.add('is-visible');
                    }, index * 150);
                });
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    // Support Multiple Split Galleries
    const splitGalleries = document.querySelectorAll('.split-gallery');
    
    splitGalleries.forEach(gallery => {
        const beerGrid = gallery.querySelector('.beer-grid');
        if (beerGrid) {
            beerGridObserver.observe(beerGrid);

            // Split Gallery Hover + Click Engine for this specific gallery
            const cards = beerGrid.querySelectorAll('.beer-card');
            const previewPanel = gallery.querySelector('.beer-preview-panel');
            const previewImg = gallery.querySelector('.preview-img');
            const previewPintImg = gallery.querySelector('.preview-pint-img');
            const previewTitle = gallery.querySelector('.preview-title');
            const previewDesc = gallery.querySelector('.preview-desc');
            const flipCardFront = gallery.querySelector('.flip-card-front');

            // Track which card (if any) the user has clicked to lock
            let lockedCard = null;

            function updateViewer(card) {
                previewPanel.style.opacity = '0.5';
                setTimeout(() => {
                    const imgSrc = card.querySelector('img').src;
                    const pintImgSrc = card.getAttribute('data-pint-img');
                    const title = card.getAttribute('data-title');
                    const desc = card.getAttribute('data-desc');
                    const bgColor = card.style.backgroundColor;

                    previewImg.src = imgSrc;
                    previewImg.alt = title + " Preview";
                    if (pintImgSrc) previewPintImg.src = pintImgSrc;
                    previewTitle.textContent = title;
                    previewDesc.textContent = desc;
                    if (flipCardFront) {
                        flipCardFront.style.backgroundColor = bgColor || 'transparent';
                    }
                    previewPanel.style.opacity = '1';
                }, 150);
            }

            if (cards.length > 0 && previewPanel && previewImg && previewPintImg && previewTitle && previewDesc) {
                cards.forEach(card => {
                    // Hover: update viewer only if no card is locked
                    card.addEventListener('mouseenter', () => {
                        if (!lockedCard) {
                            updateViewer(card);
                        }
                    });

                    // Click: lock this card — click the same card again to unlock
                    card.addEventListener('click', () => {
                        if (lockedCard === card) {
                            // Second click on the same card — unlock
                            lockedCard = null;
                            card.classList.remove('is-active');
                        } else {
                            // Lock the new card
                            lockedCard = card;
                            cards.forEach(c => c.classList.remove('is-active'));
                            card.classList.add('is-active');
                            updateViewer(card);
                        }
                    });
                });

                // Show first card in viewer on load (not locked — hover still works)
                updateViewer(cards[0]);
            }
        }
    });

    // Story Overlay Controller (Canvas Frame Scrubber — smooth as the intro animation)
    (function () {
        const overlay    = document.getElementById('story-overlay');
        const openBtn    = document.getElementById('story-open-btn');
        const closeBtn   = document.getElementById('story-close-btn');
        const prevBtn    = document.getElementById('story-prev');
        const nextBtn    = document.getElementById('story-next');
        const continueBtn = document.getElementById('story-continue-btn');

        if (!overlay || !openBtn) return;

        // ── Canvas setup ──────────────────────────────────────────────────────
        const canvas      = document.getElementById('story-canvas');
        const ctx         = canvas ? canvas.getContext('2d') : null;
        const loadingEl   = document.getElementById('story-loading');
        const loadingText = document.getElementById('story-loading-text');

        const FRAME_COUNT  = 240;
        const FRAME_PREFIX = 'assets/story_frames/frame_';
        const storyFrames  = [];
        let framesLoaded   = 0;
        let framesReady    = false;

        // Preload all story frames immediately so they're ready when user opens overlay
        for (let i = 1; i <= FRAME_COUNT; i++) {
            const img = new Image();
            const pad = i.toString().padStart(4, '0');
            img.src = `${FRAME_PREFIX}${pad}.jpg`;
            img.onload = img.onerror = () => {
                framesLoaded++;
                if (loadingText && loadingEl && !loadingEl.classList.contains('is-hidden')) {
                    loadingText.textContent = `Loading story... ${Math.round((framesLoaded / FRAME_COUNT) * 100)}%`;
                }
                if (framesLoaded === FRAME_COUNT) framesReady = true;
            };
            storyFrames.push(img);
        }

        function renderStoryFrame(progress) {
            if (!ctx || !framesReady) return;
            const index = Math.min(FRAME_COUNT - 1, Math.floor(progress * FRAME_COUNT));
            const img   = storyFrames[index];
            if (img && img.complete && img.naturalWidth > 0) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }
        }

        // ── Slides & text panels ──────────────────────────────────────────────
        const slides = [
            document.getElementById('slide-0'),
            document.getElementById('slide-1'),
            document.getElementById('slide-2'),
            document.getElementById('slide-3'),
            document.getElementById('slide-4'),
            document.getElementById('slide-5')
        ];
        const texts = [slides[2], slides[3], slides[4], slides[5]];

        // Hop animation video on slide-1 — managed manually to avoid
        // competing with slide-0's tea towel autoplay videos
        const hopVideo = slides[1] ? slides[1].querySelector('video') : null;
        if (hopVideo) hopVideo.pause(); // start paused until slide-1 is shown


        // ── State ─────────────────────────────────────────────────────────────
        let isOpen       = false;
        let currentPhase = 0;   // 0 = slide0 | 1 = slide1 | 2 = canvas scrub
        let isAnimating  = false;
        let currentStep  = 0;   // integer step within phase 2: 0, 1, 2, 3
        // Custom stop points (progress 0–1) for each canvas-scrub panel.
        // progress = frame_index / FRAME_COUNT, where frame_index is 0-based.
        // Frame filename 0104 → index 103 → progress 103/240 = 0.4292
        const STOP_POINTS = [
            0,       // step 0 — Well, Now What?      (frame 001)
            0.225,   // step 1 — There's No Room Here! (frame 055)
            0.45,    // step 2 — Well, Serious-ish     (frame 109, index 108 → 108/240)
            1.0,     // step 3 — slide-5, final        (frame 240)
        ];
        const STEP_COUNT = STOP_POINTS.length;

        let targetProgress    = 0; // destination (set by buttons)
        let currentProgress  = 0; // drives canvas + text
        let animStartProgress = 0; // progress at the moment a button was pressed
        let animStartTime     = null; // performance.now() timestamp when animation began
        let isLooping        = false;
        let activeAnimDuration = 1616;    // ms — recalculated per transition in startAnimation

        // ── Cross-fade config ─────────────────────────────────────────────────
        const FADE_ZONE          = 0.07;   // fade-in width per panel
        const FADE_OUT_ZONE      = 0.125;  // fade-out width: 30 frames (30/240) from each stop point
        const ANIM_DURATION      = 900;    // ms — fixed-length ease-out for phase 0/1 transitions
        const MS_PER_FRAME       = 1373 / 54; // ~25.4ms per canvas frame — uniform speed across all transitions

        // Progress at which each text panel STARTS fading in.
        // Fully visible FADE_ZONE (0.07) after this point.
        // frame 55 → index 54 → progress 54/240 = 0.225 → fade-in starts at 0.225 - 0.07 = 0.155
        const TEXT_FADE_IN = [
            0,      // panel 0 — Well, Now What?       (visible immediately)
            0.155,  // panel 1 — There's No Room Here! (fully visible at frame 55)
            0.38,   // panel 2 — Well, Serious-ish     (fully visible at frame 109 → 0.38 + 0.07 = 0.45)
            0.5758, // panel 3 — Can we join in (fully visible at frame 156 → 0.5758 + 0.07 = 0.6458)
        ];

        function applyTextOpacities(progress) {
            texts.forEach((txt, i) => {
                if (!txt) return;
                let opacity;

                if (i === texts.length - 1) {
                    // Last panel: fade in only — never fades out
                    const fadeStart = TEXT_FADE_IN[i];
                    const fadeEnd   = fadeStart + FADE_ZONE;
                    if (progress <= fadeStart)               opacity = 0;
                    else if (progress < fadeEnd)             opacity = (progress - fadeStart) / FADE_ZONE;
                    else                                     opacity = 1;

                } else if (i === 0) {
                    // First panel: no fade-in, fades out over 30 frames from stop point 0
                    const fadeOutEnd = STOP_POINTS[0] + FADE_OUT_ZONE;
                    if (progress >= fadeOutEnd)              opacity = 0;
                    else                                     opacity = (fadeOutEnd - progress) / FADE_OUT_ZONE;

                } else {
                    // Middle panels: fade in over FADE_ZONE, hold, fade out over FADE_OUT_ZONE
                    const fadeInStart  = TEXT_FADE_IN[i];
                    const fadeInEnd    = fadeInStart + FADE_ZONE;
                    const fadeOutStart = STOP_POINTS[i];
                    const fadeOutEnd   = fadeOutStart + FADE_OUT_ZONE;
                    if (progress <= fadeInStart)             opacity = 0;
                    else if (progress < fadeInEnd)           opacity = (progress - fadeInStart) / FADE_ZONE;
                    else if (progress >= fadeOutEnd)         opacity = 0;
                    else if (progress > fadeOutStart)        opacity = (fadeOutEnd - progress) / FADE_OUT_ZONE;
                    else                                     opacity = 1;
                }
                txt.style.opacity = opacity.toFixed(3);
            });
        }


        // ── Render loop ───────────────────────────────────────────────────────
        // Sole writer of canvas frames and text opacities.
        // Uses a fixed-duration ease-out cubic so it always reaches the exact
        // target frame cleanly — no asymptotic tail, no slow-crawl stutter.
        function renderLoop(timestamp) {
            if (!isOpen) { isLooping = false; return; }

            if (currentPhase === 2 && animStartTime !== null) {
                const elapsed = timestamp - animStartTime;
                const t       = Math.min(1, elapsed / activeAnimDuration);
                const eased   = 1 - Math.pow(1 - t, 1.2); // ease-out gentle — keeps frame velocity ~1/render throughout, eliminating penultimate-frame hang
                currentProgress = animStartProgress + (targetProgress - animStartProgress) * eased;

                // Snap as soon as we've reached the target FRAME INDEX — not just the target
                // progress value. Once the canvas is showing the right frame, any remaining
                // animation time is invisible, so stopping here eliminates the slow-tail
                // stutter (the single frame jump after many frames of apparent stillness).
                const targetFrame  = Math.min(FRAME_COUNT - 1, Math.floor(targetProgress * FRAME_COUNT));
                const currentFrame = Math.min(FRAME_COUNT - 1, Math.floor(currentProgress * FRAME_COUNT));
                const isForward    = targetProgress >= animStartProgress;
                const reachedTarget = isForward ? currentFrame >= targetFrame : currentFrame <= targetFrame;

                if (reachedTarget || t >= 1) {
                    currentProgress = targetProgress; // snap exactly
                    animStartTime   = null;           // animation complete
                }
                renderStoryFrame(currentProgress);
                applyTextOpacities(currentProgress);
            }

            requestAnimationFrame(renderLoop);
        }

        // Start a new animation toward a target progress value (0–1).
        // Duration scales with the number of frames covered to keep visual speed uniform.
        function startAnimation(target) {
            targetProgress      = Math.max(0, Math.min(1, target));
            animStartProgress   = currentProgress;
            animStartTime       = performance.now();
            const framesToCover = Math.abs(targetProgress - animStartProgress) * FRAME_COUNT;
            activeAnimDuration  = Math.round(framesToCover * MS_PER_FRAME);
        }

        // ── Phase controller ──────────────────────────────────────────────────
        function goPhase(phase) {
            if (isAnimating || phase < 0 || phase > 2) return;
            isAnimating = true;

            slides[0].classList.remove('is-active');
            slides[1].classList.remove('is-active');
            texts.forEach(t => {
                if (!t) return;
                t.classList.remove('is-active', 'phase-active');
                t.style.opacity = '0';
            });

            currentPhase = phase;

            if (phase === 0) {
                slides[0].classList.add('is-active');
                if (canvas) canvas.classList.remove('is-visible');
                if (prevBtn) prevBtn.disabled = true;
                if (nextBtn) nextBtn.disabled = false;
                if (hopVideo) hopVideo.pause();
            } else if (phase === 1) {
                slides[1].classList.add('is-active');
                if (canvas) canvas.classList.remove('is-visible');
                if (prevBtn) prevBtn.disabled = false;
                if (nextBtn) nextBtn.disabled = false;
                if (hopVideo) { hopVideo.currentTime = 0; hopVideo.play().catch(() => {}); }
            } else if (phase === 2) {
                // Show loading overlay if frames aren't ready yet
                if (loadingEl) {
                    if (!framesReady) {
                        loadingEl.classList.remove('is-hidden');
                    } else {
                        loadingEl.classList.add('is-hidden');
                    }
                }
                if (canvas) canvas.classList.add('is-visible');
                texts.forEach(t => {
                    if (!t) return;
                    t.classList.add('phase-active');
                    t.style.opacity = '0';
                });
                currentStep       = 0;
                targetProgress    = 0;
                currentProgress   = 0;
                animStartProgress = 0;
                animStartTime     = null;
                renderStoryFrame(0);    // paint frame 1 immediately
                applyTextOpacities(0);  // show first text box immediately at rest
                if (prevBtn) prevBtn.disabled = false;
                if (hopVideo) hopVideo.pause();
            }

            setTimeout(() => { isAnimating = false; }, 800);
        }

        // ── Overlay open / close ──────────────────────────────────────────────
        function openOverlay() {
            isOpen = true;
            overlay.classList.add('is-open');
            overlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('no-scroll');
            goPhase(0);
            if (!isLooping) { isLooping = true; requestAnimationFrame(renderLoop); }
        }

        function closeOverlay(continueStory) {
            if (!isOpen) return;
            isOpen       = false;
            isAnimating  = false;  // always unblock — may have been mid-transition
            isLooping    = false;
            currentPhase    = 0;
            targetProgress    = 0;
            currentProgress   = 0;
            animStartProgress = 0;
            animStartTime     = null;
            if (hopVideo) hopVideo.pause();

            overlay.classList.remove('is-open');
            overlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('no-scroll');

            // Clean up all slide active states and inline styles
            slides.forEach(s => {
                if (!s) return;
                s.classList.remove('is-active', 'phase-active');
                s.style.opacity    = '';
                s.style.visibility = '';
            });
            texts.forEach(t => {
                if (!t) return;
                t.classList.remove('is-active', 'phase-active');
                t.style.opacity    = '';
                t.style.visibility = '';
            });

            if (canvas) canvas.classList.remove('is-visible');
            if (prevBtn) prevBtn.disabled = true;

            if (continueStory) {
                const sec = document.getElementById('story');
                if (sec) {
                    window.scrollTo({
                        top: window.scrollY + sec.getBoundingClientRect().top + window.innerHeight * 0.35,
                        behavior: 'smooth'
                    });
                }
            }
        }

        // ── Event listeners ───────────────────────────────────────────────────
        openBtn.addEventListener('click', openOverlay);
        if (closeBtn)    closeBtn.addEventListener('click',    () => closeOverlay(false));
        if (continueBtn) continueBtn.addEventListener('click', () => closeOverlay(true));

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if      (currentPhase === 0) goPhase(1);
                else if (currentPhase === 1) { isAnimating = false; goPhase(2); }
                else if (currentPhase === 2) {
                    if (currentStep < STEP_COUNT - 1) {
                        currentStep++;
                        startAnimation(STOP_POINTS[currentStep]);
                    }
                }
            });
        }
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if      (currentPhase === 1) { isAnimating = false; goPhase(0); }
                else if (currentPhase === 2) {
                    if (currentStep > 0) {
                        currentStep--;
                        startAnimation(STOP_POINTS[currentStep]);
                    } else {
                        isAnimating = false; goPhase(1);
                    }
                }
            });
        }

        overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(false); });

        document.addEventListener('keydown', e => {
            if (!isOpen) return;
            if (e.key === 'Escape')               closeOverlay(false);
            if (e.key === 'ArrowRight' && nextBtn) nextBtn.click();
            if (e.key === 'ArrowLeft'  && prevBtn) prevBtn.click();
        });

        // Wheel/scroll is intentionally disabled — navigation is buttons and keyboard only.

        // Hide loading overlay once frames become ready (may already be true)
        const checkFrames = setInterval(() => {
            if (framesReady && loadingEl) {
                loadingEl.classList.add('is-hidden');
                clearInterval(checkFrames);
            }
        }, 200);

    })();



    // ── Nav Dropdown Controller ───────────────────────────────────────────────
    // Uses elementFromPoint for the logo hit-test so CSS scale transforms don't
    // cause the trigger zone to extend beyond the visual logo bounds.
    (function () {
        const logoEl = document.getElementById('demo-content');
        const dropEl = document.getElementById('nav-dropdown');
        if (!logoEl || !dropEl) return;

        let isOpen = false;

        function isOverLogo(x, y) {
            // Temporarily disable pointer-events on the dropdown so elementFromPoint
            // sees through it and detects the logo underneath
            const saved = dropEl.style.pointerEvents;
            dropEl.style.pointerEvents = 'none';
            const el = document.elementFromPoint(x, y);
            dropEl.style.pointerEvents = saved;
            return !!el && (logoEl === el || logoEl.contains(el));
        }

        function isOverInnerPanel(x, y) {
            const inner = dropEl.querySelector('.nav-dropdown__inner');
            if (!inner) return false;
            const r = inner.getBoundingClientRect();
            // Small top buffer bridges any gap between logo bottom and panel top
            return x >= r.left && x <= r.right && y >= (r.top - 16) && y <= r.bottom;
        }

        document.addEventListener('mousemove', (e) => {
            if (!logoEl.classList.contains('is-header')) return;

            const x = e.clientX;
            const y = e.clientY;
            const overLogo  = isOverLogo(x, y);
            const overPanel = isOverInnerPanel(x, y);

            if (overLogo && !isOpen) {
                // Only the logo can OPEN the menu
                isOpen = true;
                dropEl.classList.add('is-open');
            } else if (!overLogo && !overPanel && isOpen) {
                // Leaving both logo AND panel closes it
                isOpen = false;
                dropEl.classList.remove('is-open');
            }
            // overPanel && isOpen → keep open (stay logic, no re-open)
            // overPanel && !isOpen → do nothing (panel alone can't open menu)
        });

        // Close when logo loses header state (user scrolled back up)
        const observer = new MutationObserver(() => {
            if (!logoEl.classList.contains('is-header')) {
                isOpen = false;
                dropEl.classList.remove('is-open');
            }
        });
        observer.observe(logoEl, { attributes: true, attributeFilter: ['class'] });
    })();


    // ── Back to Top ───────────────────────────────────────────────────────────
    const topBtn = document.getElementById('nav-top-btn');
    if (topBtn) {
        topBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const intro = document.getElementById('intro');
            if (intro) {
                intro.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // ── Subscription Form ─────────────────────────────────────────────────────
    const subscribeForm = document.getElementById('subscribe-form');
    const subscribeMessage = document.getElementById('subscribe-message');

    if (subscribeForm) {
        subscribeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = subscribeForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Submitting...';
            subscribeMessage.textContent = '';
            subscribeMessage.className = 'subscribe-message';

            const formData = new FormData(subscribeForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/api/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok) {
                    subscribeMessage.textContent = result.message || "You're on the list. Check your inbox soon.";
                    subscribeMessage.classList.add('success');
                    subscribeForm.reset();
                } else {
                    subscribeMessage.textContent = result.error || 'Something went wrong. Please try again.';
                    subscribeMessage.classList.add('error');
                }
            } catch (error) {
                console.error('Subscription error:', error);
                subscribeMessage.textContent = 'Network error. Please try again later.';
                subscribeMessage.classList.add('error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        });
    }
});
