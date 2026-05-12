document.addEventListener('DOMContentLoaded', () => {

    // OPTION 1: Sticky Parallax
    const chapters = document.querySelectorAll('.story-chapter');
    const images = document.querySelectorAll('.story-img');

    if (chapters.length > 0 && typeof IntersectionObserver !== 'undefined') {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Dim all chapters, highlight active
                    chapters.forEach(c => c.classList.remove('active'));
                    entry.target.classList.add('active');

                    // Switch image
                    const imgId = entry.target.getAttribute('data-image');
                    images.forEach(img => img.classList.remove('active'));
                    const targetImg = document.getElementById('img-' + imgId);
                    if (targetImg) targetImg.classList.add('active');
                }
            });
        }, { threshold: 0.5 }); // Trigger when chapter is 50% visible

        chapters.forEach(c => observer.observe(c));
    }


    // OPTION 2: Horizontal Scroll
    const horizontalWrapper = document.querySelector('.horizontal-scroll-wrapper');
    const horizontalContainer = document.querySelector('.horizontal-scroll-container');
    const panels = document.querySelectorAll('.h-panel');
    
    if (horizontalWrapper && horizontalContainer && panels.length > 0) {
        // We set the width of the container to 100vw * number of panels
        horizontalContainer.style.width = `${panels.length * 100}vw`;

        window.addEventListener('scroll', () => {
            // Get boundaries of the wrapper
            const wrapperRect = horizontalWrapper.getBoundingClientRect();
            
            // If the top of the wrapper is above or exactly at viewport top,
            // and the bottom of the wrapper hasn't passed the viewport top
            if (wrapperRect.top <= 0 && wrapperRect.bottom >= window.innerHeight) {
                // Calculate scroll progress percentage
                const scrollableDistance = wrapperRect.height - window.innerHeight;
                const scrolledAmount = -wrapperRect.top; // Distance scrolled within the wrapper
                
                const progress = scrolledAmount / scrollableDistance;
                
                // Translate the container to the left based on progress
                // The maximum translate is (panels.length - 1) * 100vw
                const maxTranslate = (panels.length - 1) * 100;
                horizontalContainer.style.transform = `translateX(-${progress * maxTranslate}vw)`;
            } else if (wrapperRect.top > 0) {
                // Before wrapper
                horizontalContainer.style.transform = `translateX(0vw)`;
            } else if (wrapperRect.bottom < window.innerHeight) {
                // After wrapper
                const maxTranslate = (panels.length - 1) * 100;
                horizontalContainer.style.transform = `translateX(-${maxTranslate}vw)`;
            }
        });
    }

    // OPTION 3: Cascading Polaroids (Parallax)
    const polaroids = document.querySelectorAll('.polaroid');
    
    if (polaroids.length > 0) {
        window.addEventListener('scroll', () => {
            polaroids.forEach(p => {
                const speed = parseFloat(p.getAttribute('data-speed'));
                
                // Calculate position relative to the element's container to ensure
                // it only starts moving heavily when it's near the viewport
                const rect = p.parentElement.getBoundingClientRect();
                
                // Very simple parallax calculation based on how far the container is from the bottom of the screen
                const yPos = -(window.scrollY * speed * 0.1); 
                
                // Keep the initial rotation if it has one
                let rotation = 'rotate(0deg)';
                if (p.classList.contains('p-1')) rotation = 'rotate(-5deg)';
                if (p.classList.contains('p-3')) rotation = 'rotate(3deg)';
                if (p.classList.contains('p-5')) rotation = 'rotate(-2deg)';

                p.style.transform = `translateY(${yPos}px) ${rotation}`;
            });
        });
    }
});
