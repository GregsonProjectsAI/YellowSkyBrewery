/**
 * teatowel-cloth.js  v6
 * Interactive Verlet cloth — Yellow Sky Brewery tea towel.
 *
 * Rendering  : per-triangle affine texture mapping (clip + ctx.transform + drawImage)
 * Physics    : Verlet with velocity cap, ceiling, settle force, 12 constraint iterations
 *
 * Public API:
 *   TeaTowelCloth.init(canvasEl, textureUrl, hintEl)
 *   TeaTowelCloth.start()
 *   TeaTowelCloth.stop()
 *   TeaTowelCloth.resize()
 */

const TeaTowelCloth = (() => {

    /* ── Configuration ──────────────────────────────────────────────────────── */
    const CFG = {
        COLS: 28,
        ROWS: 40,
        TOWEL_WIDTH_RATIO:  0.36,
        TOWEL_HEIGHT_RATIO: 0.70,
        PIN_X_RATIOS: [0.18, 0.50, 0.82],   // fraction along top edge

        /* Physics */
        GRAVITY:          0.40,
        DAMPING:          0.980,             // per-frame velocity retention
        MAX_VEL:          12,                // px/frame — cap prevents extreme flings
        CONSTRAINT_ITER:  20,               // high iteration count = near-inextensible (cotton)
        CEILING_MARGIN:   8,                // px above pin row
        BENDING:          0.6,              // bending constraint stiffness

        /* Wind */
        WIND_BASE:        0.09,
        WIND_FREQ:        0.0007,
        WIND_GUST_PROB:   0.003,
        WIND_GUST_AMP:    0.45,

        /* Interaction */
        GRAB_RADIUS_PX:   120,   // cursor shows 'grab' within this distance
        GRIP_RADIUS_PX:   38,    // rigid grip patch radius — particles in this circle move as one
        GRAB_STIFFNESS:   0.42,  // unused in normal drag, kept for fallback
        HOVER_RADIUS_PX:  110,
        HOVER_AMP:        0.50,

        /* Settle: gentle pull back to rest when idle */
        SETTLE_STRENGTH:  0.003,
        SETTLE_DELAY:     80,               // frames after release — let gravity settle first

        /* Hint */
        HINT_DELAY_MS:    2500,
        HINT_FADE_MS:     700,

        /* Rendering — base colour matches tea towel dark fabric so seams are invisible */
        CLOTH_BASE_COLOR: '#0d0d0d',
    };

    /* ── State ──────────────────────────────────────────────────────────────── */
    let canvas, ctx, texture;
    let textureLoaded = false;
    let particles = [], constraints = [];
    let running = false, rafHandle = null, frameCount = 0;
    let towelX0 = 0, towelY0 = 0, towelW = 0, towelH = 0;
    let ceilY = 0;
    let gustAmp = 0, gustDecay = 0.96;
    let grabIdx = null, grabGroup = [];   // grabGroup = rigid grip patch
    let mouseX = -9999, mouseY = -9999, isDown = false;
    let framesSinceRelease = 9999;
    let hintEl = null, hintShown = false, hintTimer = null;

    /* ── Build cloth ────────────────────────────────────────────────────────── */
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
                particles.push({
                    x, y,
                    ox: x, oy: y,   // previous position (Verlet)
                    rx: x, ry: y,   // rest position (for settle force)
                    u: c / (COLS - 1),
                    v: r / (ROWS - 1),
                    pinned
                });
            }
        }

        const diag = Math.hypot(sx, sy);
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const i = r * COLS + c;
                // Structural constraints (adjacent)
                if (c < COLS - 1) constraints.push({ a: i, b: i + 1,        len: sx,      k: 1.0 });
                if (r < ROWS - 1) constraints.push({ a: i, b: i + COLS,     len: sy,      k: 1.0 });
                if (c < COLS - 1 && r < ROWS - 1) {
                    constraints.push({ a: i,     b: i + COLS + 1, len: diag, k: 1.0 });
                    constraints.push({ a: i + 1, b: i + COLS,     len: diag, k: 1.0 });
                }
                // Bending constraints (skip-1) — resist creasing and folding
                if (c < COLS - 2) constraints.push({ a: i, b: i + 2,          len: sx * 2,  k: CFG.BENDING });
                if (r < ROWS - 2) constraints.push({ a: i, b: i + COLS * 2,   len: sy * 2,  k: CFG.BENDING });
            }
        }

        ceilY = towelY0 - CFG.CEILING_MARGIN;
    }

    /* ── Physics ────────────────────────────────────────────────────────────── */
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

        /* Track how long since user released */
        if (isDown) framesSinceRelease = 0;
        else        framesSinceRelease++;

        /* Settle force: gentle pull toward rest position when idle */
        const doSettle = !isDown && framesSinceRelease > CFG.SETTLE_DELAY && gustAmp < 0.02;

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p.pinned) continue;

            /* Verlet velocity with damping */
            let vx = (p.x - p.ox) * CFG.DAMPING;
            let vy = (p.y - p.oy) * CFG.DAMPING;

            /* Velocity cap — prevents catastrophic fling positions */
            const spd = Math.hypot(vx, vy);
            if (spd > CFG.MAX_VEL) { vx *= CFG.MAX_VEL / spd; vy *= CFG.MAX_VEL / spd; }

            p.ox = p.x; p.oy = p.y;

            const wave = Math.sin(frameCount * 0.022 + (i % COLS) * 0.26 + Math.floor(i / COLS) * 0.07);
            p.x += vx + W * wave;
            p.y += vy + CFG.GRAVITY;

            /* Progressive settle: pull toward rest, stronger when further away */
            if (doSettle) {
                const dx = p.rx - p.x;
                const dy = p.ry - p.y;
                const dist = Math.hypot(dx, dy);
                const str  = Math.min(CFG.SETTLE_STRENGTH * (1 + dist / 30), 0.025);
                p.x += dx * str;
                p.y += dy * str;
            }

            /* Hard ceiling — prevents cloth folding above the pin line */
            if (p.y < ceilY) {
                p.y  = ceilY;
                p.oy = ceilY + Math.abs(p.oy - ceilY) * 0.3; // reflect with damping
            }
        }

        /* Hover ripple */
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

        /* Rigid grip: directly position grabbed patch before constraint resolution */
        if (grabGroup.length > 0 && isDown) {
            for (const g of grabGroup) {
                const p = particles[g.index];
                if (p && !p.pinned) { p.x = mouseX + g.dx; p.y = mouseY + g.dy; }
            }
        }

        /* Constraint resolution */
        for (let it = 0; it < CFG.CONSTRAINT_ITER; it++) {
            for (const con of constraints) {
                const pa = particles[con.a], pb = particles[con.b];
                const dx = pb.x - pa.x, dy = pb.y - pa.y;
                const dist = Math.hypot(dx, dy) || 0.001;
                const diff = (dist - con.len) / dist * 0.5 * con.k;
                if (!pa.pinned) { pa.x += dx * diff; pa.y += dy * diff; }
                if (!pb.pinned) { pb.x -= dx * diff; pb.y -= dy * diff; }
            }
        }

        /* Apply rigid grip AGAIN after constraints — grip always wins */
        if (grabGroup.length > 0 && isDown) {
            for (const g of grabGroup) {
                const p = particles[g.index];
                if (p && !p.pinned) { p.x = mouseX + g.dx; p.y = mouseY + g.dy; }
            }
        }

        /* Auto-snap: if cloth is severely folded after release, apply strong recovery */
        if (!isDown && framesSinceRelease > 30) {
            const threshold = towelH * 0.28;
            let badCount = 0;
            const free = particles.filter(p => !p.pinned);
            for (const p of free) {
                if (Math.hypot(p.x - p.rx, p.y - p.ry) > threshold) badCount++;
            }
            if (badCount > free.length * 0.22) {
                for (const p of free) {
                    p.x += (p.rx - p.x) * 0.045;
                    p.y += (p.ry - p.y) * 0.045;
                    /* Dampen velocity so cloth doesn't bounce back violently */
                    p.ox = p.x + (p.ox - p.x) * 0.6;
                    p.oy = p.y + (p.oy - p.y) * 0.6;
                }
            }
        }
    }

    /* ── Rendering ──────────────────────────────────────────────────────────── */

    /**
     * Draw a single texture-mapped triangle using per-triangle affine transform.
     * Screen-space clip + UV→screen ctx.transform + drawImage.
     * Gives seamless, correctly-oriented texture regardless of deformation.
     *
     * @param {number} x0,y0  Screen positions of the three vertices
     * @param {number} u0,v0  Corresponding texture pixel coordinates
     */
    function drawTri(x0, y0, x1, y1, x2, y2,
                     u0, v0, u1, v1, u2, v2) {
        /* Degenerate guard */
        const det = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
        if (Math.abs(det) < 0.5) return;

        /* Affine coefficients: T maps (u,v) → (x,y)
           x = a·u + b·v + c
           y = d·u + e·v + f   */
        const a  = ((x1-x0)*(v2-v0) - (x2-x0)*(v1-v0)) / det;
        const b  = ((x2-x0)*(u1-u0) - (x1-x0)*(u2-u0)) / det;
        const c_ = x0 - a*u0 - b*v0;
        const d  = ((y1-y0)*(v2-v0) - (y2-y0)*(v1-v0)) / det;
        const e  = ((y2-y0)*(u1-u0) - (y1-y0)*(u2-u0)) / det;
        const f  = y0 - d*u0 - e*v0;

        ctx.save();

        /* 1 — Clip to the screen-space triangle */
        ctx.beginPath();
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.clip();

        /* 2 — Apply UV→screen transform (canvas API: m11,m12,m21,m22,dx,dy)
               ctx.transform(a_scale, a_skewY, b_skewX, d_scale, tx, ty)
               → x' = a*u + b*v + c_,   y' = d*u + e*v + f                */
        ctx.transform(a, d, b, e, c_, f);

        /* 3 — Draw full texture; transform puts right pixels in triangle */
        ctx.drawImage(texture, 0, 0);

        ctx.restore();
    }

    /** Draw subtle gold corner indicators so users know the cloth is interactive. */
    function drawCornerHints() {
        const COLS = CFG.COLS, ROWS = CFG.ROWS;
        /* Four corners: top-left, top-right, bottom-left, bottom-right */
        const corners = [
            particles[0],
            particles[COLS - 1],
            particles[(ROWS - 1) * COLS],
            particles[(ROWS - 1) * COLS + COLS - 1],
        ];
        const pulse = 0.55 + 0.45 * Math.sin(frameCount * 0.06); // gentle pulse
        ctx.save();
        ctx.globalAlpha = 0.55 * pulse;
        ctx.fillStyle   = '#ffd060';
        ctx.shadowColor = 'rgba(255,200,50,0.8)';
        ctx.shadowBlur  = 10;
        for (const p of corners) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    /** Render the cloth outline as a filled cream polygon (fabric base). */
    function drawClothBase() {
        const COLS = CFG.COLS, ROWS = CFG.ROWS;
        ctx.save();
        ctx.shadowColor    = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur     = 24;
        ctx.shadowOffsetX  = 6;
        ctx.shadowOffsetY  = 14;
        ctx.fillStyle = CFG.CLOTH_BASE_COLOR;
        ctx.beginPath();
        for (let c = 0; c < COLS; c++) {
            const p = particles[c];
            if (c === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        for (let r = 1; r < ROWS; r++) ctx.lineTo(particles[r*COLS + COLS-1].x, particles[r*COLS + COLS-1].y);
        for (let c = COLS-2; c >= 0; c--) ctx.lineTo(particles[(ROWS-1)*COLS + c].x, particles[(ROWS-1)*COLS + c].y);
        for (let r = ROWS-2; r > 0; r--) ctx.lineTo(particles[r*COLS].x, particles[r*COLS].y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    /** Render cloth with texture. */
    function renderCloth() {
        /* Step 1: cream backing + shadow so towel reads against any background */
        drawClothBase();

        /* Step 2: texture-mapped triangles */
        const COLS = CFG.COLS, ROWS = CFG.ROWS;
        const iW = texture.naturalWidth, iH = texture.naturalHeight;

        for (let r = 0; r < ROWS - 1; r++) {
            for (let c = 0; c < COLS - 1; c++) {
                const p00 = particles[r * COLS + c];
                const p10 = particles[r * COLS + c + 1];
                const p01 = particles[(r + 1) * COLS + c];
                const p11 = particles[(r + 1) * COLS + c + 1];

                /* UV pixel coordinates for each corner */
                const u00 = p00.u * iW, v00 = p00.v * iH;
                const u10 = p10.u * iW, v10 = p10.v * iH;
                const u01 = p01.u * iW, v01 = p01.v * iH;
                const u11 = p11.u * iW, v11 = p11.v * iH;

                /* Upper-left triangle */
                drawTri(p00.x, p00.y, p10.x, p10.y, p01.x, p01.y,
                        u00, v00, u10, v10, u01, v01);
                /* Lower-right triangle */
                drawTri(p10.x, p10.y, p11.x, p11.y, p01.x, p01.y,
                        u10, v10, u11, v11, u01, v01);
            }
        }
    }

    /** Fallback while texture loads. */
    function renderFallback() {
        drawClothBase();
        /* Pin dots */
        ctx.fillStyle = 'rgba(180,140,40,0.9)';
        for (const p of particles) {
            if (!p.pinned) continue;
            ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI*2); ctx.fill();
        }
    }

    /* ── Render loop ────────────────────────────────────────────────────────── */
    function renderLoop() {
        if (!running) return;

        if (canvas.width < 10 || canvas.height < 10 || particles.length === 0) doResize();

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (particles.length > 0) {
            step();
            if (textureLoaded) {
                renderCloth();
                drawCornerHints();
            } else {
                renderFallback();
            }
        }

        frameCount++;
        rafHandle = requestAnimationFrame(renderLoop);
    }

    /* ── Interaction ────────────────────────────────────────────────────────── */
    function nearest(x, y) {
        let best = null, bestD2 = CFG.GRAB_RADIUS_PX ** 2;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i]; if (p.pinned) continue;
            const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
            if (d2 < bestD2) { bestD2 = d2; best = i; }
        }
        return best;
    }
    function isOverCloth(x, y) {
        /* Quick bounding-box test — cloth is roughly towelX0..X0+W, towelY0..Y0+H */
        return x >= towelX0 - 40 && x <= towelX0 + towelW + 40
            && y >= towelY0 - 40 && y <= towelY0 + towelH + 40;
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
        if (!isDown) canvas.style.cursor = isOverCloth(p.x, p.y) ? 'grab' : 'default';
    }
    /* Window-level handlers active only while dragging — lets fast mouse moves
       go outside the canvas without losing the grab */
    function onWindowMove(e) {
        const r = canvas.getBoundingClientRect();
        mouseX = (e.clientX - r.left) * (canvas.width  / r.width);
        mouseY = (e.clientY - r.top)  * (canvas.height / r.height);
    }
    function onWindowUp() {
        isDown = false; grabIdx = null; grabGroup = [];
        canvas.style.cursor = 'default';
        framesSinceRelease = 0;
        window.removeEventListener('mousemove', onWindowMove);
        window.removeEventListener('mouseup',   onWindowUp);
    }
    function onDown(e) {
        e.preventDefault();
        const pos = canvasPos(e); mouseX = pos.x; mouseY = pos.y; isDown = true;
        /* Build rigid grip patch: all non-pinned particles within GRIP_RADIUS_PX */
        grabGroup = [];
        const r2 = CFG.GRIP_RADIUS_PX ** 2;
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p.pinned) continue;
            const d2 = (p.x - mouseX) ** 2 + (p.y - mouseY) ** 2;
            if (d2 < r2) grabGroup.push({ index: i, dx: p.x - mouseX, dy: p.y - mouseY });
        }
        /* Fallback: grab nearest single particle if nothing in grip radius */
        if (grabGroup.length === 0) {
            const idx = nearest(mouseX, mouseY);
            if (idx !== null) grabGroup = [{ index: idx, dx: particles[idx].x - mouseX, dy: particles[idx].y - mouseY }];
        }
        grabIdx = grabGroup.length > 0 ? grabGroup[0].index : null;
        if (grabGroup.length > 0) {
            canvas.style.cursor = 'grabbing';
            dismissHint();
            window.addEventListener('mousemove', onWindowMove, { passive: true });
            window.addEventListener('mouseup',   onWindowUp,   { passive: true });
        }
    }
    function onUp() { onWindowUp(); }
    function onLeave() {
        mouseX = -9999; mouseY = -9999;
        if (isDown) {
            isDown  = false;
            grabIdx = null;
            grabGroup = [];
            framesSinceRelease = 0;
            canvas.style.cursor = 'default';
        } else {
            grabIdx = null;
            grabGroup = [];
        }
    }

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

    /* ── Hint ───────────────────────────────────────────────────────────────── */
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

    /* ── Geometry ───────────────────────────────────────────────────────────── */
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
                    '| texture:', textureLoaded);
    }

    /* ── Public API ─────────────────────────────────────────────────────────── */
    function init(canvasEl, textureUrl, hintElement) {
        canvas = canvasEl;
        ctx    = canvas.getContext('2d');
        hintEl = hintElement || null;

        texture = new Image();
        texture.onload  = () => {
            textureLoaded = true;
            console.log('[TeaTowelCloth] texture loaded', texture.naturalWidth, 'x', texture.naturalHeight);
        };
        texture.onerror = () => console.error('[TeaTowelCloth] texture failed:', textureUrl);
        texture.src = textureUrl;

        console.log('[TeaTowelCloth] init OK');
    }

    function start() {
        if (running) return;
        running              = true;
        frameCount           = 0;
        gustAmp              = 0;
        isDown               = false;
        grabIdx              = null;
        mouseX               = -9999;
        mouseY               = -9999;
        framesSinceRelease   = 9999;

        bindEvents();
        showHint();

        /* Two rAF frames ensures slide layout is complete before measuring */
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

    function reset() {
        if (!running) return;
        gustAmp = 0;
        grabIdx = null;
        grabGroup = [];
        isDown = false;
        buildCloth();
    }

    function resize() { if (running) doResize(); }

    return { init, start, stop, resize, reset };

})();

window.TeaTowelCloth = TeaTowelCloth;
