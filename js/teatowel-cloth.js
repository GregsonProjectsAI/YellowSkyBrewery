/**
 * teatowel-cloth.js  v4
 * Interactive Verlet cloth simulation — Yellow Sky Brewery tea towel.
 * Slide 0 of the Our Story section.
 *
 * Rendering: per-quad clip + drawImage (robust Canvas 2D, no transform tricks).
 *
 * Public API:
 *   TeaTowelCloth.init(canvasEl, textureUrl, hintEl)
 *   TeaTowelCloth.start()
 *   TeaTowelCloth.stop()
 *   TeaTowelCloth.resize()
 */

const TeaTowelCloth = (() => {

    const CFG = {
        COLS: 28,
        ROWS: 40,
        TOWEL_WIDTH_RATIO:  0.36,
        TOWEL_HEIGHT_RATIO: 0.70,
        PIN_X_RATIOS: [0.18, 0.50, 0.82],
        GRAVITY:          0.38,
        DAMPING:          0.986,
        CONSTRAINT_ITER:  6,
        WIND_BASE:        0.09,
        WIND_FREQ:        0.0007,
        WIND_GUST_PROB:   0.003,
        WIND_GUST_AMP:    0.50,
        GRAB_RADIUS_PX:   80,
        GRAB_STIFFNESS:   0.35,
        HOVER_RADIUS_PX:  110,
        HOVER_AMP:        0.55,
        HINT_DELAY_MS:    2500,
        HINT_FADE_MS:     700,
    };

    let canvas, ctx, texture;
    let textureLoaded = false;
    let particles = [], constraints = [];
    let running = false, rafHandle = null, frameCount = 0;
    let towelX0 = 0, towelY0 = 0, towelW = 0, towelH = 0;
    let gustAmp = 0, gustDecay = 0.96;
    let grabIdx = null, mouseX = -9999, mouseY = -9999, isDown = false;
    let hintEl = null, hintShown = false, hintTimer = null;

    // ── Build cloth ────────────────────────────────────────────────────────────
    function buildCloth() {
        particles = [];
        constraints = [];
        if (towelW <= 0 || towelH <= 0) return;

        const COLS = CFG.COLS, ROWS = CFG.ROWS;
        const sx = towelW / (COLS - 1);
        const sy = towelH / (ROWS - 1);

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                let pinned = false;
                if (r === 0) {
                    for (const px of CFG.PIN_X_RATIOS) {
                        if (c === Math.round(px * (COLS - 1))) { pinned = true; break; }
                    }
                }
                const x = towelX0 + c * sx;
                const y = towelY0 + r * sy;
                particles.push({ x, y, ox: x, oy: y,
                                  u: c / (COLS - 1), v: r / (ROWS - 1), pinned });
            }
        }

        const diag = Math.hypot(sx, sy);
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const i = r * COLS + c;
                if (c < COLS - 1) constraints.push({ a: i, b: i + 1,        len: sx   });
                if (r < ROWS - 1) constraints.push({ a: i, b: i + COLS,     len: sy   });
                if (c < COLS - 1 && r < ROWS - 1) {
                    constraints.push({ a: i,     b: i + COLS + 1, len: diag });
                    constraints.push({ a: i + 1, b: i + COLS,     len: diag });
                }
            }
        }
    }

    // ── Physics ────────────────────────────────────────────────────────────────
    function step() {
        const COLS = CFG.COLS;
        const wind = Math.sin(frameCount * CFG.WIND_FREQ) * CFG.WIND_BASE
                   + Math.sin(frameCount * CFG.WIND_FREQ * 2.3 + 0.8) * CFG.WIND_BASE * 0.35;

        if (!isDown && Math.random() < CFG.WIND_GUST_PROB) {
            gustAmp   = CFG.WIND_GUST_AMP * (0.5 + Math.random() * 0.5);
            gustDecay = 0.93 + Math.random() * 0.05;
        }
        const W = wind + gustAmp;
        gustAmp *= gustDecay;

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p.pinned) continue;
            const vx = (p.x - p.ox) * CFG.DAMPING;
            const vy = (p.y - p.oy) * CFG.DAMPING;
            p.ox = p.x; p.oy = p.y;
            const wave = Math.sin(frameCount * 0.022 + (i % COLS) * 0.26 + Math.floor(i / COLS) * 0.07);
            p.x += vx + W * wave;
            p.y += vy + CFG.GRAVITY;
        }

        // Hover ripple
        if (!isDown && mouseX > -100) {
            const R2 = CFG.HOVER_RADIUS_PX ** 2;
            for (const p of particles) {
                if (p.pinned) continue;
                const dx = p.x - mouseX, dy = p.y - mouseY;
                const d2 = dx * dx + dy * dy;
                if (d2 < R2 && d2 > 0.01) {
                    const d = Math.sqrt(d2);
                    const s = (1 - d / CFG.HOVER_RADIUS_PX) * CFG.HOVER_AMP;
                    p.x += (dx / d) * s;
                    p.y += (dy / d) * s * 0.3;
                }
            }
        }

        // Grab
        if (grabIdx !== null && isDown) {
            const p = particles[grabIdx];
            if (p && !p.pinned) {
                p.x += (mouseX - p.x) * CFG.GRAB_STIFFNESS;
                p.y += (mouseY - p.y) * CFG.GRAB_STIFFNESS;
            }
        }

        // Constraints
        for (let it = 0; it < CFG.CONSTRAINT_ITER; it++) {
            for (const c of constraints) {
                const pa = particles[c.a], pb = particles[c.b];
                const dx = pb.x - pa.x, dy = pb.y - pa.y;
                const dist = Math.hypot(dx, dy) || 0.001;
                const diff = (dist - c.len) / dist * 0.5;
                if (!pa.pinned) { pa.x += dx * diff; pa.y += dy * diff; }
                if (!pb.pinned) { pb.x -= dx * diff; pb.y -= dy * diff; }
            }
        }
    }

    // ── Rendering ──────────────────────────────────────────────────────────────
    /**
     * Per-quad rendering: clip to the actual quad polygon, then draw the
     * corresponding texture slice stretched into its bounding box.
     * Simple, reliable Canvas 2D — no transform tricks.
     */
    function renderCloth() {
        const COLS = CFG.COLS, ROWS = CFG.ROWS;
        const iW = texture.naturalWidth, iH = texture.naturalHeight;
        const srcW = iW / (COLS - 1);
        const srcH = iH / (ROWS - 1);

        // ── Step 1: draw the cloth outline as a filled polygon ─────────────
        // Gives a cream "fabric" base, so dark design elements pop against it
        // and the cloth silhouette deforms with physics.
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur  = 28;
        ctx.shadowOffsetX = 6;
        ctx.shadowOffsetY = 12;
        ctx.beginPath();
        // Top edge
        for (let c = 0; c < COLS; c++) {
            const p = particles[c];
            if (c === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        // Right edge
        for (let r = 1; r < ROWS; r++) ctx.lineTo(particles[r * COLS + COLS - 1].x, particles[r * COLS + COLS - 1].y);
        // Bottom edge (right to left)
        for (let c = COLS - 2; c >= 0; c--) ctx.lineTo(particles[(ROWS - 1) * COLS + c].x, particles[(ROWS - 1) * COLS + c].y);
        // Left edge (bottom to top)
        for (let r = ROWS - 2; r > 0; r--) ctx.lineTo(particles[r * COLS].x, particles[r * COLS].y);
        ctx.closePath();
        ctx.fillStyle = '#f0ead8';   // warm cream — tea-towel fabric colour
        ctx.fill();
        ctx.restore();

        // ── Step 2: draw texture quads over the cream base ─────────────────
        for (let r = 0; r < ROWS - 1; r++) {
            for (let c = 0; c < COLS - 1; c++) {
                const p00 = particles[r * COLS + c];
                const p10 = particles[r * COLS + c + 1];
                const p01 = particles[(r + 1) * COLS + c];
                const p11 = particles[(r + 1) * COLS + c + 1];

                const sx = c * srcW;
                const sy = r * srcH;

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(p00.x, p00.y);
                ctx.lineTo(p10.x, p10.y);
                ctx.lineTo(p11.x, p11.y);
                ctx.lineTo(p01.x, p01.y);
                ctx.closePath();
                ctx.clip();

                const minX = Math.min(p00.x, p10.x, p01.x, p11.x);
                const minY = Math.min(p00.y, p10.y, p01.y, p11.y);
                const maxX = Math.max(p00.x, p10.x, p01.x, p11.x);
                const maxY = Math.max(p00.y, p10.y, p01.y, p11.y);

                ctx.drawImage(texture, sx, sy, srcW, srcH,
                              minX, minY, maxX - minX + 1, maxY - minY + 1);

                ctx.restore();
            }
        }
    }

    // Fallback while texture loads
    function renderFallback() {
        ctx.fillStyle = '#1c1208';
        ctx.fillRect(towelX0, towelY0, towelW, towelH);

        // Pin indicators
        ctx.fillStyle = '#c8a020';
        for (const p of particles) {
            if (!p.pinned) continue;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ── Render loop ────────────────────────────────────────────────────────────
    function renderLoop() {
        if (!running) return;

        if (canvas.width < 10 || canvas.height < 10 || particles.length === 0) {
            doResize();
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (particles.length > 0) {
            step();
            if (textureLoaded) renderCloth();
            else               renderFallback();
        }

        frameCount++;
        rafHandle = requestAnimationFrame(renderLoop);
    }

    // ── Interaction ────────────────────────────────────────────────────────────
    function nearest(x, y) {
        let best = null, bestD2 = CFG.GRAB_RADIUS_PX ** 2;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i]; if (p.pinned) continue;
            const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
            if (d2 < bestD2) { bestD2 = d2; best = i; }
        }
        return best;
    }
    function canvasPos(e) {
        const r = canvas.getBoundingClientRect();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (cx - r.left) * (canvas.width  / r.width),
            y: (cy - r.top)  * (canvas.height / r.height)
        };
    }
    function onMove(e) {
        const p = canvasPos(e); mouseX = p.x; mouseY = p.y;
        if (!isDown) canvas.style.cursor = nearest(p.x, p.y) !== null ? 'grab' : 'default';
    }
    function onDown(e) {
        e.preventDefault();
        const p = canvasPos(e); mouseX = p.x; mouseY = p.y; isDown = true;
        grabIdx = nearest(p.x, p.y);
        if (grabIdx !== null) { canvas.style.cursor = 'grabbing'; dismissHint(); }
    }
    function onUp()    { isDown = false; grabIdx = null; canvas.style.cursor = 'default'; }
    function onLeave() { mouseX = -9999; mouseY = -9999; if (!isDown) grabIdx = null; }

    function bindEvents() {
        canvas.addEventListener('mousemove',  onMove,  { passive: true  });
        canvas.addEventListener('mousedown',  onDown,  { passive: false });
        canvas.addEventListener('mouseup',    onUp,    { passive: true  });
        canvas.addEventListener('mouseleave', onLeave, { passive: true  });
        canvas.addEventListener('touchstart', onDown,  { passive: false });
        canvas.addEventListener('touchmove',  onMove,  { passive: false });
        canvas.addEventListener('touchend',   onUp,    { passive: true  });
    }
    function unbindEvents() {
        canvas.removeEventListener('mousemove',  onMove);
        canvas.removeEventListener('mousedown',  onDown);
        canvas.removeEventListener('mouseup',    onUp);
        canvas.removeEventListener('mouseleave', onLeave);
        canvas.removeEventListener('touchstart', onDown);
        canvas.removeEventListener('touchmove',  onMove);
        canvas.removeEventListener('touchend',   onUp);
    }

    // ── Hint ───────────────────────────────────────────────────────────────────
    function showHint() {
        if (hintShown || localStorage.getItem('ysb_towel_ok') === '1') return;
        hintTimer = setTimeout(() => {
            if (!hintEl || hintShown) return;
            hintEl.style.transition = `opacity ${CFG.HINT_FADE_MS}ms ease`;
            hintEl.style.opacity = '1';
        }, CFG.HINT_DELAY_MS);
    }
    function dismissHint() {
        if (hintShown) return;
        hintShown = true;
        localStorage.setItem('ysb_towel_ok', '1');
        if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
        if (!hintEl) return;
        hintEl.style.transition = `opacity ${CFG.HINT_FADE_MS}ms ease`;
        hintEl.style.opacity = '0';
        setTimeout(() => { if (hintEl) hintEl.style.display = 'none'; }, CFG.HINT_FADE_MS + 50);
    }

    // ── Geometry & resize ──────────────────────────────────────────────────────
    function doResize() {
        if (!canvas) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width  = w;
        canvas.height = h;
        towelW  = w * CFG.TOWEL_WIDTH_RATIO;
        towelH  = h * CFG.TOWEL_HEIGHT_RATIO;
        towelX0 = (w - towelW) * 0.5;
        towelY0 = h * 0.09;
        buildCloth();
        console.log('[TeaTowelCloth] resize', w, 'x', h,
                    '→ towel', Math.round(towelW), 'x', Math.round(towelH),
                    '| particles:', particles.length,
                    '| textureLoaded:', textureLoaded);
    }

    // ── Public API ─────────────────────────────────────────────────────────────
    function init(canvasEl, textureUrl, hintElement) {
        canvas = canvasEl;
        ctx    = canvas.getContext('2d');
        hintEl = hintElement || null;

        // No crossOrigin — same-origin assets on localhost
        texture = new Image();
        texture.onload  = () => {
            textureLoaded = true;
            console.log('[TeaTowelCloth] texture loaded:', texture.naturalWidth, 'x', texture.naturalHeight);
        };
        texture.onerror = () => console.error('[TeaTowelCloth] texture FAILED to load:', textureUrl);
        texture.src = textureUrl;

        console.log('[TeaTowelCloth] init OK — texture src set to:', textureUrl);
    }

    function start() {
        if (running) return;
        running    = true;
        frameCount = 0;
        gustAmp    = 0;
        isDown     = false;
        grabIdx    = null;
        mouseX     = -9999;
        mouseY     = -9999;

        bindEvents();
        showHint();

        // Two rAF delays before first resize: ensures slide layout is complete
        requestAnimationFrame(() => requestAnimationFrame(() => {
            doResize();
            rafHandle = requestAnimationFrame(renderLoop);
        }));

        console.log('[TeaTowelCloth] start()');
    }

    function stop() {
        running = false;
        if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; }
        unbindEvents();
        if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
        isDown = false; grabIdx = null;
        if (ctx && canvas.width > 0) ctx.clearRect(0, 0, canvas.width, canvas.height);
        console.log('[TeaTowelCloth] stop()');
    }

    function resize() { if (running) doResize(); }

    return { init, start, stop, resize };
})();

window.TeaTowelCloth = TeaTowelCloth;
