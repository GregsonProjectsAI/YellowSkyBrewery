/**
 * TeaTowelWebGPU — Yellow Sky Brewery
 * Three.js WebGPU rendering with CPU Verlet cloth physics.
 *
 * Architecture: CPU Verlet (v14 physics) → update BufferGeometry each frame
 * → Three.js WebGPU renders with MeshPhysicalMaterial.
 *
 * No storage-buffer-in-vertex-shader required → works in Firefox + Chrome.
 */

import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';

// ─── Config ──────────────────────────────────────────────────────────────────

const COLS = 28;
const ROWS = 40;
const CLOTH_W = 1.0;
const CLOTH_H = COLS / ROWS < 1 ? CLOTH_W * (ROWS / COLS) : CLOTH_W; // ~1.43

// 3 pins along top edge at 18%, 50%, 82%
const PIN_X_RATIOS = [0.18, 0.50, 0.82];

// Physics — natural cotton tea towel in a light breeze.
// Key design decisions:
//   • No settle spring — it was the "magnetic attractor". Real cloth doesn't
//     spring back to flat; it hangs forward under its own weight.
//   • Multi-frequency turbulent wind replaces two-sine periodic forcing.
//     Sine wind + spring = forced harmonic oscillator = pendulum. Broadband
//     turbulent wind breaks that resonance.
//   • DC forward bias: cloth hangs toward viewer (washing-line drape).
//   • Fewer constraint iterations → softer, more compliant cotton feel.
const GRAVITY        = 0.00042;
const DAMPING        = 0.978;    // slightly more loss → settles gently, doesn't ring
const MAX_VEL        = 0.015;    // slightly higher cap → freer movement
const CONSTRAINT_ITER = 8;       // was 18 — softer, more compliant cloth
const SUBSTEPS       = 3;        // was 4
const BENDING        = 0.12;     // looser — light cotton, not canvas
// Wind
const WIND_AMP_X     = GRAVITY * 0.05;   // gentle side drift
const WIND_AMP_Z     = GRAVITY * 0.22;   // depth flutter
const Z_MAX          = CLOTH_W * 0.40;   // more Z freedom — allows natural forward drape
const XY_CLAMP       = CLOTH_W * 0.90;

// Interaction
const GRAB_RADIUS        = 0.12;  // world-space
const PARTICLE_RADIUS    = 0.012; // self-collision sphere radius per particle
const REPULSION_STIFFNESS = 0.5;  // fraction of overlap corrected per frame (0–1)

const GOLD = 0xffd060;

// ─── State ───────────────────────────────────────────────────────────────────

let renderer, scene, camera, container;
let clothMesh, clothGeo, clothMat;
let cornerDots = [];
let animationId = null;
let frameCount = 0;

// Particle arrays
let px, py, pz;     // current positions
let ox, oy, oz;     // previous positions (Verlet)
let fixed;          // boolean mask
let pinCols;        // set of pinned column indices

// Constraints — each entry: [idxA, idxB, restLen, stiffness]
let constraints = [];

// Cloth mesh geometry buffers
let posArr, normArr;
const N_VERTS = (COLS + 1) * (ROWS + 1); // particle count

// Mouse grab
let isGrabbing = false;
let grabIdx = -1;
let grabWorldX = 0, grabWorldY = 0;
let lastGrabX = 0, lastGrabY = 0;
let prevGrabX = 0, prevGrabY = 0;
let releaseFrame = -9999;  // frame when user last released grab (drives settle boost)

const timer = new THREE.Timer();

// ─── Public API ──────────────────────────────────────────────────────────────

export async function init(containerEl, texturePath) {
    container = containerEl;

    if (!WebGPU.isAvailable()) {
        console.warn('[TeaTowel] WebGPU not available');
        return false;
    }

    // Renderer creation is DEFERRED to start() to prevent WebGPU swapchain
    // silent failures when created on elements that are display:none or visibility:hidden.
    
    // Scene + camera
    scene = new THREE.Scene();

    // Use window dimensions directly for reliable full-screen framing
    const w = window.innerWidth;
    const h = window.innerHeight;
    console.log(`[TeaTowel] viewport ${w}x${h}`);

    // Frame the cloth: cloth is CLOTH_W wide × CLOTH_H tall
    // Centre camera on cloth midpoint, distance chosen to fill height with 10% padding
    const clothCentreY = -CLOTH_H * 0.5;
    const fovDeg = 42;
    const fovRad = (fovDeg * Math.PI) / 180;
    const vertHalf = (CLOTH_H * 0.5) * 1.15;  // 15% top/bottom padding
    const camZ = vertHalf / Math.tan(fovRad / 2);
    camera = new THREE.PerspectiveCamera(fovDeg, w / h, 0.001, 20);
    camera.position.set(0, clothCentreY, camZ);
    camera.lookAt(0, clothCentreY, 0);
    console.log(`[TeaTowel] camera z=${camZ.toFixed(3)}, centreY=${clothCentreY.toFixed(3)}`);

    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    // Lights
    scene.add(new THREE.AmbientLight(0xfff8e0, 1.2));
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.0);
    sun.position.set(0.5, 1.5, 2.0);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xd0e8ff, 0.5);
    fill.position.set(-1, -0.5, 1);
    scene.add(fill);

    // Load texture
    const texture = await new THREE.TextureLoader().loadAsync(texturePath);
    texture.colorSpace = THREE.SRGBColorSpace;

    // Build physics + mesh
    initPhysics();
    buildMesh(texture);
    buildCornerDots();

    window.addEventListener('resize', onResize);
    console.log('[TeaTowel] init OK — CPU Verlet + Three.js setup complete');
    return true;
}

export async function start() {
    if (animationId !== null) return;
    console.log('[TeaTowel] start() called');

    if (!renderer) {
        renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
        
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w, h);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;

        const canvas = renderer.domElement;
        canvas.style.position      = 'fixed';
        canvas.style.inset         = '0';
        canvas.style.zIndex        = '2147483646';
        canvas.style.pointerEvents = 'none';
        canvas.style.opacity       = '0';
        canvas.style.transition    = 'opacity 0.8s ease-in-out';

        setupMouse();
    }

    // Append canvas to its designated container inside the overlay so it 
    // participates in the local stacking context, allowing buttons to sit above it.
    if (!renderer.domElement.parentNode) {
        const container = document.getElementById('teatowel-container');
        if (container) {
            container.appendChild(renderer.domElement);
            console.log('[TeaTowel] canvas appended to container');
        } else {
            document.body.appendChild(renderer.domElement);
        }
    }

    timer.reset();
    await renderer.setAnimationLoop(render);
    animationId = 1;
    // Fade the canvas in after the first frame has rendered
    requestAnimationFrame(() => { renderer.domElement.style.opacity = '1'; });
}

export function stop() {
    if (animationId === null) return;
    renderer.setAnimationLoop(null);
    animationId = null;
    
    // Clean up DOM so it doesn't linger over other slides
    if (renderer && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
}

export function reset() {
    const canvas = renderer ? renderer.domElement : null;
    if (!canvas) { initPhysics(); return; }

    // Fade out quickly, reset physics while invisible, then fade back in
    canvas.style.transition = 'opacity 0.3s ease-out';
    canvas.style.opacity    = '0';

    setTimeout(() => {
        initPhysics();
        canvas.style.transition = 'opacity 0.4s ease-in';
        requestAnimationFrame(() => { canvas.style.opacity = '1'; });
        // Restore the original slow transition used by start/stop
        setTimeout(() => { canvas.style.transition = 'opacity 0.8s ease-in-out'; }, 450);
    }, 320);
}

export function dispose() {
    stop();
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    container?.removeChild(renderer.domElement);
}

// ─── Physics setup ────────────────────────────────────────────────────────────

function pidx(xi, yi) { return yi * (COLS + 1) + xi; }

function initPhysics() {
    const n = (COLS + 1) * (ROWS + 1);
    px = new Float32Array(n);  py = new Float32Array(n);  pz = new Float32Array(n);
    ox = new Float32Array(n);  oy = new Float32Array(n);  oz = new Float32Array(n);
    fixed = new Uint8Array(n);

    pinCols = new Set(PIN_X_RATIOS.map(r => Math.round(r * COLS)));

    // Particle positions
    for (let xi = 0; xi <= COLS; xi++) {
        for (let yi = 0; yi <= ROWS; yi++) {
            const i = pidx(xi, yi);
            px[i] = ox[i] = (xi / COLS - 0.5) * CLOTH_W;
            py[i] = oy[i] = -(yi / ROWS) * CLOTH_H;
            pz[i] = oz[i] = 0;
            fixed[i] = (yi === 0 && pinCols.has(xi)) ? 1 : 0;
        }
    }

    // Helper: rest length between two particles at their initial positions
    const restLen = (a, b) => {
        const dx = px[b] - px[a], dy = py[b] - py[a];
        return Math.sqrt(dx*dx + dy*dy) || 0.001;
    };

    // Build constraints: [idxA, idxB, restLength, stiffness]
    constraints = [];
    for (let xi = 0; xi <= COLS; xi++) {
        for (let yi = 0; yi <= ROWS; yi++) {
            const c = pidx(xi, yi);
            // Structural
            if (xi < COLS) { const d = pidx(xi+1, yi); constraints.push([c, d, restLen(c, d), 1.0]); }
            if (yi < ROWS) { const d = pidx(xi, yi+1); constraints.push([c, d, restLen(c, d), 1.0]); }
            // Diagonal shear
            if (xi < COLS && yi < ROWS) {
                let d; 
                d = pidx(xi+1, yi+1); constraints.push([c, d, restLen(c, d), 1.0]);
                d = pidx(xi+1, yi);   const e = pidx(xi, yi+1); constraints.push([d, e, restLen(d, e), 1.0]);
            }
            // Bending (skip-1)
            if (xi < COLS-1) { const d = pidx(xi+2, yi); constraints.push([c, d, restLen(c, d), BENDING]); }
            if (yi < ROWS-1) { const d = pidx(xi, yi+2); constraints.push([c, d, restLen(c, d), BENDING]); }
        }
    }
    console.log(`[TeaTowel] physics: ${n} particles, ${constraints.length} constraints`);
}

// ─── Mesh setup ───────────────────────────────────────────────────────────────

function buildMesh(texture) {
    // One render vertex per cloth grid intersection = (COLS+1)*(ROWS+1) = N_VERTS
    const vCount = N_VERTS;
    posArr  = new Float32Array(vCount * 3);
    normArr = new Float32Array(vCount * 3);
    const uvArr = new Float32Array(vCount * 2);

    for (let xi = 0; xi <= COLS; xi++) {
        for (let yi = 0; yi <= ROWS; yi++) {
            const vi = pidx(xi, yi);
            // Pre-populate positions from physics state so geometry is never degenerate.
            // Three.js may cache a zero bounding sphere if posArr is all-zero on first upload.
            posArr[vi * 3]     = px[vi];
            posArr[vi * 3 + 1] = py[vi];
            posArr[vi * 3 + 2] = pz[vi];
            uvArr[vi * 2]     = xi / COLS;
            // V=0 is bottom of image in Three.js/WebGL, V=1 is top.
            // Top of cloth (yi=0, pinned row) should show top of texture → V=1.
            uvArr[vi * 2 + 1] = 1.0 - (yi / ROWS);
        }
    }

    // Indices — 2 triangles per quad
    const idxArr = [];
    for (let xi = 0; xi < COLS; xi++) {
        for (let yi = 0; yi < ROWS; yi++) {
            const a = pidx(xi,     yi);
            const b = pidx(xi + 1, yi);
            const c = pidx(xi,     yi + 1);
            const d = pidx(xi + 1, yi + 1);
            idxArr.push(a, b, c,  b, d, c);
        }
    }

    clothGeo = new THREE.BufferGeometry();

    const posAttr  = new THREE.BufferAttribute(posArr,  3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    const normAttr = new THREE.BufferAttribute(normArr, 3);
    normAttr.setUsage(THREE.DynamicDrawUsage);

    clothGeo.setAttribute('position', posAttr);
    clothGeo.setAttribute('normal',   normAttr);
    clothGeo.setAttribute('uv',       new THREE.BufferAttribute(uvArr, 2));
    clothGeo.setIndex(idxArr);

    // MeshBasicMaterial: no lighting shader, no transparency pass — most reliable
    // path through Three.js WebGPU. Visually identical to Lambert for a cloth
    // with ambient-only lighting (texture shows clearly).
    clothMat = new THREE.MeshBasicMaterial({
        map:  texture,
        side: THREE.DoubleSide,
    });

    clothMesh = new THREE.Mesh(clothGeo, clothMat);
    clothMesh.frustumCulled = false;
    scene.add(clothMesh);
    console.log('[TeaTowel] cloth mesh added, vertices:', vCount);
}

function buildCornerDots() {
    // Corner pin indicators removed — return without adding any spheres to scene.
    return;
}

// ─── Physics step ─────────────────────────────────────────────────────────────

function physicsStep() {
    // Run SUBSTEPS substeps per frame for higher effective simulation frequency.
    // This gives much more stable constraints and realistic feel vs. v14's single step.
    for (let sub = 0; sub < SUBSTEPS; sub++) {
        _physicsSubStep();
    }
}

// Self-collision: prevent cloth sections from passing through each other.
// For every pair of non-adjacent particles closer than 2×PARTICLE_RADIUS,
// push them apart by the overlap. This is why cloth was sticking — without
// this check the physics has no concept of cloth occupying the same space.
function selfCollision() {
    const D  = PARTICLE_RADIUS * 2;
    const D2 = D * D;
    for (let ia = 0; ia < N_VERTS - 1; ia++) {
        const xia = ia % (COLS + 1);
        const yia = Math.floor(ia / (COLS + 1));
        for (let ib = ia + 1; ib < N_VERTS; ib++) {
            // Skip grid neighbours — they already have distance constraints
            const xib = ib % (COLS + 1);
            const yib = Math.floor(ib / (COLS + 1));
            if (Math.abs(xia - xib) <= 2 && Math.abs(yia - yib) <= 2) continue;
            const dx = px[ib] - px[ia];
            const dy = py[ib] - py[ia];
            const dz = pz[ib] - pz[ia];
            const d2 = dx*dx + dy*dy + dz*dz;
            if (d2 >= D2 || d2 < 1e-10) continue; // fast early exit — most pairs
            const d    = Math.sqrt(d2);
            const push = (D - d) / d * REPULSION_STIFFNESS;
            const cx = dx * push, cy = dy * push, cz = dz * push;
            if (!fixed[ia]) { px[ia] -= cx; py[ia] -= cy; pz[ia] -= cz; }
            if (!fixed[ib]) { px[ib] += cx; py[ib] += cy; pz[ib] += cz; }
        }
    }
}

function _physicsSubStep() {
    const n = N_VERTS;
    // t in seconds at 60fps
    const t = frameCount / 60;

    // ── Turbulent multi-frequency wind ───────────────────────────────────────
    // 1/f amplitude distribution: many incommensurate frequencies, higher
    // frequencies have lower amplitudes. No dominant period → no pendulum.
    //
    // Gust envelope: product of two very slow sines gives irregular quiet
    // spells and stronger gusts without a fixed repeat cycle.
    const gustEnv = 0.35 + 0.65 * Math.abs(
        Math.sin(t * 0.113) * Math.sin(t * 0.071 + 1.37)
    );

    // DC forward bias removed — cloth hangs straight down under gravity.
    // Wind turbulence provides gentle irregular movement without a constant push.
    const windZ_base = gustEnv * WIND_AMP_Z * (
        Math.sin(t * 0.83)  * 0.38 +   // ~7.6s
        Math.sin(t * 1.31)  * 0.24 +   // ~4.8s
        Math.sin(t * 2.17)  * 0.16 +   // ~2.9s
        Math.sin(t * 3.71)  * 0.11 +   // ~1.7s
        Math.sin(t * 6.07)  * 0.07 +   // ~1.0s — fine ripple
        Math.sin(t * 10.13) * 0.04     // ~0.6s — micro-flutter
    );
    const windX_base = gustEnv * WIND_AMP_X * (
        Math.sin(t * 0.61)  * 0.65 +
        Math.sin(t * 1.73)  * 0.35
    );

    for (let i = 0; i < n; i++) {
        if (fixed[i]) continue;

        const xi = i % (COLS + 1);
        const yi = Math.floor(i / (COLS + 1));

        // Row factor: bottom hem moves more freely than top (hung from pins)
        const rowFactor = 0.25 + 0.75 * (yi / ROWS);

        // Travelling ripple across width + a secondary cross-wave
        const colPhase = (xi / COLS) * Math.PI * 1.7;
        const ripple = Math.sin(t * 2.83 + colPhase) * 0.18
                     + Math.sin(t * 4.51 + colPhase * 0.6) * 0.09;

        const windZ = windZ_base * rowFactor * (0.88 + ripple);
        const windX = windX_base * rowFactor;

        let vx = (px[i] - ox[i]) * DAMPING;
        let vy = (py[i] - oy[i]) * DAMPING;
        let vz = (pz[i] - oz[i]) * DAMPING;

        // Cap velocity
        const spd = Math.sqrt(vx*vx + vy*vy + vz*vz);
        if (spd > MAX_VEL) { const s = MAX_VEL / spd; vx *= s; vy *= s; vz *= s; }

        // Grab override
        if (isGrabbing && i === grabIdx) {
            vx = (grabWorldX - px[i]) * 0.5;
            vy = (grabWorldY - py[i]) * 0.5;
            vz = 0;
        }

        ox[i] = px[i]; oy[i] = py[i]; oz[i] = pz[i];
        px[i] += vx + windX;
        py[i] += vy - GRAVITY / SUBSTEPS;
        pz[i] += vz + windZ;
    }


    // Satisfy constraints
    for (let iter = 0; iter < CONSTRAINT_ITER; iter++) {
        for (const [a, b, rl, stiff] of constraints) {
            const dx = px[b] - px[a];
            const dy = py[b] - py[a];
            const dz = pz[b] - pz[a];
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (dist < 0.0001) continue;
            const diff = (dist - rl) / dist * 0.5 * stiff;
            const cx = dx * diff, cy = dy * diff, cz = dz * diff;
            if (!fixed[a]) { px[a] += cx; py[a] += cy; pz[a] += cz; }
            if (!fixed[b]) { px[b] -= cx; py[b] -= cy; pz[b] -= cz; }
        }

        // Re-pin top-row fixed points every constraint iteration
        for (const xi of pinCols) {
            const i = pidx(xi, 0);
            px[i] = (xi / COLS - 0.5) * CLOTH_W;
            py[i] = 0;
            pz[i] = 0;
        }
    }

    // Settle spring removed — it was the harmonic-oscillator "magnet".
    // The DC wind bias keeps the cloth forward naturally; gravity handles Y.
    // Only apply the hard Z clamp to prevent extreme folds.
    for (let i = 0; i < N_VERTS; i++) {
        if (fixed[i]) continue;
        if (pz[i] >  Z_MAX) pz[i] =  Z_MAX;
        if (pz[i] < -Z_MAX) pz[i] = -Z_MAX;
    }
}

// ─── Update mesh from physics ─────────────────────────────────────────────────

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();
const _vN = new THREE.Vector3();

function updateMesh() {
    // Copy positions
    for (let i = 0; i < N_VERTS; i++) {
        posArr[i * 3]     = px[i];
        posArr[i * 3 + 1] = py[i];
        posArr[i * 3 + 2] = pz[i];
    }

    // Compute normals per-quad, accumulate per-vertex
    normArr.fill(0);
    for (let xi = 0; xi < COLS; xi++) {
        for (let yi = 0; yi < ROWS; yi++) {
            const a = pidx(xi, yi);
            const b = pidx(xi + 1, yi);
            const c = pidx(xi, yi + 1);
            const d = pidx(xi + 1, yi + 1);

            _vA.set(px[a], py[a], pz[a]);
            _vB.set(px[b], py[b], pz[b]);
            _vC.set(px[c], py[c], pz[c]);
            _vB.sub(_vA); _vC.sub(_vA);
            _vN.crossVectors(_vB, _vC).normalize();

            for (const vi of [a, b, c, d]) {
                normArr[vi * 3]     += _vN.x;
                normArr[vi * 3 + 1] += _vN.y;
                normArr[vi * 3 + 2] += _vN.z;
            }
        }
    }
    // Normalise accumulated normals
    for (let i = 0; i < N_VERTS; i++) {
        const nx = normArr[i*3], ny = normArr[i*3+1], nz = normArr[i*3+2];
        const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
        normArr[i*3] /= len; normArr[i*3+1] /= len; normArr[i*3+2] /= len;
    }

    clothGeo.attributes.position.needsUpdate = true;
    clothGeo.attributes.normal.needsUpdate   = true;

    // Corner dots
    const t = performance.now() * 0.001;
    cornerDots.forEach((dot, idx) => {
        const ci = dot.userData.pIdx;
        dot.position.set(px[ci], py[ci], pz[ci] + 0.005);
        dot.scale.setScalar(1.0 + Math.sin(t * 2.5 + idx * 1.2) * 0.2);
    });
}

// ─── Render loop ──────────────────────────────────────────────────────────────

function render() {
    timer.update();
    physicsStep();
    selfCollision();   // prevent cloth self-intersection
    updateMesh();
    frameCount++;
    renderer.render(scene, camera);
}


// ─── Mouse interaction ────────────────────────────────────────────────────────

const grabPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const raycaster = new THREE.Raycaster();
const mouseNDC  = new THREE.Vector2();
const hitPoint  = new THREE.Vector3();

function getWorldPos(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouseNDC.set(
        ((e.clientX - rect.left) / rect.width)  * 2 - 1,
       -((e.clientY - rect.top)  / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouseNDC, camera);
    return raycaster.ray.intersectPlane(grabPlane, hitPoint) ? hitPoint.clone() : null;
}

function nearestParticle(wx, wy) {
    let best = GRAB_RADIUS * GRAB_RADIUS, idx = -1;
    for (let i = 0; i < N_VERTS; i++) {
        if (fixed[i]) continue;
        const dx = px[i] - wx, dy = py[i] - wy;
        const d2 = dx*dx + dy*dy;
        if (d2 < best) { best = d2; idx = i; }
    }
    return idx;
}

function onDown(e) {
    // Don't intercept taps on interactive UI elements — let them receive the event normally.
    const touchTarget = e.touches ? e.touches[0].target : e.target;
    if (touchTarget && touchTarget.closest('button, a, input, select, [role="button"]')) return;

    const src = e.touches ? e.touches[0] : e;
    const wp = getWorldPos(src);
    if (!wp) return;
    const idx = nearestParticle(wp.x, wp.y);
    if (idx < 0) return;
    // Found a cloth particle — prevent overlay navigation from also firing
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    isGrabbing = true;
    grabIdx = idx;
    grabWorldX = prevGrabX = lastGrabX = wp.x;
    grabWorldY = prevGrabY = lastGrabY = wp.y;
}

function onMove(e) {
    if (!isGrabbing) return;
    const wp = getWorldPos(e.touches ? e.touches[0] : e);
    if (!wp) return;
    prevGrabX = lastGrabX; prevGrabY = lastGrabY;
    lastGrabX = grabWorldX = wp.x;
    lastGrabY = grabWorldY = wp.y;
}

function onUp() {
    if (!isGrabbing) return;
    // Apply throw velocity
    if (grabIdx >= 0) {
        const throwX = (lastGrabX - prevGrabX) * 0.4;
        const throwY = (lastGrabY - prevGrabY) * 0.4;
        ox[grabIdx] = px[grabIdx] - throwX;
        oy[grabIdx] = py[grabIdx] - throwY;
    }
    isGrabbing = false;
    grabIdx = -1;
    releaseFrame = frameCount;  // trigger 8× settle boost for ~3s
}

function setupMouse(_canvas) {
    // Use window capture phase so we intercept events before the overlay.
    // Canvas has pointer-events:none so all clicks pass through to overlay UI.
    // When a cloth particle IS found, onDown calls stopPropagation.
    const opts = { capture: true, passive: false };
    window.addEventListener('mousedown',  onDown, opts);
    window.addEventListener('mousemove',  onMove, { capture: true });
    window.addEventListener('mouseup',   onUp,   { capture: true });
    window.addEventListener('touchstart', e => { onDown(e); }, opts);
    window.addEventListener('touchmove',  e => { if (isGrabbing) { e.preventDefault(); onMove(e); } }, opts);
    window.addEventListener('touchend',  () => onUp(), { capture: true });
}

// ─── Resize ───────────────────────────────────────────────────────────────────

function onResize() {
    if (!container || !renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}
