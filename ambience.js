/* ============================================
   AMBIENCE — golden fireflies, shooting stars, cursor aura
   ============================================
   Everything ambient is drawn on ONE <canvas> instead of ~120 animated DOM
   nodes: a single compositor layer, no per-element box-shadows, and a frame
   cap on modest hardware.

   Quality tiers
     high — capable desktops: 110 fireflies @ 60 fps, cursor aura, glass blur
     mid  — phones, ≤4-core or ≤4 GB machines: 55 fireflies @ 30 fps
     low  — reduced motion / data saver, or a struggling device: 26 @ 24 fps
   The tier is written to <html data-fx="…"> so CSS can gate its expensive
   effects too, and a watchdog steps it down if the real frame rate sags.

   Fireflies double as catchable "sparks": clicking one on the empty
   background dispatches `game:spark` for game.js. */

(function () {
  'use strict';

  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touchFirst = window.matchMedia('(max-width: 768px), (pointer: coarse) and (hover: none)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 8; // Chromium only; elsewhere assume fine
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);

  const TIERS = {
    high: { count: 110, fps: 60, dpr: 1.5, beacons: 7, approach: 8, stars: [3500, 8500], aura: true },
    mid: { count: 55, fps: 30, dpr: 1, beacons: 4, approach: 5, stars: [7000, 15000], aura: false },
    low: { count: 26, fps: 24, dpr: 1, beacons: 2, approach: 3, stars: null, aura: false },
  };
  const NEXT_TIER = { high: 'mid', mid: 'low', low: null };

  let tier = reduce || saveData ? 'low' : (touchFirst || cores <= 4 || memory <= 4 ? 'mid' : 'high');
  root.dataset.fx = tier;

  const TAU = Math.PI * 2;
  const rand = (min, max) => min + Math.random() * (max - min);
  const shuffled = (arr) => arr.slice().sort(() => Math.random() - 0.5);

  const canvas = document.getElementById('fireflies');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return;

  /* ─────────────────────────────────────────────────────────────
     SPRITES — each glow is rendered once, then stamped with drawImage
     ───────────────────────────────────────────────────────────── */
  function glowSprite(core, mid, edge) {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, core);
    grad.addColorStop(0.08, mid);
    grad.addColorStop(0.24, edge);
    grad.addColorStop(1, 'rgba(212, 168, 80, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  const SPRITES = {
    gold: glowSprite('rgba(255, 244, 205, 1)', 'rgba(255, 215, 130, 0.85)', 'rgba(212, 168, 80, 0.28)'),
    amber: glowSprite('rgba(255, 232, 180, 1)', 'rgba(255, 190, 95, 0.85)', 'rgba(200, 140, 50, 0.28)'),
    champagne: glowSprite('rgba(255, 252, 236, 1)', 'rgba(245, 230, 195, 0.85)', 'rgba(200, 180, 130, 0.24)'),
  };

  /* ─────────────────────────────────────────────────────────────
     FIREFLIES
     ───────────────────────────────────────────────────────────── */
  function makeFirefly() {
    // Depth 0 (far) → 1 (close), squared so most are tiny background stars.
    const raw = Math.random();
    const depth = raw * raw;
    const size = 1.5 + depth * 6;
    const roll = Math.random();
    return {
      hx: Math.random(), hy: Math.random(),       // home, as a fraction of the viewport
      size,
      peak: 0.25 + depth * 0.75,
      glow: size * (3 + depth * 5),
      ax: rand(30, 100), ay: rand(20, 70),        // drift amplitude (px)
      w1: TAU / rand(18, 34), w2: TAU / rand(9, 17),
      p1: rand(0, TAU), p2: rand(0, TAU),
      blinkW: TAU / rand(2.4, 6.5), blinkP: rand(0, TAU),
      tone: roll > 0.95 ? 'champagne' : (roll > 0.85 ? 'amber' : 'gold'),
      beacon: false,
      catchable: size >= 3.2,                      // the smallest read as distant stars
      boost: 0, boostTarget: 0,                    // "approach" brightening
      hiddenUntil: 0, fade: 1,
      x: -999, y: -999, alpha: 0,                  // last drawn state, for hit-testing
    };
  }

  let flies = [];

  function populate() {
    const cfg = TIERS[tier];
    while (flies.length < cfg.count) flies.push(makeFirefly());
    flies.length = cfg.count;
    flies.forEach((f) => { f.beacon = false; f.catchable = f.size >= 3.2; });
    shuffled(flies.filter((f) => f.peak > 0.7)).slice(0, cfg.beacons).forEach((f) => {
      f.beacon = true;
      f.catchable = true;
    });
  }

  populate();

  /* ─────────────────────────────────────────────────────────────
     CANVAS SIZE — tracks the large viewport so mobile toolbars sliding
     in and out don't force a reallocation on every scroll.
     ───────────────────────────────────────────────────────────── */
  let vw = 0;
  let vh = 0;

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w === vw && h === vh && canvas.width === Math.round(w * dpr)) return;
    vw = w;
    vh = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduce) draw(performance.now());
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });
  resize();

  /* ─────────────────────────────────────────────────────────────
     SHOOTING STARS + RIPPLES
     ───────────────────────────────────────────────────────────── */
  const shooters = [];
  const ripples = [];
  let nextShooter = performance.now() + rand(2000, 4000);

  function spawnShooter(now, y, angle) {
    const a = angle ?? rand(15, 45) * (Math.PI / 180);
    shooters.push({
      x: -0.15 * vw, y: y ?? rand(0.05, 0.8) * vh,
      dx: Math.cos(a), dy: Math.sin(a),
      dist: vw * 1.4, born: now, dur: rand(1000, 1800),
    });
  }

  function drawShooter(s, now) {
    const k = (now - s.born) / s.dur;
    if (k >= 1) return false;
    const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const hx = s.x + s.dx * s.dist * ease;
    const hy = s.y + s.dy * s.dist * ease;
    const len = 180 * (k < 0.1 ? k * 10 : 1 - k * 0.6);
    const alpha = k < 0.1 ? k * 10 : (k > 0.85 ? (1 - k) / 0.15 : 1);
    const grad = ctx.createLinearGradient(hx - s.dx * len, hy - s.dy * len, hx, hy);
    grad.addColorStop(0, 'rgba(255, 240, 190, 0)');
    grad.addColorStop(0.6, 'rgba(255, 215, 130, 0.8)');
    grad.addColorStop(1, 'rgba(255, 250, 220, 1)');
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx - s.dx * len, hy - s.dy * len);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    return true;
  }

  function drawRipple(r, now) {
    const k = (now - r.born) / 1000;
    if (k >= 1) return false;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = 'rgba(255, 215, 130, 0.9)';
    ctx.lineWidth = 2 * (1 - k) + 0.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 4 + k * 70, 0, TAU);
    ctx.stroke();
    return true;
  }

  /* ─────────────────────────────────────────────────────────────
     DRAW
     ───────────────────────────────────────────────────────────── */
  let celebrateUntil = 0;

  function draw(now) {
    const t = now / 1000;
    const celebrating = now < celebrateUntil ? 1.2 : 0;
    ctx.clearRect(0, 0, vw, vh);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < flies.length; i++) {
      const f = flies[i];
      if (f.hiddenUntil > now) {
        f.alpha = 0;
        continue;
      }
      f.boost += (Math.max(f.boostTarget, celebrating) - f.boost) * 0.05;

      let x = f.hx * vw;
      let y = f.hy * vh;
      let a;
      let scale = 1;
      if (reduce) {
        a = f.peak * 0.6;
      } else {
        x += Math.sin(t * f.w1 + f.p1) * f.ax + Math.sin(t * f.w2 + f.p2) * f.ax * 0.35;
        y += Math.cos(t * f.w1 * 0.8 + f.p2) * f.ay + Math.sin(t * f.w2 + f.p1) * f.ay * 0.3;
        const blink = 0.5 - 0.5 * Math.cos(t * f.blinkW + f.blinkP);
        if (f.beacon) {
          a = 0.15 + 0.85 * blink * blink;
          scale = 0.85 + 0.4 * blink;
        } else {
          a = f.peak * blink;
        }
      }
      a = Math.min(1, a * (1 + f.boost * 0.8));
      scale *= 1 + f.boost * 0.6;
      if (f.fade < 1) {
        f.fade = Math.min(1, f.fade + 0.03);
        a *= f.fade;
      }

      const d = (f.size * 2 + f.glow * 1.5) * scale;
      ctx.globalAlpha = a;
      ctx.drawImage(SPRITES[f.tone], x - d / 2, y - d / 2, d, d);
      f.x = x;
      f.y = y;
      f.alpha = a;
    }

    for (let i = ripples.length - 1; i >= 0; i--) if (!drawRipple(ripples[i], now)) ripples.splice(i, 1);
    for (let i = shooters.length - 1; i >= 0; i--) if (!drawShooter(shooters[i], now)) shooters.splice(i, 1);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ─────────────────────────────────────────────────────────────
     LOOP — frame-capped per tier; pauses while the arcade is being
     played so the mini-game gets the whole budget.
     ───────────────────────────────────────────────────────────── */
  let lastFrame = 0;
  const samples = [];

  // Step down a tier when the device can't hold ~60% of the target frame rate.
  function watchdog(delta) {
    if (delta > 500) return; // tab switch or a one-off stall, not a trend
    samples.push(delta);
    if (samples.length < 90) return;
    const avg = samples.reduce((sum, d) => sum + d, 0) / samples.length;
    samples.length = 0;
    const next = NEXT_TIER[tier];
    if (next && avg > (1000 / TIERS[tier].fps) * 1.6) {
      tier = next;
      root.dataset.fx = tier;
      populate();
      resize();
      if (!TIERS[tier].aura) aura?.classList.remove('cursor-aura--active');
    }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    const interval = 1000 / TIERS[tier].fps;
    if (now - lastFrame < interval - 2) return;
    const delta = now - lastFrame;
    lastFrame = now;
    if (document.body.classList.contains('arcade-playing')) return;

    const stars = TIERS[tier].stars;
    if (stars && now >= nextShooter) {
      spawnShooter(now);
      // Desktop sometimes sends a second star right behind the first.
      if (tier === 'high' && Math.random() < 0.25) {
        const s = shooters[shooters.length - 1];
        setTimeout(() => spawnShooter(performance.now(), s.y + rand(-30, 30), Math.atan2(s.dy, s.dx) + rand(-0.08, 0.08)), rand(200, 500));
      }
      nextShooter = now + rand(stars[0], stars[1]);
    }

    draw(now);
    watchdog(delta);
  }

  if (reduce) draw(performance.now());
  else requestAnimationFrame((now) => { lastFrame = now; requestAnimationFrame(loop); });

  /* ─────────────────────────────────────────────────────────────
     CATCHING SPARKS — clicks that land on the empty background
     ───────────────────────────────────────────────────────────── */
  const isBackground = (el) => el === document.body || el === root;
  const catchRadius = touchFirst ? 30 : 18;

  function nearestCatchable(px, py) {
    const now = performance.now();
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < flies.length; i++) {
      const f = flies[i];
      if (!f.catchable || f.alpha < 0.05 || f.hiddenUntil > now) continue;
      const reach = catchRadius + f.size;
      const dx = f.x - px;
      const dy = f.y - py;
      const d = dx * dx + dy * dy;
      if (d < reach * reach && d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  document.addEventListener('click', (e) => {
    if (e.button !== 0 || !isBackground(e.target)) return;
    const f = nearestCatchable(e.clientX, e.clientY);
    if (!f) return;
    const now = performance.now();
    ripples.push({ x: f.x, y: f.y, born: now });
    document.dispatchEvent(new CustomEvent('game:spark', { detail: { x: f.x, y: f.y, beacon: f.beacon } }));

    f.hiddenUntil = now + rand(4000, 9000);
    f.hx = Math.random();
    f.hy = Math.random();
    f.fade = 0;
    if (reduce) {
      draw(now);
      setTimeout(() => draw(performance.now()), f.hiddenUntil - now + 50);
    }
  });

  // Pointer cursor when hovering a catchable spark (mouse users only).
  if (finePointer) {
    let hoverQueued = false;
    let hx = 0;
    let hy = 0;
    let hoverTarget = null;
    window.addEventListener('mousemove', (e) => {
      hx = e.clientX;
      hy = e.clientY;
      hoverTarget = e.target;
      if (hoverQueued) return;
      hoverQueued = true;
      requestAnimationFrame(() => {
        hoverQueued = false;
        document.body.classList.toggle('can-catch', isBackground(hoverTarget) && !!nearestCatchable(hx, hy));
      });
    }, { passive: true });
  }

  /* ─────────────────────────────────────────────────────────────
     SECTION-AWARE "APPROACH" + CELEBRATION
     ───────────────────────────────────────────────────────────── */
  if (!reduce && 'IntersectionObserver' in window) {
    let currentSection = null;
    let approaching = [];

    const observer = new IntersectionObserver((entries) => {
      let best = null;
      entries.forEach((entry) => {
        if (entry.isIntersecting && (!best || entry.intersectionRatio > best.intersectionRatio)) best = entry;
      });
      if (!best || best.target.id === currentSection) return;
      currentSection = best.target.id;
      approaching.forEach((f) => { f.boostTarget = 0; });
      approaching = shuffled(flies).slice(0, TIERS[tier].approach);
      approaching.forEach((f) => { f.boostTarget = 1; });
    }, { threshold: [0, 0.4, 0.8] });

    document.addEventListener('portfolio:mounted', (e) => {
      e.detail.root.querySelectorAll('section[id]').forEach((s) => observer.observe(s));
    });
  }

  document.addEventListener('game:celebrate', () => {
    celebrateUntil = performance.now() + 6000;
  });

  /* ─────────────────────────────────────────────────────────────
     CURSOR AURA — capable desktops only; sleeps when the mouse rests
     ───────────────────────────────────────────────────────────── */
  const aura = document.getElementById('cursor-aura');
  if (!aura || reduce || !finePointer) return;

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;
  let auraRaf = 0;

  function tick() {
    currentX += (targetX - currentX) * 0.15;
    currentY += (targetY - currentY) * 0.15;
    aura.style.setProperty('--cx', currentX + 'px');
    aura.style.setProperty('--cy', currentY + 'px');
    auraRaf = Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > 0.5 ? requestAnimationFrame(tick) : 0;
  }

  window.addEventListener('mousemove', (e) => {
    if (!TIERS[tier].aura) return;
    targetX = e.clientX;
    targetY = e.clientY;
    aura.classList.add('cursor-aura--active');
    if (!auraRaf) auraRaf = requestAnimationFrame(tick);
  }, { passive: true });

  document.addEventListener('mouseleave', () => aura.classList.remove('cursor-aura--active'));
})();
