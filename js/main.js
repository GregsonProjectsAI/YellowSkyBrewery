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

            // Split Gallery Hover Engine for this specific gallery
            const cards = beerGrid.querySelectorAll('.beer-card');
            const previewPanel = gallery.querySelector('.beer-preview-panel');
            const previewImg = gallery.querySelector('.preview-img');
            const previewPintImg = gallery.querySelector('.preview-pint-img');
            const previewTitle = gallery.querySelector('.preview-title');
            const previewDesc = gallery.querySelector('.preview-desc');
            const flipCardFront = gallery.querySelector('.flip-card-front');

            if (cards.length > 0 && previewPanel && previewImg && previewPintImg && previewTitle && previewDesc) {
                cards.forEach(card => {
                    card.addEventListener('mouseenter', () => {
                        cards.forEach(c => c.classList.remove('is-active'));
                        card.classList.add('is-active');

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
                    });
                });
                
                // Initialize first card
                cards[0].classList.add('is-active');
            }
        }
    });

    // The Story So Far: Parallax Observer
    const storyChapters = document.querySelectorAll('.story-chapter');
    const storyImages = document.querySelectorAll('.story-img');

    if (storyChapters.length > 0 && typeof IntersectionObserver !== 'undefined') {
        const storyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Dim all chapters, highlight active
                    storyChapters.forEach(c => c.classList.remove('active'));
                    entry.target.classList.add('active');

                    // Switch image
                    const imgId = entry.target.getAttribute('data-image');
                    storyImages.forEach(img => img.classList.remove('active'));
                    const targetImg = document.getElementById('story-img-' + imgId);
                    if (targetImg) targetImg.classList.add('active');
                }
            });
        }, { threshold: 0.5 });

        storyChapters.forEach(c => storyObserver.observe(c));
    }
});
