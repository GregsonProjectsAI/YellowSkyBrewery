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

    // ── Dashboard Ticker — seamless marquee ───────────────────────────────────
    (function () {
        const track = document.getElementById('dashboard-track');
        if (!track) return;

        // Clone all children, strip IDs to avoid duplicates, append for seamless loop
        const originals = Array.from(track.children);
        originals.forEach(child => {
            const clone = child.cloneNode(true);
            clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
            clone.removeAttribute('id');
            track.appendChild(clone);
        });

        // Map each original dynamic container to its clone counterpart so that
        // when blog.js renders content asynchronously, the clone stays in sync.
        const dynamicIds = ['dashboard-latest-post', 'dashboard-this-weeks-brew', 'dashboard-latest-event'];
        const clonedChildren = Array.from(track.children).slice(originals.length);

        dynamicIds.forEach(id => {
            const original = document.getElementById(id);
            if (!original) return;

            // Find the matching clone by its position in the original
            const originalIndex = originals.indexOf(original.closest('.dashboard-widget'));
            if (originalIndex === -1) return;
            const cloneWidget = clonedChildren[originalIndex];
            if (!cloneWidget) return;

            // Find the content container inside the cloned widget
            const cloneTarget = cloneWidget.querySelector('.' + original.className.split(' ')[0]);
            if (!cloneTarget) return;

            // Mirror content whenever blog.js writes into the original
            const observer = new MutationObserver(() => {
                cloneTarget.innerHTML = original.innerHTML;
            });
            observer.observe(original, { childList: true, subtree: true });
        });
    })();

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
        const resetTeaTowelBtn = document.getElementById('teatowel-reset-btn');

        // Refresh tea towel: rebuilds the cloth particle grid from rest positions
        if (resetTeaTowelBtn) {
            resetTeaTowelBtn.addEventListener('click', () => {
                // WebGPU path (primary)
                if (typeof window.resetTeaTowel === 'function') {
                    window.resetTeaTowel();
                // Canvas fallback path
                } else if (window.TeaTowelCloth && typeof window.TeaTowelCloth.reset === 'function') {
                    window.TeaTowelCloth.reset();
                }
            });
        }

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

        // ── Cloth simulation (slide-0 tea towel) ──────────────────────────────
        // TeaTowelCloth is now handled autonomously in index.html module
        const towelCanvas = document.getElementById('teatowel-container');
        const hintEl      = document.getElementById('cloth-hint');

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

        // ── Hop video system (slide-1) ────────────────────────────────────────
        // Four video elements: timelapse forward, timelapse reversed,
        // ambient loop A, ambient loop B.
        const hopTimelapse = document.getElementById('hop-timelapse');
        const hopReversed  = document.getElementById('hop-reversed');
        const hopLoopA     = document.getElementById('hop-loop-a');
        const hopLoopB     = document.getElementById('hop-loop-b');

        // Ensure all start paused and invisible
        [hopTimelapse, hopReversed, hopLoopA, hopLoopB].forEach(v => {
            if (v) { v.pause(); v.currentTime = 0; }
        });
        if (hopTimelapse) hopTimelapse.style.opacity = '0';

        let hasSeenTimelapse  = false;   // true after first forward play completes
        let hopLoopActive     = false;   // true while ambient loop is running
        let hopReversePlaying = false;  // true while reverse transition is running
        let trackedTimelapseTime = 0;   // mediaTime of the last frame presented to compositor

        // Start frame-accurate tracking of the timelapse's displayed position.
        // requestVideoFrameCallback fires with the exact mediaTime of each presented
        // frame — far more accurate than reading currentTime in a rAF or click handler.
        // Falls back to rAF polling on browsers that don't support rVFC.
        function startTrackingTimelapse() {
            if (!hopTimelapse) return;
            trackedTimelapseTime = 0;
            if ('requestVideoFrameCallback' in hopTimelapse) {
                function onVideoFrame(now, metadata) {
                    trackedTimelapseTime = metadata.mediaTime;
                    if (!hopTimelapse.paused && !hopTimelapse.ended) {
                        hopTimelapse.requestVideoFrameCallback(onVideoFrame);
                    }
                }
                hopTimelapse.requestVideoFrameCallback(onVideoFrame);
            } else {
                // rAF fallback
                function rAFTrack() {
                    if (hopTimelapse && !hopTimelapse.paused && !hopTimelapse.ended) {
                        trackedTimelapseTime = hopTimelapse.currentTime;
                        requestAnimationFrame(rAFTrack);
                    }
                }
                requestAnimationFrame(rAFTrack);
            }
        }

        // HOP LOOP CROSSFADE — mirrors the steam/drip dual-video pattern
        const HOP_LOOP_DURATION = 30; // seconds — length of ambient loop file
        const HOP_CROSSFADE     = 1.0; // seconds before end to start dissolve
        let hopLoopPrimary      = null;
        let hopLoopSecondary    = null;
        let hopLoopTimer        = null;

        function stopHopLoop() {
            hopLoopActive = false;
            if (hopLoopTimer) { clearTimeout(hopLoopTimer); hopLoopTimer = null; }
            [hopLoopA, hopLoopB].forEach(v => {
                if (!v) return;
                v.pause();
                v.currentTime = 0;
                // Snap to hidden instantly — no CSS fade-out that could expose the dark bg
                v.style.transition = 'none';
                v.style.opacity    = '0';
            });
            hopLoopPrimary   = null;
            hopLoopSecondary = null;
        }

        function scheduleHopCrossfade(primary, secondary) {
            if (!hopLoopActive) return;
            const remaining = (HOP_LOOP_DURATION - HOP_CROSSFADE) * 1000;
            hopLoopTimer = setTimeout(() => {
                if (!hopLoopActive) return;
                // Bring secondary up, rewind it so it's ready
                secondary.currentTime = 0;
                secondary.play().catch(() => {});
                secondary.style.opacity = '1';
                // Fade primary out
                primary.style.opacity = '0';
                // After crossfade completes, primary becomes new secondary
                setTimeout(() => {
                    if (!hopLoopActive) return;
                    primary.pause();
                    primary.currentTime = 0;
                    primary.style.opacity = '0';
                    hopLoopPrimary   = secondary;
                    hopLoopSecondary = primary;
                    scheduleHopCrossfade(hopLoopPrimary, hopLoopSecondary);
                }, HOP_CROSSFADE * 1000);
            }, remaining);
        }

        function startHopLoop() {
            stopHopLoop();
            if (!hopLoopA || !hopLoopB) return;
            hopLoopActive    = true;
            hopLoopPrimary   = hopLoopA;
            hopLoopSecondary = hopLoopB;
            hopLoopA.currentTime = 0;
            hopLoopA.play().catch(() => {});
            hopLoopA.style.opacity = '1';
            hopLoopB.style.opacity = '0';
            scheduleHopCrossfade(hopLoopA, hopLoopB);
        }

        // Wire timelapse ended → crossfade to loop
        if (hopTimelapse) {
            hopTimelapse.addEventListener('ended', () => {
                // Start loop FIRST so loop-a fades in on top of the timelapse's
                // last frame — no black gap. Then fade timelapse out once covered.
                startHopLoop();
                setTimeout(() => { hopTimelapse.style.opacity = '0'; }, 500);
            });
        }

        // Wire reversed timelapse ended → complete the back navigation
        if (hopReversed) {
            hopReversed.addEventListener('ended', () => {
                hopReversePlaying = false;
                // Restore transition before hiding so future crossfades work
                hopReversed.style.transition = '';
                hopReversed.style.opacity = '0';
                hopReversed.pause();
                hopReversed.currentTime = 0;
                // Now actually go back to slide-0
                isAnimating = false;
                goPhase(0);
            });
        }

        // ── Hop slide show/hide helpers ───────────────────────────────────────
        // showSlide1Forward: called when entering slide-1 FROM slide-0 (next ►)
        // Always plays the timelapse from the beginning.
        function showSlide1Forward() {
            stopHopLoop();
            hopReversePlaying = false;
            if (hopReversed) { hopReversed.style.opacity = '0'; hopReversed.pause(); }
            if (hopTimelapse) {
                hopTimelapse.currentTime = 0;
                trackedTimelapseTime     = 0;
                hopTimelapse.style.opacity = '1';
                hopTimelapse.play().catch(() => {});
                startTrackingTimelapse(); // begin frame-accurate position tracking
            }
        }

        // showSlide1Backward: called when entering slide-1 FROM the canvas (◄ prev)
        // Always jumps straight to the ambient loop.
        function showSlide1Backward() {
            stopHopLoop();
            hopReversePlaying = false;
            if (hopReversed)  { hopReversed.style.opacity  = '0'; hopReversed.pause(); }
            if (hopTimelapse) { hopTimelapse.pause(); hopTimelapse.style.opacity = '0'; }
            startHopLoop();
        }

        function hideSlide1() {
            stopHopLoop();
            if (hopTimelapse) { hopTimelapse.pause(); hopTimelapse.style.opacity = '0'; }
            if (hopReversed)  { hopReversed.pause();  hopReversed.style.opacity  = '0'; }
        }

        // ── Back-from-slide-1 transition ──────────────────────────────────────
        // Plays the reversed timelapse then calls goPhase(0) when done.
        function playReverseAndGoBack() {
            if (hopReversePlaying) return;
            hopReversePlaying = true;
            stopHopLoop();

            if (hopReversed) {
                hopReversed.playbackRate = 2;

                // Use the last DISPLAYED frame's mediaTime (via requestVideoFrameCallback)
                // to mirror exactly what the user was seeing — not currentTime at click time.
                // Normalise via proportional progress so duration mismatches don't drift.
                const tCurrent  = trackedTimelapseTime;
                const tDuration = hopTimelapse ? hopTimelapse.duration : 0;
                const rDuration = hopReversed.duration;
                if (tCurrent > 0 && tDuration > 0 && rDuration) {
                    const progress = Math.min(1, tCurrent / tDuration);      // 0→1
                    hopReversed.currentTime = (1 - progress) * rDuration;    // 1→0
                } else {
                    hopReversed.currentTime = 0;
                }

                // Snap to fully visible immediately — bypass the 0.5s CSS fade-in
                hopReversed.style.transition = 'none';
                hopReversed.style.opacity    = '1';
                // Leave hopTimelapse paused-and-visible as a static backdrop.
                if (hopTimelapse) hopTimelapse.pause();
                hopReversed.play().catch(() => {
                    hopReversePlaying = false;
                    isAnimating = false;
                    goPhase(0);
                });
            } else {
                if (hopTimelapse) { hopTimelapse.pause(); hopTimelapse.style.opacity = '0'; }
                isAnimating = false;
                goPhase(0);
            }
        }


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
            0.225,   // step 1 — There's No Room Here! (frame 055, index 54 → 54/240)
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
            0.155,  // panel 1 — There's No Room Here! (fully visible at frame 55 → 0.155 + 0.07 = 0.225)
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


        // ── Steam video overlay — dual-video crossfade ────────────────────────────────
        // Two video elements play the same clip in alternation. When the primary
        // is XFADE_S from its end the standby starts from t=0 and both cross-
        // fade — hiding the loop cut entirely.
        const steamA    = document.getElementById('story-steam-a');
        const steamB    = document.getElementById('story-steam-b');
        const STEAM_STEP  = 2;
        const XFADE_S     = 1.0;    // crossfade duration in seconds
        const FADE_IN_S   = 1.2;    // slow fade-in when arriving at step 2

        let steamIsActive = false;
        let steamPrimary  = steamA;
        let steamStandby  = steamB;
        let crossfading   = false;

        function steamShow(vid, dur) {
            vid.style.transition = `opacity ${dur}s linear`;
            vid.style.opacity    = '1';
        }
        function steamHide(vid, dur) {
            vid.style.transition = dur > 0 ? `opacity ${dur}s linear` : 'none';
            vid.style.opacity    = '0';
        }
        function steamReset(vid) {
            vid.style.transition = 'none';
            vid.style.opacity    = '0';
            vid.pause();
            vid.currentTime = 0;
        }

        function doCrossfade() {
            if (!steamIsActive || crossfading) return;
            crossfading = true;
            steamStandby.currentTime = 0;
            steamStandby.play().catch(() => {});
            steamShow(steamStandby, XFADE_S);
            steamHide(steamPrimary, XFADE_S);
            setTimeout(() => {
                steamReset(steamPrimary);
                [steamPrimary, steamStandby] = [steamStandby, steamPrimary];
                crossfading = false;
            }, XFADE_S * 1000 + 100);
        }

        function onSteamTimeUpdate() {
            if (!steamIsActive || crossfading || !this.duration) return;
            if (this !== steamPrimary) return;
            if ((this.duration - this.currentTime) <= XFADE_S) doCrossfade();
        }

        if (steamA) steamA.addEventListener('timeupdate', onSteamTimeUpdate);
        if (steamB) steamB.addEventListener('timeupdate', onSteamTimeUpdate);

        function startSteamEffect(step) {
            if (!steamA || step !== STEAM_STEP) return;
            steamIsActive = true;
            crossfading   = false;
            steamPrimary  = steamA;
            steamStandby  = steamB;
            steamReset(steamB);
            steamA.currentTime = 0;
            steamA.play().catch(() => {});
            steamShow(steamA, FADE_IN_S);
        }

        function stopSteamEffect() {
            if (!steamA) return;
            steamIsActive = false;
            crossfading   = false;
            steamReset(steamA);
            steamReset(steamB);
        }

        // ── Kettle steam overlay — step 1 (frame 56, "There's No Room Here!") ─
        // Dual-video crossfade within a clipped loop window (1.3816s → 6.4811s).
        // Uses setInterval at 100ms to poll currentTime — more reliable than
        // timeupdate which can miss the trigger point after a seek or on slower
        // devices, causing the video to play past the loop window and stop.
        const kettleA      = document.getElementById('story-kettle-a');
        const kettleB      = document.getElementById('story-kettle-b');
        const frame55Overlay = document.getElementById('story-frame55-overlay');
        const KETTLE_STEP  = 1;
        const KETTLE_START = 1.3816;   // loop in-point (seconds)
        const KETTLE_END   = 6.4811;   // loop out-point (seconds)
        const KETTLE_XFADE = 1.0;      // crossfade duration in seconds
        const KETTLE_FADE  = 0.35;      // fade-in duration — ease-in over ~8 frames (frames 47→55)

        let kettleIsActive  = false;
        let kettlePrimary   = kettleA;
        let kettleStandby   = kettleB;
        let kettleCrossfade = false;
        let kettleMonitor   = null;    // setInterval handle

        function kettleReset(vid) {
            vid.style.transition = 'none';
            vid.style.opacity    = '0';
            vid.pause();
            vid.currentTime = KETTLE_START;
        }

        // Separate show function for kettle steam — uses ease-in so the fade
        // starts imperceptibly slow and accelerates, giving a very soft onset.
        function kettleShow(vid, dur) {
            vid.style.transition = `opacity ${dur}s ease-in`;
            vid.style.opacity    = '1';
        }

        function doKettleCrossfade() {
            if (!kettleIsActive || kettleCrossfade) return;
            kettleCrossfade = true;
            kettleStandby.currentTime = KETTLE_START;
            kettleStandby.play().catch(() => {});
            kettleShow(kettleStandby, KETTLE_XFADE);
            steamHide(kettlePrimary, KETTLE_XFADE);
            setTimeout(() => {
                kettleReset(kettlePrimary);
                [kettlePrimary, kettleStandby] = [kettleStandby, kettlePrimary];
                kettleCrossfade = false;
            }, KETTLE_XFADE * 1000 + 100);
        }

        // Poll the primary video's currentTime every 100ms — catches the
        // crossfade trigger reliably regardless of timeupdate event frequency.
        function startKettleMonitor() {
            if (kettleMonitor) clearInterval(kettleMonitor);
            kettleMonitor = setInterval(() => {
                if (!kettleIsActive) { clearInterval(kettleMonitor); kettleMonitor = null; return; }
                if (!kettleCrossfade && kettlePrimary.currentTime >= KETTLE_END - KETTLE_XFADE) {
                    doKettleCrossfade();
                }
            }, 100);
        }

        function startKettleEffect(step) {
            if (!kettleA || step !== KETTLE_STEP || kettleIsActive) return; // idempotent
            kettleIsActive  = true;
            kettleCrossfade = false;
            kettlePrimary   = kettleA;
            kettleStandby   = kettleB;
            kettleReset(kettleB);
            kettleA.currentTime = KETTLE_START;
            kettleA.play().catch(() => {});
            kettleShow(kettleA, KETTLE_FADE);
            startKettleMonitor();
        }

        function stopKettleEffect() {
            if (!kettleA) return;
            kettleIsActive  = false;
            kettleCrossfade = false;
            if (kettleMonitor) { clearInterval(kettleMonitor); kettleMonitor = null; }
            kettleReset(kettleA);
            kettleReset(kettleB);
            // Reset dissolve overlay instantly so it's hidden on next entry
            if (frame55Overlay) { frame55Overlay.style.transition = 'none'; frame55Overlay.style.opacity = '0'; }
        }

        // ── Pint filling overlay — step 3 ("Can We Join In?") ─────────────────
        // One-shot: plays once from the beginning and holds on the final frame.
        // When the pour ends, the drip loop takes over seamlessly.
        const pintVideo  = document.getElementById('story-pint');
        const PINT_STEP  = 3;
        const PINT_FADE  = 0.05;  // near-instant — pre-roll ensures video is ready before canvas snaps
        let   pintIsActive = false;
        let   pintMonitor  = null;

        function startPintEffect(step) {
            if (!pintVideo || step !== PINT_STEP || pintIsActive) return;
            pintIsActive = true;
            pintVideo.currentTime = 0;
            pintVideo.play().catch(() => {});
            pintVideo.style.transition = `opacity ${PINT_FADE}s ease-in`;
            pintVideo.style.opacity    = '1';
            startPintMonitor();
        }

        // Monitor the pour video and start the drip fade-in DRIP_XFADE seconds
        // before it ends — so the drip reaches full opacity exactly as the pour
        // finishes, with no gap between the two.
        function startPintMonitor() {
            if (pintMonitor) clearInterval(pintMonitor);
            pintMonitor = setInterval(() => {
                if (!pintIsActive) { clearInterval(pintMonitor); pintMonitor = null; return; }
                if (pintVideo && !dripIsActive &&
                    pintVideo.duration > 0 &&
                    pintVideo.currentTime >= pintVideo.duration - DRIP_XFADE) {
                    startDripLoop();
                }
            }, 50);
        }

        // ── Drip loop — plays after the pour completes ─────────────────────────
        // Dual-video crossfade loop: 0.0000s → 19.3325s (Beer_drip_slow.mp4 — 40% speed), 1.0s crossfade.
        // Triggered automatically by the pour video's 'ended' event.
        const dripA       = document.getElementById('story-drip-a');
        const dripB       = document.getElementById('story-drip-b');
        const DRIP_START  = 0.0000;
        const DRIP_END    = 19.3325;
        const DRIP_XFADE  = 1.0;
        let dripIsActive  = false;
        let dripPrimary, dripStandby;
        let dripCrossfade = false;
        let dripMonitor   = null;

        function dripReset(vid) {
            vid.style.transition = 'none';
            vid.style.opacity    = '0';
            vid.pause();
            vid.currentTime = DRIP_START;
        }

        function doDripCrossfade() {
            if (!dripIsActive || dripCrossfade) return;
            dripCrossfade = true;
            dripStandby.currentTime = DRIP_START;
            dripStandby.play().catch(() => {});
            // Fade standby IN to full opacity first — canvas stays covered throughout.
            steamShow(dripStandby, DRIP_XFADE);
            // Only fade primary OUT once standby is fully visible, then swap roles.
            setTimeout(() => {
                steamHide(dripPrimary, 0.3);
                setTimeout(() => {
                    dripReset(dripPrimary);
                    [dripPrimary, dripStandby] = [dripStandby, dripPrimary];
                    dripCrossfade = false;
                }, 400);
            }, DRIP_XFADE * 1000);
        }

        function startDripMonitor() {
            if (dripMonitor) clearInterval(dripMonitor);
            dripMonitor = setInterval(() => {
                if (!dripIsActive) { clearInterval(dripMonitor); dripMonitor = null; return; }
                if (!dripCrossfade && dripPrimary.currentTime >= DRIP_END - DRIP_XFADE) {
                    doDripCrossfade();
                }
            }, 100);
        }

        function startDripLoop() {
            if (!dripA || dripIsActive) return;
            dripIsActive  = true;
            dripCrossfade = false;
            dripPrimary   = dripA;
            dripStandby   = dripB;
            dripReset(dripB);
            dripA.currentTime = DRIP_START;
            dripA.play().catch(() => {});
            // Fade drip in while keeping the pour video at full opacity behind it —
            // this prevents the canvas frame ever showing through during the handoff.
            dripA.style.transition = `opacity ${DRIP_XFADE}s ease-in`;
            dripA.style.opacity    = '1';
            // Only fade the pour out once the drip is fully visible
            setTimeout(() => {
                if (pintVideo) {
                    pintVideo.style.transition = 'opacity 0.3s ease-out';
                    pintVideo.style.opacity    = '0';
                }
            }, DRIP_XFADE * 1000);
            startDripMonitor();
        }

        function stopDripLoop() {
            if (!dripA) return;
            dripIsActive  = false;
            dripCrossfade = false;
            if (dripMonitor) { clearInterval(dripMonitor); dripMonitor = null; }
            dripReset(dripA);
            dripReset(dripB);
        }

        // Trigger drip loop automatically when the pour video finishes
        if (pintVideo) {
            pintVideo.addEventListener('ended', () => {
                if (pintIsActive) startDripLoop();
            });
        }

        function stopPintEffect() {
            if (!pintVideo) return;
            pintIsActive = false;
            if (pintMonitor) { clearInterval(pintMonitor); pintMonitor = null; }
            pintVideo.pause();
            pintVideo.currentTime = 0;
            pintVideo.style.transition = 'none';
            pintVideo.style.opacity    = '0';
            stopDripLoop();
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

                // Pre-roll kettle steam: start the fade-in at frame 52/53 (3 frames
                // before the stop) so steam is fully opaque when frame 55 lands.
                if (targetProgress === STOP_POINTS[KETTLE_STEP] && !kettleIsActive) {
                    const framesRemaining = (targetProgress - currentProgress) * FRAME_COUNT;
                    if (framesRemaining <= 8) startKettleEffect(KETTLE_STEP);
                }

                // Pre-roll pint video: start 2 frames early so the video's first
                // frame is already painted when the canvas snaps to frame 240.
                if (targetProgress === STOP_POINTS[PINT_STEP] && !pintIsActive) {
                    const framesRemaining = (targetProgress - currentProgress) * FRAME_COUNT;
                    if (framesRemaining <= 2) startPintEffect(PINT_STEP);
                }

                // Show continue button the moment the last frame arrives —
                // same paint cycle as the animation visually stopping.
                if (currentStep === STEP_COUNT - 1) {
                    const framesRemaining = (targetProgress - currentProgress) * FRAME_COUNT;
                    if (framesRemaining <= 1 && continueBtn && continueBtn.style.display !== 'flex') {
                        updateNavState();
                    }
                }

                if (reachedTarget || t >= 1) {
                    currentProgress = targetProgress; // snap exactly
                    animStartTime   = null;           // animation complete
                    startSteamEffect(currentStep);    // start mash-kettle steam if this is step 2
                    startKettleEffect(currentStep);   // no-op if pre-roll already fired
                    startPintEffect(currentStep);     // start pint fill if this is step 3

                    // Dissolve bridge: instantly show the original frame 55 (with real
                    // steam) over the clean canvas frame so the switch is invisible.
                    // Then fade it out over 1.2s — real steam dissolves into animated.
                    if (targetProgress === STOP_POINTS[KETTLE_STEP] && frame55Overlay) {
                        frame55Overlay.style.transition = 'none';
                        frame55Overlay.style.opacity    = '1';
                        setTimeout(() => {
                            frame55Overlay.style.transition = 'opacity 1.2s ease-out';
                            frame55Overlay.style.opacity    = '0';
                        }, 400);
                    }
                }
                renderStoryFrame(currentProgress);
                applyTextOpacities(currentProgress);
            }

            requestAnimationFrame(renderLoop);
        }

        // Start a new animation toward a target progress value (0–1).
        // Duration scales with the number of frames covered to keep visual speed uniform.
        function startAnimation(target) {
            stopSteamEffect();
            stopKettleEffect();
            stopPintEffect();
            targetProgress      = Math.max(0, Math.min(1, target));
            animStartProgress   = currentProgress;
            animStartTime       = performance.now();
            const framesToCover = Math.abs(targetProgress - animStartProgress) * FRAME_COUNT;
            activeAnimDuration  = Math.round(framesToCover * MS_PER_FRAME);
        }

        // ── Phase controller ──────────────────────────────────────────────────
        // direction: 'forward' (from an earlier slide) | 'backward' (from a later slide)
        // Only relevant when phase === 1.
        function goPhase(phase, direction = 'forward') {
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
                hideSlide1();
                // Cloth canvas is managed autonomously by the teatowel module's MutationObserver
            } else if (phase === 1) {
                slides[1].classList.add('is-active');
                if (canvas) canvas.classList.remove('is-visible');
                // Cloth canvas lifecycle managed by teatowel module's MutationObserver
                if (prevBtn) prevBtn.disabled = false;
                if (nextBtn) nextBtn.disabled = false;
                // Stop cloth sim to free resources while on other slides
                if (direction === 'backward') showSlide1Backward();
                else                          showSlide1Forward();
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
                // Stop cloth sim — not needed during canvas scrub
                currentStep       = 0;
                targetProgress    = 0;
                currentProgress   = 0;
                animStartProgress = 0;
                animStartTime     = null;
                renderStoryFrame(0);    // paint frame 1 immediately
                applyTextOpacities(0);  // show first text box immediately at rest
                if (prevBtn) prevBtn.disabled = false;
                hideSlide1();
                updateNavState();      // reset next/continue visibility for step 0
            }

            setTimeout(() => { isAnimating = false; }, 800);
        }

        // ── Overlay open / close ──────────────────────────────────────────────
        function openOverlay() {
            isOpen = true;
            overlay.classList.add('is-open');
            overlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('no-scroll');
            // Lock logo to header position for consistent placement on every slide
            const demoEl = document.getElementById('demo-content');
            if (demoEl) { demoEl.classList.add('is-header'); demoEl.style.opacity = '1'; }
            goPhase(0);
            if (!isLooping) { isLooping = true; requestAnimationFrame(renderLoop); }
        }

        function closeOverlay(continueStory) {
            if (!isOpen) return;
            isOpen       = false;
            isAnimating  = false;  // always unblock — may have been mid-transition
            isLooping    = false;
            stopSteamEffect();
            stopKettleEffect();
            stopPintEffect();
            // Stop cloth simulation
            currentPhase    = 0;
            targetProgress    = 0;
            currentProgress   = 0;
            animStartProgress = 0;
            animStartTime     = null;
            hopReversePlaying = false;
            hideSlide1();

            overlay.classList.remove('is-open');
            overlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('no-scroll');
            // Hand logo opacity back to the scroll animation handler
            const demoElClose = document.getElementById('demo-content');
            if (demoElClose) demoElClose.style.opacity = '';

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
            if (prevBtn)     prevBtn.disabled      = true;
            // Reset nav button states so re-entry starts clean
            if (nextBtn) {
                nextBtn.style.display    = '';
                nextBtn.style.opacity    = '';
                nextBtn.style.transition = '';
            }
            if (continueBtn) continueBtn.style.display = 'none';

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

        // Nav links close the overlay first, then navigate to their target
        const navDropdown = document.getElementById('nav-dropdown');
        if (navDropdown) {
            navDropdown.addEventListener('click', (e) => {
                const link = e.target.closest('a[href], button');
                if (!link || !isOpen) return;
                e.preventDefault();
                const href = link.getAttribute('href');
                closeOverlay(false);
                // Wait for overlay fade-out (450 ms) then navigate
                setTimeout(() => {
                    if (!href || href === '#') {
                        // Re-show the scroll-container in case Skip Animation hid it
                        const sc = document.querySelector('.scroll-container');
                        if (sc) sc.style.display = '';
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    } else if (href.startsWith('#')) {
                        const target = document.getElementById(href.slice(1));
                        if (target) target.scrollIntoView({ behavior: 'smooth' });
                    } else {
                        window.location.href = href;
                    }
                }, 460);
            });
        }

        function updateNavState() {
            const isLast = (currentPhase === 2 && currentStep === STEP_COUNT - 1);
            if (nextBtn)    { nextBtn.style.display    = isLast ? 'none'  : ''; }
            if (continueBtn){ continueBtn.style.display = isLast ? 'flex'  : 'none'; }
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if      (currentPhase === 0) goPhase(1, 'forward');
                else if (currentPhase === 1) { isAnimating = false; goPhase(2); }
                else if (currentPhase === 2) {
                    if (currentStep < STEP_COUNT - 1) {
                        currentStep++;
                        startAnimation(STOP_POINTS[currentStep]);
                        if (continueBtn) continueBtn.style.display = 'none';
                        // Fade next button out over the opening frames of the final animation
                        if (currentStep === STEP_COUNT - 1) {
                            nextBtn.style.transition = 'opacity 0.5s ease-out';
                            nextBtn.style.opacity    = '0';
                        }
                    }
                }
            });
        }
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPhase === 1) {
                    isAnimating = true;
                    playReverseAndGoBack();
                }
                else if (currentPhase === 2) {
                    if (currentStep > 0) {
                        currentStep--;
                        startAnimation(STOP_POINTS[currentStep]);
                        // navigating backward always hides continue, restores next
                        if (continueBtn) continueBtn.style.display = 'none';
                        if (nextBtn) {
                            nextBtn.style.transition = '';
                            nextBtn.style.opacity    = '';
                            nextBtn.style.display    = '';
                        }
                    } else {
                        isAnimating = false; goPhase(1, 'backward');
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
            // Re-show the scroll-container in case Skip Animation hid it
            const sc = document.querySelector('.scroll-container');
            if (sc) sc.style.display = '';
            window.scrollTo({ top: 0, behavior: 'smooth' });
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

    // ── Cloth simulation resize ───────────────────────────────────────────────
    // Debounced resize handler for cloth
    let clothResizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(clothResizeTimer);
        // Resize now handled autonomously by WebGPU component
    });

});
