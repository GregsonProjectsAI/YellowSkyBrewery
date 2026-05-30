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

    // Story Overlay Controller
    (function () {
        const overlay    = document.getElementById('story-overlay');
        const openBtn    = document.getElementById('story-open-btn');
        const closeBtn   = document.getElementById('story-close-btn');
        const continueBtn = document.getElementById('story-continue-btn');
        const track      = document.getElementById('story-slides-track');
        const dots       = document.querySelectorAll('.story-dot');
        const prevBtn    = document.getElementById('story-prev');
        const nextBtn    = document.getElementById('story-next');

        if (!overlay || !openBtn) return;

        const TOTAL_SLIDES = 6;
        let currentSlide = 0;
        let isOpen = false;
        let touchStartX = 0;
        let wheelTimer = null;

        function goToSlide(index) {
            // Clamp — do not go beyond the last slide or before the first
            index = Math.max(0, Math.min(TOTAL_SLIDES - 1, index));
            currentSlide = index;

            // Slide the track — each slide occupies (100/TOTAL_SLIDES)% of the track
            track.style.transform = `translateX(${-(index * 100 / TOTAL_SLIDES)}%)`;

            // Sync dots
            dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));

            // Sync arrows — only disable prev on slide 0; next is always active
            prevBtn.disabled = index === 0;
            nextBtn.disabled = false;
        }

        function openOverlay() {
            isOpen = true;
            goToSlide(0);
            overlay.classList.add('is-open');
            overlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('no-scroll');
        }

        function closeOverlay(continueStory) {
            isOpen = false;
            overlay.classList.remove('is-open');
            overlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('no-scroll');
            if (continueStory) {
                // Scroll back to the story section but a little further in,
                // so the page implies "keep scrolling" rather than jumping away.
                const storySection = document.getElementById('story');
                if (storySection) {
                    const rect = storySection.getBoundingClientRect();
                    const nudge = window.innerHeight * 0.35; // 35vh into the section
                    window.scrollTo({
                        top: window.scrollY + rect.top + nudge,
                        behavior: 'smooth'
                    });
                }
            }
        }

        // Open via CTA button
        openBtn.addEventListener('click', openOverlay);

        // Close via ✕ button
        closeBtn.addEventListener('click', () => closeOverlay(false));

        // Continue → close overlay and nudge into the story section
        if (continueBtn) {
            continueBtn.addEventListener('click', () => closeOverlay(true));
        }

        // Click on dark backdrop (not on overlay children)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeOverlay(false);
        });

        // Arrow buttons
        prevBtn.addEventListener('click', () => goToSlide(currentSlide - 1));
        nextBtn.addEventListener('click', () => goToSlide(currentSlide + 1));

        // Dot clicks
        dots.forEach(dot => {
            dot.addEventListener('click', () => {
                goToSlide(parseInt(dot.getAttribute('data-index'), 10));
            });
        });

        // Keyboard — arrow keys + Escape
        document.addEventListener('keydown', (e) => {
            if (!isOpen) return;
            if (e.key === 'ArrowRight') goToSlide(currentSlide + 1);
            if (e.key === 'ArrowLeft')  goToSlide(currentSlide - 1);
            if (e.key === 'Escape')     closeOverlay(false);
        });

        // Scroll wheel — debounced so one notch = one slide
        overlay.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (wheelTimer) return;
            if (e.deltaY > 0 || e.deltaX > 0) {
                goToSlide(currentSlide + 1);
            } else {
                goToSlide(currentSlide - 1);
            }
            wheelTimer = setTimeout(() => { wheelTimer = null; }, 650);
        }, { passive: false });

        // Touch swipe
        overlay.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });

        overlay.addEventListener('touchend', (e) => {
            const delta = touchStartX - e.changedTouches[0].clientX;
            if (Math.abs(delta) > 50) {
                goToSlide(delta > 0 ? currentSlide + 1 : currentSlide - 1);
            }
        }, { passive: true });
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
});
