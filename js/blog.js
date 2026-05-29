document.addEventListener('DOMContentLoaded', () => {
    const blogContainer = document.getElementById('blog-posts-feed');
    if (!blogContainer) return;

    fetch('/api/posts')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const posts = data.posts || [];
            renderRecentPosts(posts);
        })
        .catch(error => {
            console.error('Error fetching blog posts:', error);
            blogContainer.innerHTML = `
                <div class="blog-error">
                    <p>Failed to load recent updates. Please try refreshing the page.</p>
                </div>
            `;
        });

    function renderRecentPosts(posts) {
        if (posts.length === 0) {
            blogContainer.innerHTML = `
                <div class="blog-empty-state">
                    <p>No updates have been published yet. Check back soon for new brew logs and taproom events!</p>
                </div>
            `;
            return;
        }

        // Display up to 3 most recent posts
        const recentPosts = posts.slice(0, 3);
        blogContainer.innerHTML = '';

        recentPosts.forEach(post => {
            const card = document.createElement('article');
            card.className = `blog-card blog-card--${post.type} fade-up`;
            
            // Format dates
            const createdDate = new Date(post.createdAt);
            const formattedDate = createdDate.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });

            let cardContent = '';

            if (post.type === 'brew-log') {
                const brewDate = post.brewDate ? new Date(post.brewDate).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }) : 'N/A';

                cardContent = `
                    <div class="blog-card__header">
                        <span class="blog-badge blog-badge--brew-log">Brew Log 🍺</span>
                        <span class="blog-card__date">${formattedDate}</span>
                    </div>
                    <h3 class="blog-card__title">${escapeHTML(post.beerName)}</h3>
                    <div class="blog-card__meta-grid">
                        <div class="blog-card__meta-item">
                            <span class="blog-card__meta-label">Style:</span>
                            <span class="blog-card__meta-value">${escapeHTML(post.style)}</span>
                        </div>
                        <div class="blog-card__meta-item">
                            <span class="blog-card__meta-label">Batch:</span>
                            <span class="blog-card__meta-value">${escapeHTML(post.batchNumber)}</span>
                        </div>
                        <div class="blog-card__meta-item">
                            <span class="blog-card__meta-label">Brewed:</span>
                            <span class="blog-card__meta-value">${brewDate}</span>
                        </div>
                        ${post.yeast ? `
                        <div class="blog-card__meta-item">
                            <span class="blog-card__meta-label">Yeast:</span>
                            <span class="blog-card__meta-value">${escapeHTML(post.yeast)}</span>
                        </div>` : ''}
                        ${post.originalGravity ? `
                        <div class="blog-card__meta-item">
                            <span class="blog-card__meta-label">OG:</span>
                            <span class="blog-card__meta-value">${escapeHTML(post.originalGravity)}</span>
                        </div>` : ''}
                        ${post.finalGravity ? `
                        <div class="blog-card__meta-item">
                            <span class="blog-card__meta-label">FG:</span>
                            <span class="blog-card__meta-value">${escapeHTML(post.finalGravity)}</span>
                        </div>` : ''}
                    </div>
                    ${post.brewDayNotes ? `
                    <div class="blog-card__snippet-box">
                        <h4 class="blog-card__snippet-title">Brew Day Notes:</h4>
                        <p class="blog-card__snippet-text">${truncateText(escapeHTML(post.brewDayNotes), 160)}</p>
                    </div>` : ''}
                    ${post.tastingNotes ? `
                    <div class="blog-card__snippet-box blog-card__snippet-box--tasting">
                        <h4 class="blog-card__snippet-title">Tasting Notes:</h4>
                        <p class="blog-card__snippet-text">${truncateText(escapeHTML(post.tastingNotes), 160)}</p>
                    </div>` : ''}
                `;
            } else if (post.type === 'event') {
                const eventDateTime = post.eventDateTime ? new Date(post.eventDateTime).toLocaleString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'N/A';

                cardContent = `
                    <div class="blog-card__header">
                        <span class="blog-badge blog-badge--event">Event 📅</span>
                        <span class="blog-card__date">${formattedDate}</span>
                    </div>
                    <h3 class="blog-card__title">${escapeHTML(post.eventName)}</h3>
                    <div class="blog-card__details">
                        <div class="blog-card__detail-row">
                            <svg class="blog-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 0 0-10 10c0 5.25 10 12 10 12s10-6.75 10-12a10 10 0 0 0-10-10z"/><circle cx="12" cy="10" r="3"/></svg>
                            <span><strong>Venue:</strong> ${escapeHTML(post.venue)}</span>
                        </div>
                        <div class="blog-card__detail-row">
                            <svg class="blog-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            <span><strong>When:</strong> ${eventDateTime}</span>
                        </div>
                    </div>
                    <p class="blog-card__body">${escapeHTML(post.description)}</p>
                    ${post.ticketLink ? `
                    <a href="${escapeHTML(post.ticketLink)}" target="_blank" rel="noopener noreferrer" class="blog-card__btn-tickets">
                        Get Tickets &rarr;
                    </a>` : ''}
                `;
            } else {
                // General Post
                const tagList = post.tags ? post.tags.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
                
                cardContent = `
                    <div class="blog-card__header">
                        <span class="blog-badge blog-badge--general">Update 📝</span>
                        <span class="blog-card__date">${formattedDate}</span>
                    </div>
                    <h3 class="blog-card__title">${escapeHTML(post.title)}</h3>
                    <p class="blog-card__body">${escapeHTML(post.body)}</p>
                    ${tagList.length > 0 ? `
                    <div class="blog-card__tags">
                        ${tagList.map(tag => `<span class="blog-card__tag">#${escapeHTML(tag)}</span>`).join('')}
                    </div>` : ''}
                `;
            }

            card.innerHTML = cardContent;
            blogContainer.appendChild(card);

            // Trigger scroll animation on newly added card if it is in viewport
            if (window.IntersectionObserver) {
                const cardObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('is-visible');
                            cardObserver.unobserve(entry.target);
                        }
                    });
                }, { threshold: 0.15 });
                cardObserver.observe(card);
            } else {
                card.classList.add('is-visible');
            }
        });
    }

    // Helper functions
    function escapeHTML(str) {
        return str ? str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        ) : '';
    }

    function truncateText(str, maxLength) {
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength).trim() + '...';
    }
});
