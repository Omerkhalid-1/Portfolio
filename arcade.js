/* ============================================
   ARCADE — "Lantern Keeper", a side-quest mini-game
   ============================================
   You steer a lantern along the bottom of a dark field. Fireflies drift down —
   catch them to keep the lantern lit. Moths drain the light, and they're only
   clearly visible inside the lantern's glow, so a dimming lantern makes the
   game harder. The run ends when the light goes out.

   Talks to game.js only through events:
     game:sfx    → play a sound through the main (mutable) synth
     game:arcade → a finished run's score, turned into XP / a trophy */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const drawer = $('arcade');
  const tab = $('side-tab');
  const canvas = $('arcade-canvas');
  if (!drawer || !tab || !canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Logical play field; the backing store is scaled for the display (see resize).
  const W = 360;
  const H = 480;
  const GROUND = H - 30;
  const CATCH_HALF_W = 24;
  const MAX_LIGHT = 100;
  const BEST_KEY = 'firefly-quest:arcade-best';
  const SEEN_KEY = 'firefly-quest:arcade-seen';

  const ui = {
    score: $('arcade-score'),
    best: $('arcade-best'),
    mult: $('arcade-mult'),
    meter: $('arcade-light'),
    light: $('arcade-light-fill'),
    overlay: $('arcade-overlay'),
    title: $('arcade-overlay-title'),
    text: $('arcade-overlay-text'),
    play: $('arcade-play'),
    playLabel: $('arcade-play-label'),
    status: $('arcade-status'),
  };

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);

  // Stored values are user-editable: accept only a sane integer.
  function loadBest() {
    try {
      const n = parseInt(localStorage.getItem(BEST_KEY), 10);
      return Number.isFinite(n) && n > 0 ? Math.min(n, 99999) : 0;
    } catch (_) {
      return 0;
    }
  }

  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* private mode */ }
  }

  const sfx = (name, combo) => document.dispatchEvent(new CustomEvent('game:sfx', { detail: { name, combo } }));

  /* ─────────────────────────────────────────────────────────────
     SPRITES — glows are pre-rendered once, then stamped with drawImage
     ───────────────────────────────────────────────────────────── */
  function makeGlow(radius, stops) {
    const c = document.createElement('canvas');
    c.width = c.height = radius * 2;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
    stops.forEach(([offset, color]) => grad.addColorStop(offset, color));
    g.fillStyle = grad;
    g.fillRect(0, 0, radius * 2, radius * 2);
    return c;
  }

  const GLOW = makeGlow(48, [
    [0, 'rgba(255, 248, 220, 1)'],
    [0.12, 'rgba(255, 224, 140, 0.95)'],
    [0.35, 'rgba(240, 190, 90, 0.35)'],
    [1, 'rgba(212, 168, 80, 0)'],
  ]);
  const GOLD_GLOW = makeGlow(64, [
    [0, 'rgba(255, 255, 240, 1)'],
    [0.14, 'rgba(255, 214, 90, 1)'],
    [0.4, 'rgba(255, 170, 40, 0.45)'],
    [1, 'rgba(255, 150, 30, 0)'],
  ]);

  const BG = ctx.createLinearGradient(0, 0, 0, H);
  BG.addColorStop(0, '#050407');
  BG.addColorStop(1, '#0d0a05');

  const STARS = Array.from({ length: 46 }, () => ({
    x: Math.random() * W,
    y: Math.random() * (GROUND - 40),
    r: Math.random() < 0.15 ? 1.4 : 0.8,
    tw: Math.random() * Math.PI * 2,
  }));

  /* ─────────────────────────────────────────────────────────────
     STATE
     ───────────────────────────────────────────────────────────── */
  let mode = 'idle'; // idle | playing | paused | over

  // While a run is live, ambience.js pauses the page's firefly field so the
  // game gets the whole frame budget (matters on phones and older laptops).
  function setMode(next) {
    mode = next;
    document.body.classList.toggle('arcade-playing', next === 'playing');
  }
  let best = loadBest();
  let run = newRun();
  let rafId = 0;
  let last = 0;
  const keys = { left: 0, right: 0 };

  function newRun() {
    return {
      t: 0, score: 0, streak: 0, mult: 1, light: MAX_LIGHT,
      x: W / 2, targetX: W / 2,
      flies: [], moths: [], parts: [],
      nextFly: 0.3, nextMoth: 2.4,
      flash: 0, shake: 0,
    };
  }

  /* ─────────────────────────────────────────────────────────────
     SIMULATION
     ───────────────────────────────────────────────────────────── */
  function spawnFly(difficulty) {
    const golden = Math.random() < 0.08;
    run.flies.push({
      bx: rand(24, W - 24), x: 0, y: -14,
      vy: rand(50, 85) + difficulty * 70,
      phase: rand(0, Math.PI * 2), amp: rand(8, 26),
      blink: rand(0, Math.PI * 2), golden,
    });
  }

  function spawnMoth(difficulty) {
    run.moths.push({
      bx: rand(28, W - 28), x: 0, y: -18,
      vy: rand(65, 95) + difficulty * 80,
      phase: rand(0, Math.PI * 2), amp: rand(14, 36),
      flap: rand(0, Math.PI * 2),
    });
  }

  function burst(x, y, count, colors) {
    const n = reduceMotion ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(40, 150);
      run.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 1, color: colors[i % colors.length] });
    }
  }

  const inLantern = (x, y) => Math.abs(x - run.x) < CATCH_HALF_W && y > GROUND - 40 && y < GROUND + 4;
  const lightRadius = () => 70 + (run.light / MAX_LIGHT) * 150;

  function update(dt) {
    run.t += dt;
    const difficulty = Math.min(run.t / 90, 1); // ramps over 90 seconds

    // Steering: keys move at a fixed speed; the pointer sets a target the
    // lantern eases toward.
    const dir = keys.right - keys.left;
    if (dir) {
      run.x = clamp(run.x + dir * 320 * dt, 20, W - 20);
      run.targetX = run.x;
    } else {
      run.x += (run.targetX - run.x) * Math.min(1, dt * 14);
    }

    run.light -= (4.5 + difficulty * 5.5) * dt;

    run.nextFly -= dt;
    if (run.nextFly <= 0) {
      spawnFly(difficulty);
      run.nextFly = lerp(0.75, 0.36, difficulty) * rand(0.7, 1.3);
    }
    run.nextMoth -= dt;
    if (run.nextMoth <= 0) {
      spawnMoth(difficulty);
      run.nextMoth = lerp(2.1, 0.7, difficulty) * rand(0.7, 1.3);
    }

    for (let i = run.flies.length - 1; i >= 0; i--) {
      const f = run.flies[i];
      f.y += f.vy * dt;
      f.phase += dt * 1.7;
      f.blink += dt * 5;
      f.x = clamp(f.bx + Math.sin(f.phase) * f.amp, 10, W - 10);
      if (inLantern(f.x, f.y)) {
        run.streak++;
        run.mult = Math.min(1 + Math.floor(run.streak / 5), 4);
        run.score += (f.golden ? 3 : 1) * run.mult;
        run.light = Math.min(MAX_LIGHT, run.light + (f.golden ? 32 : 11));
        burst(f.x, f.y, f.golden ? 22 : 12, f.golden ? ['#fff1c4', '#ffc94a', '#ff9f2e'] : ['#fff6d8', '#ffd782']);
        if (f.golden) sfx('unlock');
        else sfx('spark', run.mult);
        run.flies.splice(i, 1);
      } else if (f.y > H + 20) {
        run.flies.splice(i, 1);
      }
    }

    for (let i = run.moths.length - 1; i >= 0; i--) {
      const m = run.moths[i];
      m.y += m.vy * dt;
      m.phase += dt * 2.4;
      m.flap += dt * 24;
      m.x = clamp(m.bx + Math.sin(m.phase) * m.amp, 12, W - 12);
      if (inLantern(m.x, m.y)) {
        run.light -= 30;
        run.streak = 0;
        run.mult = 1;
        run.flash = 1;
        run.shake = reduceMotion ? 0 : 0.3;
        burst(m.x, m.y, 14, ['#8a7a9e', '#4a3f57']);
        sfx('hit');
        run.moths.splice(i, 1);
      } else if (m.y > H + 20) {
        run.moths.splice(i, 1);
      }
    }

    run.light = clamp(run.light, 0, MAX_LIGHT);
    if (run.light <= 0) gameOver();
  }

  function updateEffects(dt) {
    for (let i = run.parts.length - 1; i >= 0; i--) {
      const p = run.parts[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
      p.life -= dt * 1.6;
      if (p.life <= 0) run.parts.splice(i, 1);
    }
    run.flash = Math.max(0, run.flash - dt * 2.5);
    run.shake = Math.max(0, run.shake - dt);
  }

  /* ─────────────────────────────────────────────────────────────
     RENDERING
     ───────────────────────────────────────────────────────────── */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function drawMoth(m, alpha) {
    const wing = 0.3 + Math.abs(Math.sin(m.flap)) * 0.7;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#7b6d90';
    ctx.beginPath();
    ctx.ellipse(-7, -1, 8, 6 * wing, -0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(7, -1, 8, 6 * wing, 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d2536';
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.6, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9b8db0';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-1, 6);
    ctx.lineTo(-4, 11);
    ctx.moveTo(1, 6);
    ctx.lineTo(4, 11);
    ctx.stroke();
    ctx.restore();
  }

  function drawLantern() {
    const x = run.x;
    const y = GROUND;
    const flame = 0.25 + (run.light / MAX_LIGHT) * 0.75;

    ctx.globalCompositeOperation = 'lighter';
    const g = 30 + flame * 60;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(GLOW, x - g / 2, y - 16 - g / 2, g, g);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    ctx.strokeStyle = '#c4a560';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y - 31, 7, Math.PI, 0);
    ctx.stroke();

    ctx.fillStyle = '#b8912e';
    roundRect(x - 14, y - 32, 28, 5, 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 214, 130, ${0.2 + flame * 0.55})`;
    roundRect(x - 11, y - 27, 22, 21, 4);
    ctx.fill();

    ctx.strokeStyle = '#a7842f';
    ctx.lineWidth = 1.5;
    roundRect(x - 11, y - 27, 22, 21, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - 27);
    ctx.lineTo(x, y - 6);
    ctx.stroke();

    ctx.fillStyle = '#b8912e';
    roundRect(x - 15, y - 7, 30, 6, 2);
    ctx.fill();
  }

  function draw() {
    const r = lightRadius();
    const lx = run.x;
    const ly = GROUND - 16;

    ctx.save();
    if (run.shake > 0) ctx.translate(rand(-3, 3) * run.shake * 3, rand(-3, 3) * run.shake * 3);

    ctx.fillStyle = BG;
    ctx.fillRect(-10, -10, W + 20, H + 20);

    const now = performance.now() / 1000;
    ctx.fillStyle = '#f5e7c0';
    STARS.forEach((s) => {
      ctx.globalAlpha = 0.15 + 0.25 * (0.5 + 0.5 * Math.sin(s.tw + now * 1.3));
      ctx.fillRect(s.x, s.y, s.r, s.r);
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(212, 168, 80, 0.12)';
    ctx.fillRect(0, GROUND + 1, W, 1);

    // Light pool around the lantern
    ctx.globalCompositeOperation = 'lighter';
    const pool = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
    pool.addColorStop(0, `rgba(255, 196, 110, ${0.1 + (run.light / MAX_LIGHT) * 0.2})`);
    pool.addColorStop(1, 'rgba(255, 196, 110, 0)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';

    // Moths are only fully visible inside the light
    run.moths.forEach((m) => {
      const d = Math.hypot(m.x - lx, m.y - ly);
      drawMoth(m, clamp(1 - (d - r * 0.55) / (r * 0.45), 0.1, 1));
    });

    // Fireflies carry their own light
    ctx.globalCompositeOperation = 'lighter';
    run.flies.forEach((f) => {
      const size = f.golden ? 46 : 30;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(f.blink);
      ctx.drawImage(f.golden ? GOLD_GLOW : GLOW, f.x - size / 2, f.y - size / 2, size, size);
    });
    run.parts.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    drawLantern();

    if (run.flash > 0) {
      ctx.fillStyle = `rgba(90, 30, 60, ${run.flash * 0.4})`;
      ctx.fillRect(-10, -10, W + 20, H + 20);
    }
    ctx.restore();
  }

  let shown = { score: -1, mult: -1, best: -1, light: -1 };

  function renderStats() {
    if (shown.score !== run.score) ui.score.textContent = shown.score = run.score;
    if (shown.mult !== run.mult) ui.mult.textContent = '×' + (shown.mult = run.mult);
    if (shown.best !== best) ui.best.textContent = shown.best = best;
    const light = Math.round(run.light);
    if (shown.light !== light) {
      shown.light = light;
      ui.light.style.width = light + '%';
      ui.meter.setAttribute('aria-valuenow', String(light));
      ui.meter.classList.toggle('arcade-light--low', light < 25);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     LOOP + FLOW
     ───────────────────────────────────────────────────────────── */
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    if (mode === 'playing') update(dt);
    updateEffects(dt);
    draw();
    renderStats();
    const animating = mode === 'playing' || run.parts.length || run.flash > 0;
    rafId = animating && isOpen() ? requestAnimationFrame(frame) : 0;
  }

  function kick() {
    if (rafId) return;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function showOverlay(title, text, label) {
    ui.title.textContent = title;
    ui.text.textContent = text;
    ui.playLabel.textContent = label;
    ui.overlay.hidden = false;
  }

  function start() {
    if (mode !== 'paused') run = newRun();
    setMode('playing');
    ui.overlay.hidden = true;
    ui.status.textContent = '';
    canvas.focus({ preventScroll: true });
    sfx('ui');
    kick();
  }

  function pause() {
    if (mode !== 'playing') return;
    setMode('paused');
    keys.left = keys.right = 0;
    showOverlay('Paused', `Score ${run.score} · light ${Math.round(run.light)}%`, 'Resume');
  }

  function gameOver() {
    setMode('over');
    keys.left = keys.right = 0;
    const score = run.score;
    const isBest = score > best;
    if (isBest) {
      best = score;
      store(BEST_KEY, String(best));
    }
    const minutes = Math.floor(run.t / 60);
    const seconds = String(Math.floor(run.t % 60)).padStart(2, '0');
    showOverlay(
      isBest && score > 0 ? 'New best!' : 'The lantern went out',
      `Score ${score} · survived ${minutes}:${seconds} · best ${best}`,
      'Play again',
    );
    ui.status.textContent = `Game over. Score ${score}. Best ${best}.`;
    sfx('over');
    document.dispatchEvent(new CustomEvent('game:arcade', { detail: { score } }));
    ui.play.focus({ preventScroll: true });
  }

  ui.play.addEventListener('click', start);

  /* ─────────────────────────────────────────────────────────────
     INPUT
     ───────────────────────────────────────────────────────────── */
  function pointerToField(e) {
    const r = canvas.getBoundingClientRect();
    run.targetX = clamp(((e.clientX - r.left) / r.width) * W, 20, W - 20);
  }

  canvas.addEventListener('pointermove', pointerToField);
  canvas.addEventListener('pointerdown', (e) => {
    pointerToField(e);
    if (e.pointerType !== 'mouse') canvas.setPointerCapture?.(e.pointerId);
  });

  const LEFT = new Set(['ArrowLeft', 'a', 'A']);
  const RIGHT = new Set(['ArrowRight', 'd', 'D']);

  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeArcade();
      return;
    }
    if (mode === 'playing') {
      if (LEFT.has(e.key)) keys.left = 1;
      else if (RIGHT.has(e.key)) keys.right = 1;
      else if (e.key === 'p' || e.key === 'P') pause();
      else return;
      e.preventDefault(); // don't scroll the page while steering
    } else if (e.target === canvas && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      start();
    }
  });

  drawer.addEventListener('keyup', (e) => {
    if (LEFT.has(e.key)) keys.left = 0;
    if (RIGHT.has(e.key)) keys.right = 0;
  });

  // Never keep playing in a background tab.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });

  /* ─────────────────────────────────────────────────────────────
     DRAWER
     ───────────────────────────────────────────────────────────── */
  const isOpen = () => drawer.classList.contains('drawer--open');

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const cap = { high: 2, mid: 1.5, low: 1 }[document.documentElement.dataset.fx] || 1.5;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.width * dpr * (H / W));
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    draw();
  }

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);

  function openArcade() {
    if (isOpen()) return;
    drawer.inert = false;
    drawer.classList.add('drawer--open');
    document.body.classList.add('arcade-open');
    tab.setAttribute('aria-expanded', 'true');
    $('side-tab-ping')?.remove();
    store(SEEN_KEY, '1');
    resize();
    renderStats();
    ui.play.focus({ preventScroll: true });
    sfx('ui');
  }

  function closeArcade() {
    if (!isOpen()) return;
    pause();
    const hadFocus = drawer.contains(document.activeElement);
    drawer.classList.remove('drawer--open');
    document.body.classList.remove('arcade-open');
    drawer.inert = true;
    tab.setAttribute('aria-expanded', 'false');
    if (hadFocus) tab.focus({ preventScroll: true });
  }

  tab.addEventListener('click', () => (isOpen() ? closeArcade() : openArcade()));
  $('arcade-close').addEventListener('click', closeArcade);

  // Other dialogs (trophies, victory) take over the screen — step aside.
  document.querySelectorAll('dialog').forEach((d) => {
    new MutationObserver(() => {
      if (d.open) closeArcade();
    }).observe(d, { attributes: true, attributeFilter: ['open'] });
  });

  try {
    if (localStorage.getItem(SEEN_KEY) === '1') $('side-tab-ping')?.remove();
  } catch (_) { /* ignore */ }

  renderStats();
})();
