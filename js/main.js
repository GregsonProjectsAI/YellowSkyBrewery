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

                    // Click: lock this card into the viewer
                    card.addEventListener('click', () => {
                        lockedCard = card;
                        cards.forEach(c => c.classList.remove('is-active'));
                        card.classList.add('is-active');
                        updateViewer(card);
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
            // Going past the last slide closes the overlay and continues the page
            if (index > TOTAL_SLIDES - 1) {
                closeOverlay(true);
                return;
            }

            index = Math.max(0, index);
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

        function closeOverlay(scrollToBeers) {
            isOpen = false;
            overlay.classList.remove('is-open');
            overlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('no-scroll');
            if (scrollToBeers) {
                const beersSection = document.getElementById('beers');
                if (beersSection) beersSection.scrollIntoView({ behavior: 'smooth' });
            }
        }

        // Open via CTA button
        openBtn.addEventListener('click', openOverlay);

        // Close via ✕ button
        closeBtn.addEventListener('click', () => closeOverlay(false));

        // Continue → scroll to beers section
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
    // The dropdown lives outside the scaled logo container so it renders at full
    // size. We use a small hide-delay so the menu stays open as the mouse
    // travels from the logo down into the dropdown panel.
    (function () {
        const logoEl    = document.getElementById('demo-content');
        const dropEl    = document.getElementById('nav-dropdown');
        if (!logoEl || !dropEl) return;

        let hideTimer = null;

        function showDropdown() {
            clearTimeout(hideTimer);
            // Only show once the logo has moved to the header corner
            if (logoEl.classList.contains('is-header')) {
                dropEl.classList.add('is-open');
            }
        }

        function scheduleHide() {
            hideTimer = setTimeout(() => {
                dropEl.classList.remove('is-open');
            }, 120); // 120ms grace period for mouse travel
        }

        logoEl.addEventListener('mouseenter', showDropdown);
        logoEl.addEventListener('mouseleave', scheduleHide);
        dropEl.addEventListener('mouseenter', showDropdown);
        dropEl.addEventListener('mouseleave', scheduleHide);
    })();
});
