document.addEventListener('DOMContentLoaded', () => {

    // ── Shared state ──────────────────────────────────────────────────────────
    let allPosts      = null;   // cached after first fetch
    let currentFilter = 'all';

    // ── Helper utilities ──────────────────────────────────────────────────────
    function escapeHTML(str) {
        return str ? str.replace(/[&<>'"]/g,
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        ) : '';
    }

    function truncateText(str, maxLength) {
        if (!str || str.length <= maxLength) return str || '';
        return str.substring(0, maxLength).trim() + '...';
    }

    function formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    }

    // ── Card HTML builders ────────────────────────────────────────────────────
    function buildBrewLogCard(post, truncate) {
        const brewDate = post.brewDate ? formatDate(post.brewDate) : 'N/A';
        const notesLen = truncate ? 160 : 99999;
        return `
            <div class="blog-card__header">
                <span class="blog-badge blog-badge--brew-log">Brew Log 🍺</span>
                <span class="blog-card__date">${formatDate(post.createdAt)}</span>
            </div>
            <h3 class="blog-card__title">${escapeHTML(post.beerName)}</h3>
            <div class="blog-card__meta-grid">
                <div class="blog-card__meta-item"><span class="blog-card__meta-label">Style:</span><span class="blog-card__meta-value">${escapeHTML(post.style)}</span></div>
                <div class="blog-card__meta-item"><span class="blog-card__meta-label">Batch:</span><span class="blog-card__meta-value">${escapeHTML(post.batchNumber)}</span></div>
                <div class="blog-card__meta-item"><span class="blog-card__meta-label">Brewed:</span><span class="blog-card__meta-value">${brewDate}</span></div>
                ${post.yeast ? `<div class="blog-card__meta-item"><span class="blog-card__meta-label">Yeast:</span><span class="blog-card__meta-value">${escapeHTML(post.yeast)}</span></div>` : ''}
                ${post.originalGravity ? `<div class="blog-card__meta-item"><span class="blog-card__meta-label">OG:</span><span class="blog-card__meta-value">${escapeHTML(post.originalGravity)}</span></div>` : ''}
                ${post.finalGravity ? `<div class="blog-card__meta-item"><span class="blog-card__meta-label">FG:</span><span class="blog-card__meta-value">${escapeHTML(post.finalGravity)}</span></div>` : ''}
            </div>
            ${post.brewDayNotes ? `<div class="blog-card__snippet-box"><h4 class="blog-card__snippet-title">Brew Day Notes:</h4><p class="blog-card__snippet-text">${truncateText(escapeHTML(post.brewDayNotes), notesLen)}</p></div>` : ''}
            ${post.tastingNotes ? `<div class="blog-card__snippet-box blog-card__snippet-box--tasting"><h4 class="blog-card__snippet-title">Tasting Notes:</h4><p class="blog-card__snippet-text">${truncateText(escapeHTML(post.tastingNotes), notesLen)}</p></div>` : ''}
        `;
    }

    function buildEventCard(post) {
        const eventDateTime = post.eventDateTime ? new Date(post.eventDateTime).toLocaleString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : 'N/A';
        return `
            <div class="blog-card__header">
                <span class="blog-badge blog-badge--event">Event 📅</span>
                <span class="blog-card__date">${formatDate(post.createdAt)}</span>
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
            ${post.ticketLink ? `<a href="${escapeHTML(post.ticketLink)}" target="_blank" rel="noopener noreferrer" class="blog-card__btn-tickets">Get Tickets &rarr;</a>` : ''}
        `;
    }

    function buildGeneralCard(post) {
        const tagList = post.tags ? post.tags.split(',').map(t => t.trim()).filter(t => t) : [];
        return `
            <div class="blog-card__header">
                <span class="blog-badge blog-badge--general">Update 📝</span>
                <span class="blog-card__date">${formatDate(post.createdAt)}</span>
            </div>
            <h3 class="blog-card__title">${escapeHTML(post.title)}</h3>
            <p class="blog-card__body">${escapeHTML(post.body)}</p>
            ${tagList.length > 0 ? `<div class="blog-card__tags">${tagList.map(tag => `<span class="blog-card__tag">#${escapeHTML(tag)}</span>`).join('')}</div>` : ''}
        `;
    }

    function buildCardHTML(post, truncate = true) {
        if (post.type === 'brew-log') return buildBrewLogCard(post, truncate);
        if (post.type === 'event')    return buildEventCard(post);
        return buildGeneralCard(post);
    }

    // ── Homepage feed (top 3) ─────────────────────────────────────────────────
    const feedContainer = document.getElementById('blog-posts-feed');

    function renderFeed(posts) {
        if (!feedContainer) return;
        if (posts.length === 0) {
            feedContainer.innerHTML = `<div class="blog-empty-state"><p>No updates yet — check back soon!</p></div>`;
            return;
        }
        feedContainer.innerHTML = '';
        posts.slice(0, 3).forEach(post => {
            const card = document.createElement('article');
            card.className = `blog-card blog-card--${post.type} fade-up`;
            card.innerHTML = buildCardHTML(post, true);
            feedContainer.appendChild(card);

            if (window.IntersectionObserver) {
                const obs = new IntersectionObserver(entries => {
                    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); } });
                }, { threshold: 0.15 });
                obs.observe(card);
            } else {
                card.classList.add('is-visible');
            }
        });
    }

    // ── Archive overlay ───────────────────────────────────────────────────────
    const overlay     = document.getElementById('blog-archive-overlay');
    const archiveGrid = document.getElementById('blog-archive-grid');
    const openBtn     = document.getElementById('blog-archive-open-btn');
    const closeBtn    = document.getElementById('blog-archive-close-btn');
    const filterBtns  = document.querySelectorAll('.blog-filter-btn');

    function renderArchive(posts, filter) {
        if (!archiveGrid) return;
        const filtered = filter === 'all' ? posts : posts.filter(p => p.type === filter);

        if (filtered.length === 0) {
            archiveGrid.innerHTML = `<div class="blog-empty-state"><p>No posts in this category yet.</p></div>`;
            return;
        }

        archiveGrid.innerHTML = '';
        filtered.forEach(post => {
            const card = document.createElement('article');
            card.className = `blog-card blog-card--${post.type} is-visible`;
            card.innerHTML = buildCardHTML(post, false); // full text in archive
            archiveGrid.appendChild(card);
        });
    }

    function openArchive() {
        if (!overlay) return;
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('no-scroll');

        if (allPosts !== null) {
            // Already fetched — render instantly from cache
            renderArchive(allPosts, currentFilter);
            return;
        }

        archiveGrid.innerHTML = `<p class="blog-archive-loading">Loading archive...</p>`;

        fetch('/api/posts')
            .then(r => { if (!r.ok) throw new Error('Network error'); return r.json(); })
            .then(data => {
                allPosts = data.posts || [];
                renderFeed(allPosts);        // also update homepage feed while we're here
                renderArchive(allPosts, currentFilter);
            })
            .catch(() => {
                archiveGrid.innerHTML = `<div class="blog-error"><p>Could not load the archive. Please try again.</p></div>`;
            });
    }

    function closeArchive() {
        if (!overlay) return;
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('no-scroll');
    }

    if (openBtn)  openBtn.addEventListener('click', openArchive);
    if (closeBtn) closeBtn.addEventListener('click', closeArchive);

    // Escape key closes
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && overlay && overlay.classList.contains('is-open')) closeArchive();
    });

    // Click outside the panel closes
    if (overlay) {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeArchive();
        });
    }

    // Category filters
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            currentFilter = btn.getAttribute('data-filter');
            if (allPosts !== null) renderArchive(allPosts, currentFilter);
        });
    });

    // ── Initial homepage fetch ────────────────────────────────────────────────
    if (feedContainer) {
        fetch('/api/posts')
            .then(r => { if (!r.ok) throw new Error('Network error'); return r.json(); })
            .then(data => {
                allPosts = data.posts || [];
                renderFeed(allPosts);
            })
            .catch(() => {
                if (feedContainer) feedContainer.innerHTML = `<div class="blog-error"><p>Failed to load recent updates.</p></div>`;
            });
    }
});
