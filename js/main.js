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

        // ── State ─────────────────────────────────────────────────────────────
        let isOpen       = false;
        let currentPhase = 0;   // 0 = slide0 | 1 = slide1 | 2 = canvas scrub
        let isAnimating  = false;

        let targetProgress  = 0; // where the user wants to be
        let currentProgress = 0; // lerped value — drives canvas + text
        let isLooping       = false;

        // ── Cross-fade config ─────────────────────────────────────────────────
        const FADE_ZONE  = 0.07;  // edge overlap fraction per panel
        const LERP_WHEEL = 0.10;  // wheel feel — snappy, tracks the scroll directly
        const LERP_BTN   = 0.03;  // button/key feel — slow, cinematic glide between stops
        let   lerpFactor = LERP_WHEEL;

        function panelOpacity(progress, index, count) {
            const segment = 1 / count;
            const start   = index * segment;
            const end     = start + segment;
            if (progress >= end) return 0;
            // First panel: no fade-in — visible from frame 1, only fades out at the end
            if (index === 0) {
                if (progress > end - FADE_ZONE) return (end - progress) / FADE_ZONE;
                return 1;
            }
            if (progress <= start) return 0;
            if (progress < start + FADE_ZONE) return (progress - start) / FADE_ZONE;
            if (progress > end   - FADE_ZONE) return (end - progress)   / FADE_ZONE;
            return 1;
        }

        function applyTextOpacities(progress) {
            const count = texts.length;
            texts.forEach((txt, i) => {
                if (!txt) return;
                const isLast  = (i === count - 1);
                const opacity = (isLast && progress >= 1 - 0.01)
                    ? 1 : panelOpacity(progress, i, count);
                txt.style.opacity = opacity.toFixed(3);
            });
        }

        // ── Render loop ───────────────────────────────────────────────────────
        // Sole writer of canvas frames and text opacities.
        // Wheel/button events only update targetProgress.
        function renderLoop() {
            if (!isOpen) { isLooping = false; return; }

            if (currentPhase === 2) {
                currentProgress += (targetProgress - currentProgress) * lerpFactor;
                renderStoryFrame(currentProgress);
                applyTextOpacities(currentProgress);
            }

            requestAnimationFrame(renderLoop);
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
            } else if (phase === 1) {
                slides[1].classList.add('is-active');
                if (canvas) canvas.classList.remove('is-visible');
                if (prevBtn) prevBtn.disabled = false;
                if (nextBtn) nextBtn.disabled = false;
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
                targetProgress  = 0;
                currentProgress = 0;
                renderStoryFrame(0); // paint frame 1 immediately
                if (prevBtn) prevBtn.disabled = false;
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
            targetProgress  = 0;
            currentProgress = 0;
            lerpFactor      = LERP_WHEEL;

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
                else if (currentPhase === 1) goPhase(2);
                else if (currentPhase === 2) {
                    lerpFactor = LERP_BTN;
                    targetProgress = Math.min(1, targetProgress + 0.334);
                }
            });
        }
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if      (currentPhase === 1) goPhase(0);
                else if (currentPhase === 2) {
                    lerpFactor = LERP_BTN;
                    targetProgress -= 0.334;
                    if (targetProgress < 0) goPhase(1);
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

        // Wheel — only updates targetProgress; renderLoop does all the drawing
        overlay.addEventListener('wheel', e => {
            if (!isOpen) return;
            e.preventDefault();
            if (isAnimating) return;

            if (currentPhase === 0) {
                if (e.deltaY > 0) goPhase(1);
            } else if (currentPhase === 1) {
                if (e.deltaY > 0) goPhase(2);
                else if (e.deltaY < 0) goPhase(0);
            } else if (currentPhase === 2) {
                lerpFactor = LERP_WHEEL;
                targetProgress += e.deltaY * 0.0006;
                if (targetProgress < -0.05) {
                    goPhase(1);
                    targetProgress = 0;
                } else {
                    targetProgress = Math.max(0, Math.min(1, targetProgress));
                }
            }
        }, { passive: false });

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
