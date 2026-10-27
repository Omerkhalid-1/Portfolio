/* ============================================
   FIREFLY QUEST — the game layer
   ============================================
   Architecture:
     (A) State     — XP, sparks, trophies, unlocked zones; persisted to
                     localStorage and validated on load (it's user-editable).
     (B) Sound     — tiny WebAudio synth, no audio files.
     (C) FX        — particles, floating "+XP" text, toasts, level-up banner.
     (D) Zones     — scroll-driven discovery: each .section-slot holds a
                     firefly; clicking it mounts the section from its
                     <template> and announces `portfolio:mounted`.
     (E) HUD, title screen, trophy room, victory screen, compass.
   All dynamic text is written with textContent — never innerHTML. */

(function () {
  'use strict';

  const stage = document.getElementById('stage');
  if (!stage) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);
  const TAP = window.matchMedia('(hover: none)').matches ? 'Tap' : 'Click';
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  const slots = Array.from(stage.querySelectorAll('.section-slot'));
  const ZONE_IDS = slots.map((s) => s.dataset.section);
  // Read once: the firefly button (which carries the label) is gone after mounting.
  const ZONE_NAMES = new Map(slots.map((s) => [s, s.querySelector('.unlock-firefly')?.dataset.label || s.dataset.section]));
  const zoneName = (slot) => ZONE_NAMES.get(slot);

  const ZONE_XP = 100;
  const SPARK_XP = 10;
  const BEACON_XP = 25;
  const ACHIEVEMENT_XP = 50;
  const COMBO_WINDOW_MS = 1600;
  const MAX_COMBO = 5;
  const SPEEDRUN_MS = 2 * 60 * 1000;
  const ARCADE_TROPHY_SCORE = 25;
  const ARCADE_XP_PER_POINT = 5;
  const ARCADE_XP_CAP = 300;

  const LEVELS = [
    { xp: 0, title: 'Wanderer' },
    { xp: 100, title: 'Seeker' },
    { xp: 250, title: 'Explorer' },
    { xp: 450, title: 'Pathfinder' },
    { xp: 700, title: 'Lightkeeper' },
    { xp: 1000, title: 'Firefly Sage' },
    { xp: 1400, title: 'Legend' },
    { xp: 1900, title: 'Mythic' },
  ];

  const ACHIEVEMENTS = {
    'first-light': { name: 'First Light', desc: 'Unlock your first zone.', icon: 'zap' },
    'halfway': { name: 'Halfway There', desc: 'Unlock half of the zones.', icon: 'map' },
    'completionist': { name: 'Completionist', desc: 'Unlock every zone.', icon: 'trophy' },
    'speedrun': { name: 'Speedrunner', desc: 'Unlock every zone in under 2 minutes.', icon: 'fast-forward' },
    'spark-10': { name: 'Spark Catcher', desc: 'Catch 10 sparks.', icon: 'sparkles' },
    'spark-50': { name: 'Firefly Whisperer', desc: 'Catch 50 sparks.', icon: 'star' },
    'combo-5': { name: 'Combo Master', desc: `Chain a ×${MAX_COMBO} spark combo.`, icon: 'zap' },
    'loot': { name: 'Loot Inspector', desc: 'Open a project or paper.', icon: 'github' },
    'networker': { name: 'Networker', desc: 'Open a contact link.', icon: 'mail' },
    'lantern': { name: 'Lantern Keeper', desc: `Score ${ARCADE_TROPHY_SCORE}+ in the arcade side quest.`, icon: 'gamepad' },
    'night-owl': { name: 'Night Owl', desc: 'Explore between midnight and 5 AM.', icon: 'moon', secret: true },
    'konami': { name: 'Old School', desc: '↑ ↑ ↓ ↓ ← → ← → B A', icon: 'gamepad', secret: true },
    'fast-travel': { name: 'Fast Travel', desc: 'Reveal everything at once.', icon: 'fast-forward', xp: 0 },
  };
  const ACHIEVEMENT_IDS = Object.keys(ACHIEVEMENTS);

  /* ═══════════════════════════════════════
     (A) STATE
     ═══════════════════════════════════════ */
  const STORAGE_KEY = 'firefly-quest:v1';

  function freshState() {
    return {
      unlocked: [], xp: 0, sparks: 0, bestCombo: 0, achievements: [],
      startedAt: 0, finishedAt: 0, sound: true, victoryShown: false, skipped: false, hudMin: false,
    };
  }

  // localStorage is user-controlled input: keep only known ids and sane numbers.
  function loadState() {
    const s = freshState();
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return s;
      if (Array.isArray(raw.unlocked)) s.unlocked = ZONE_IDS.filter((id) => raw.unlocked.includes(id));
      if (Array.isArray(raw.achievements)) s.achievements = ACHIEVEMENT_IDS.filter((id) => raw.achievements.includes(id));
      ['xp', 'sparks', 'bestCombo', 'startedAt', 'finishedAt'].forEach((key) => {
        const n = Number(raw[key]);
        if (Number.isFinite(n) && n >= 0) s[key] = Math.floor(n);
      });
      s.xp = Math.min(s.xp, 999999);
      s.sparks = Math.min(s.sparks, 999999);
      s.bestCombo = Math.min(s.bestCombo, MAX_COMBO);
      s.sound = raw.sound !== false;
      s.victoryShown = raw.victoryShown === true;
      s.skipped = raw.skipped === true;
      s.hudMin = raw.hudMin === true;
    } catch (_) { /* corrupt or blocked storage — start fresh */ }
    return s;
  }

  const state = loadState();

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* private mode */ }
  }

  function clearSave() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
  }

  const levelIndex = (xp) => {
    let i = 0;
    while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
    return i;
  };

  /* ═══════════════════════════════════════
     (B) SOUND — synthesized blips (no files, no network)
     ═══════════════════════════════════════ */
  const sound = (() => {
    let ctx = null;

    function audio() {
      if (!state.sound) return null;
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function tone(freq, at, dur, type, vol) {
      const c = audio();
      if (!c) return;
      const t = c.currentTime + at;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }

    return {
      ui: () => tone(660, 0, 0.07, 'sine', 0.04),
      spark: (combo) => {
        const f = 880 * Math.pow(1.122, combo - 1); // each combo step ≈ a whole tone higher
        tone(f, 0, 0.12, 'sine', 0.06);
        tone(f * 1.5, 0.05, 0.16, 'sine', 0.035);
      },
      unlock: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.07, 0.4, 'triangle', 0.07)),
      achievement: () => {
        tone(783.99, 0, 0.16, 'square', 0.03);
        tone(1174.66, 0.12, 0.42, 'square', 0.03);
      },
      levelUp: () => [392, 523.25, 659.25, 783.99, 1046.5, 1318.5]
        .forEach((f, i) => tone(f, i * 0.065, 0.32, 'triangle', 0.06)),
      hit: () => {
        tone(220, 0, 0.18, 'sawtooth', 0.045);
        tone(147, 0.08, 0.26, 'sawtooth', 0.04);
      },
      over: () => [523.25, 392, 311.13, 261.63].forEach((f, i) => tone(f, i * 0.12, 0.38, 'triangle', 0.06)),
    };
  })();

  /* ═══════════════════════════════════════
     (C) FX
     ═══════════════════════════════════════ */
  const fxLayer = $('fx-layer');
  const toasts = $('toasts');

  function icon(name) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(NS, 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function burst(x, y, count = 14, spread = 70) {
    if (reduceMotion || !fxLayer) return;
    for (let i = 0; i < count; i++) {
      const p = el('span', 'particle');
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = spread * (0.5 + Math.random() * 0.7);
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.setProperty('--tx', (Math.cos(angle) * dist).toFixed(1) + 'px');
      p.style.setProperty('--ty', (Math.sin(angle) * dist).toFixed(1) + 'px');
      p.style.setProperty('--size', (3 + Math.random() * 4).toFixed(1) + 'px');
      fxLayer.appendChild(p);
      setTimeout(() => p.remove(), 900);
    }
  }

  function floatText(text, x, y, variant) {
    if (!fxLayer) return;
    const node = el('span', 'float-text' + (variant ? ' float-text--' + variant : ''), text);
    node.style.left = x + 'px';
    node.style.top = y + 'px';
    fxLayer.appendChild(node);
    setTimeout(() => node.remove(), 1300);
  }

  function toast({ eyebrow, title, text, iconName, kind = 'info' }) {
    if (!toasts) return;
    const node = el('div', 'toast toast--' + kind);
    const badge = el('span', 'toast__icon');
    badge.appendChild(icon(iconName || 'sparkles'));
    const body = el('div', 'toast__body');
    if (eyebrow) body.appendChild(el('span', 'toast__eyebrow', eyebrow));
    body.appendChild(el('strong', 'toast__title', title));
    if (text) body.appendChild(el('span', 'toast__text', text));
    node.append(badge, body);
    toasts.appendChild(node);
    while (toasts.children.length > 3) toasts.firstElementChild.remove();
    setTimeout(() => node.classList.add('toast--out'), 3600);
    setTimeout(() => node.remove(), 4100);
  }

  function levelUpBanner(index) {
    if (!fxLayer) return;
    fxLayer.querySelectorAll('.levelup').forEach((old) => old.remove()); // newest wins, never stacked
    const banner = el('div', 'levelup');
    banner.append(el('span', 'levelup__eyebrow', 'Level up'), el('strong', 'levelup__title', `LV ${index + 1} · ${LEVELS[index].title}`));
    fxLayer.appendChild(banner);
    setTimeout(() => banner.remove(), 2200);
    burst(window.innerWidth / 2, window.innerHeight / 2, 28, 160);
  }

  /* ═══════════════════════════════════════
     XP + ACHIEVEMENTS
     ═══════════════════════════════════════ */
  // While true (reveal-all), XP and trophies are still granted but without
  // a cascade of banners, toasts and sounds.
  let quiet = false;

  function gainXP(amount, at, label) {
    if (amount <= 0) return;
    const before = levelIndex(state.xp);
    state.xp += amount;
    if (at) floatText(label || `+${amount} XP`, at.x, at.y);
    const after = levelIndex(state.xp);
    if (after > before && !quiet) {
      sound.levelUp();
      levelUpBanner(after);
      $('hud-lv')?.classList.add('hud__lv--pop');
      setTimeout(() => $('hud-lv')?.classList.remove('hud__lv--pop'), 900);
    }
    renderHud();
  }

  function award(id) {
    if (!has(ACHIEVEMENTS, id) || state.achievements.includes(id)) return;
    state.achievements.push(id);
    const a = ACHIEVEMENTS[id];
    const xp = a.xp ?? ACHIEVEMENT_XP;
    if (!quiet) toast({
      kind: 'achievement',
      eyebrow: 'Achievement unlocked' + (xp ? ` · +${xp} XP` : ''),
      title: a.name,
      text: a.desc,
      iconName: a.icon,
    });
    if (!quiet) sound.achievement();
    gainXP(xp);
    renderTrophies();
    save();
  }

  /* ═══════════════════════════════════════
     (D) ZONES — discovery + mounting
     ═══════════════════════════════════════ */
  const isMounted = (slot) => slot.classList.contains('section-slot--mounted');
  const slotFor = (id) => slots.find((s) => s.dataset.section === id);

  // Zone markers ("ZONE 03 / 08 · Research") above each waiting firefly.
  slots.forEach((slot, i) => {
    const marker = el('div', 'zone-marker');
    marker.setAttribute('aria-hidden', 'true');
    marker.append(
      el('span', 'zone-marker__num', `Zone ${String(i + 1).padStart(2, '0')} / ${String(slots.length).padStart(2, '0')}`),
      el('span', 'zone-marker__name', zoneName(slot)),
    );
    const hint = el('div', 'zone-hint', `${TAP} the firefly to unlock`);
    hint.setAttribute('aria-hidden', 'true');
    slot.prepend(marker);
    slot.append(hint);
  });

  /* Visibility: a slot's firefly appears once ≥30% of the slot is in view;
     the most-visible slot is "current" and gets the brightest firefly. */
  let currentSlot = null;

  function setCurrent(slot) {
    if (slot === currentSlot) return;
    if (currentSlot) {
      currentSlot.classList.remove('section-slot--current');
      if (!isMounted(currentSlot)) currentSlot.classList.add('section-slot--past');
    }
    currentSlot = slot;
    slot.classList.remove('section-slot--past');
    slot.classList.add('section-slot--current', 'section-slot--revealed');
  }

  const visibilityIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && e.intersectionRatio > 0.3) {
        e.target.classList.add('section-slot--revealed');
        startEscalation(e.target);
      }
    });
    let best = null;
    let bestArea = 0;
    slots.forEach((s) => {
      const r = s.getBoundingClientRect();
      const visible = Math.max(0, Math.min(window.innerHeight, r.bottom) - Math.max(0, r.top));
      if (visible > bestArea) {
        bestArea = visible;
        best = s;
      }
    });
    if (best) setCurrent(best);
  }, { threshold: [0, 0.3, 0.6, 0.9] });

  slots.forEach((s) => visibilityIO.observe(s));

  /* Escalating pulse — an ignored firefly blinks faster and faster, then
     starts jittering for attention. Starts the first time a slot is seen. */
  const BLINK_START = 4.0, BLINK_MIN = 0.6, BLINK_STEP = 0.4, ESCALATE_MS = 8000;
  const escalators = new Map();

  function startEscalation(slot) {
    const f = slot.querySelector('.unlock-firefly');
    if (!f || isMounted(slot) || escalators.has(f)) return;
    let dur = BLINK_START;
    f.style.setProperty('--blink-dur', dur + 's');
    const id = setInterval(() => {
      dur = Math.max(BLINK_MIN, dur - BLINK_STEP);
      f.style.setProperty('--blink-dur', dur + 's');
      if (dur === BLINK_MIN) {
        f.classList.add('unlock-firefly--urgent');
        clearInterval(id);
      }
    }, ESCALATE_MS);
    escalators.set(f, id);
  }

  function stopEscalation(slot) {
    const f = slot.querySelector('.unlock-firefly');
    if (f && escalators.has(f)) {
      clearInterval(escalators.get(f));
      escalators.delete(f);
    }
  }

  // Clone the zone's template into its slot, synchronously — content appears
  // in the same frame as the click (no entrance fade, by design).
  function mount(slot) {
    if (isMounted(slot)) return;
    const id = slot.dataset.section;
    const tpl = $('tpl-' + id);
    if (!tpl) {
      console.warn('Template not found:', id);
      return;
    }
    stopEscalation(slot);
    const fragment = tpl.content.cloneNode(true);
    fragment.querySelectorAll('.animate-on-scroll').forEach((node) => node.classList.remove('animate-on-scroll'));

    const reveal = el('div', 'unlocked-section');
    reveal.dataset.section = id;
    reveal.appendChild(fragment);

    slot.classList.add('section-slot--mounted');
    slot.classList.remove('section-slot--past');
    slot.replaceChildren(reveal);

    document.dispatchEvent(new CustomEvent('portfolio:mounted', { detail: { id, root: reveal } }));
  }

  function unlock(slot, { silent = false, origin = null } = {}) {
    const id = slot.dataset.section;
    if (isMounted(slot)) return;
    const firstTime = !state.unlocked.includes(id);
    mount(slot);
    if (!firstTime) return;

    state.unlocked.push(id);
    if (!state.startedAt) state.startedAt = Date.now();
    const count = state.unlocked.length;

    if (!silent) {
      const at = origin || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      burst(at.x, at.y, 22, 110);
      sound.unlock();
      toast({
        kind: 'zone',
        eyebrow: `Zone ${slots.indexOf(slot) + 1} of ${slots.length} discovered`,
        title: zoneName(slot),
        iconName: 'map',
      });
      gainXP(ZONE_XP, at);
    } else {
      gainXP(ZONE_XP);
    }

    if (count >= 1) award('first-light');
    if (count >= Math.ceil(slots.length / 2)) award('halfway');
    if (count === slots.length) {
      state.finishedAt = Date.now();
      award('completionist');
      if (!state.skipped && state.finishedAt - state.startedAt <= SPEEDRUN_MS) award('speedrun');
      if (!state.skipped && !state.victoryShown) {
        state.victoryShown = true;
        setTimeout(openVictory, 1100);
      }
      state.hudMin = true;
    }

    afterZoneChange();
    save();
  }

  function afterZoneChange() {
    renderHud();
    syncNavLocks();
    updateCompass();
    document.body.classList.toggle('all-unlocked', slots.every(isMounted));
  }

  stage.addEventListener('click', (e) => {
    const f = e.target.closest('.unlock-firefly');
    const slot = f?.closest('.section-slot');
    if (!slot) return;
    const r = f.getBoundingClientRect();
    unlock(slot, { origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 } });
    fadeWelcome();
  });

  function revealAll() {
    state.skipped = true;
    quiet = true;
    slots.forEach((slot) => unlock(slot, { silent: true }));
    award('fast-travel');
    quiet = false;
    afterZoneChange();
    save();
  }

  // Navbar links to zones that are still locked get a "locked" look.
  function syncNavLocks() {
    document.querySelectorAll('.nav-links a[href^="#"]').forEach((a) => {
      const id = a.getAttribute('href').slice(1);
      const slot = stage.querySelector(`.section-slot[data-anchor~="${CSS.escape(id)}"]`);
      const locked = !!slot && !isMounted(slot);
      a.classList.toggle('is-locked', locked);
      if (locked) a.setAttribute('title', 'Locked zone — find its firefly');
      else a.removeAttribute('title');
    });
  }

  /* ═══════════════════════════════════════
     SPARKS — ambient fireflies caught (see ambience.js)
     ═══════════════════════════════════════ */
  let combo = 0;
  let lastSparkAt = 0;
  let comboTimer = 0;

  document.addEventListener('game:spark', (e) => {
    const now = performance.now();
    combo = now - lastSparkAt <= COMBO_WINDOW_MS ? Math.min(combo + 1, MAX_COMBO) : 1;
    lastSparkAt = now;
    state.sparks++;
    state.bestCombo = Math.max(state.bestCombo, combo);

    const { x, y, beacon } = e.detail;
    const xp = (beacon ? BEACON_XP : SPARK_XP) * combo;
    burst(x, y, beacon ? 18 : 10, beacon ? 80 : 45);
    sound.spark(combo);
    gainXP(xp, { x, y }, combo > 1 ? `+${xp} XP ×${combo}` : `+${xp} XP`);

    const comboEl = $('hud-combo');
    if (comboEl) {
      comboEl.textContent = combo > 1 ? `×${combo}` : '';
      comboEl.classList.remove('hud__combo--pop');
      void comboEl.offsetWidth; // restart the pop animation
      comboEl.classList.add('hud__combo--pop');
      clearTimeout(comboTimer);
      comboTimer = setTimeout(() => { comboEl.textContent = ''; }, COMBO_WINDOW_MS);
    }

    if (state.sparks >= 10) award('spark-10');
    if (state.sparks >= 50) award('spark-50');
    if (combo >= MAX_COMBO) award('combo-5');
    renderHud();
    save();
  });

  /* ═══════════════════════════════════════
     ARCADE BRIDGE — arcade.js plays sounds and reports scores via events
     ═══════════════════════════════════════ */
  const ARCADE_SOUNDS = new Set(['ui', 'spark', 'unlock', 'hit', 'over']);

  document.addEventListener('game:sfx', (e) => {
    const name = e.detail?.name;
    if (!ARCADE_SOUNDS.has(name)) return;
    if (name === 'spark') sound.spark(Math.min(Math.max(1, Number(e.detail.combo) || 1), MAX_COMBO));
    else sound[name]();
  });

  document.addEventListener('game:arcade', (e) => {
    const score = Math.max(0, Math.floor(Number(e.detail?.score) || 0));
    const xp = Math.min(score * ARCADE_XP_PER_POINT, ARCADE_XP_CAP);
    if (xp) {
      toast({ kind: 'zone', eyebrow: 'Arcade run complete', title: `+${xp} XP`, text: `Lantern Keeper score: ${score}`, iconName: 'gamepad' });
      gainXP(xp);
    }
    if (score >= ARCADE_TROPHY_SCORE) award('lantern');
    save();
  });

  /* Outbound links: project/paper links and contact links earn trophies. */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    if (a.classList.contains('project-github-link')) award('loot');
    else if (/^(mailto:|tel:)/.test(a.getAttribute('href')) || a.closest('.hero-contact-bar, .social-links, .modal--victory')) {
      award('networker');
    }
  });

  /* ═══════════════════════════════════════
     (E) HUD
     ═══════════════════════════════════════ */
  const hud = $('hud');
  const pips = $('hud-pips');

  slots.forEach((slot, i) => {
    const li = el('li');
    const pip = el('button', 'hud__pip');
    pip.type = 'button';
    pip.dataset.zone = slot.dataset.section;
    pip.dataset.tip = `${String(i + 1).padStart(2, '0')} · ${zoneName(slot)}`;
    pip.addEventListener('click', () => {
      sound.ui();
      slot.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: isMounted(slot) ? 'start' : 'center' });
    });
    li.appendChild(pip);
    pips?.appendChild(li);
  });

  function renderHud() {
    const i = levelIndex(state.xp);
    const floor = LEVELS[i].xp;
    const next = LEVELS[i + 1]?.xp;
    const pct = next ? Math.round(((state.xp - floor) / (next - floor)) * 100) : 100;

    $('hud-level').textContent = i + 1;
    $('hud-title').textContent = LEVELS[i].title;
    $('hud-xp').textContent = next ? `${state.xp} / ${next} XP` : `${state.xp} XP · MAX`;
    $('hud-xp-fill').style.width = pct + '%';
    $('hud-xp-bar').setAttribute('aria-valuenow', String(pct));
    $('hud-sparks').textContent = state.sparks;
    $('hud-zone-count').textContent = state.unlocked.length;
    $('hud-zone-total').textContent = slots.length;
    $('hud-trophy-count').textContent = state.achievements.length;

    pips?.querySelectorAll('.hud__pip').forEach((pip) => {
      const open = state.unlocked.includes(pip.dataset.zone);
      pip.classList.toggle('hud__pip--open', open);
      pip.setAttribute('aria-label', `${pip.dataset.tip} — ${open ? 'unlocked, jump to it' : 'locked, go find it'}`);
    });

    hud.classList.toggle('hud--min', state.hudMin);
    const minBtn = $('hud-min');
    minBtn.setAttribute('aria-expanded', String(!state.hudMin));
    minBtn.setAttribute('aria-label', state.hudMin ? 'Expand game bar' : 'Minimise game bar');
    minBtn.dataset.tip = state.hudMin ? 'Expand' : 'Minimise';

    const soundBtn = $('hud-sound');
    soundBtn.setAttribute('aria-pressed', String(state.sound));
    soundBtn.dataset.tip = state.sound ? 'Sound on (M)' : 'Sound off (M)';
  }

  function toggleSound() {
    state.sound = !state.sound;
    renderHud();
    save();
    sound.ui();
  }

  $('hud-sound').addEventListener('click', toggleSound);
  $('hud-min').addEventListener('click', () => {
    state.hudMin = !state.hudMin;
    sound.ui();
    renderHud();
    save();
  });
  $('hud-reveal').addEventListener('click', () => {
    revealAll();
    toast({ kind: 'zone', eyebrow: 'Fast travel', title: 'Every zone is now open', iconName: 'fast-forward' });
  });
  $('hud-reset').addEventListener('click', () => {
    if (!window.confirm('Start a new game? Your XP, sparks and trophies will be cleared.')) return;
    clearSave();
    window.location.reload();
  });
  $('hud-trophies').addEventListener('click', () => {
    sound.ui();
    renderTrophies();
    openDialog($('trophy-room'));
  });

  /* Compass — points at the next locked zone when it's off-screen. */
  const compass = $('compass');
  let compassQueued = false;

  function updateCompass() {
    compassQueued = false;
    if (!compass || hud.hidden) return;
    const next = slots.find((s) => !isMounted(s));
    if (!next) {
      compass.hidden = true;
      return;
    }
    const r = next.getBoundingClientRect();
    const onScreen = r.top < window.innerHeight * 0.75 && r.bottom > window.innerHeight * 0.25;
    // The hero has its own "Explore" button; don't float a second one over it.
    const heroRect = $('hero')?.getBoundingClientRect();
    const heroInView = heroRect && heroRect.bottom > window.innerHeight * 0.6;
    compass.hidden = onScreen || heroInView;
    compass.classList.toggle('compass--up', r.bottom <= window.innerHeight * 0.25);
    $('compass-label').textContent = zoneName(next);
  }

  window.addEventListener('scroll', () => {
    if (!compassQueued) {
      compassQueued = true;
      requestAnimationFrame(updateCompass);
    }
  }, { passive: true });

  compass?.addEventListener('click', () => {
    const next = slots.find((s) => !isMounted(s));
    next?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  });

  /* ═══════════════════════════════════════
     DIALOGS — title screen, trophy room, victory
     ═══════════════════════════════════════ */
  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }

  document.querySelectorAll('dialog.modal').forEach((dialog) => {
    dialog.addEventListener('click', (e) => {
      // [data-close] buttons, or a click on the backdrop itself
      if (e.target.closest('[data-close]') || e.target === dialog) closeDialog(dialog);
    });
  });

  function renderTrophies() {
    const list = $('trophy-list');
    if (!list) return;
    const earnedFirst = [...ACHIEVEMENT_IDS].sort((a, b) => state.achievements.includes(b) - state.achievements.includes(a));
    list.replaceChildren(...earnedFirst.map((id) => {
      const a = ACHIEVEMENTS[id];
      const earned = state.achievements.includes(id);
      const item = el('li', 'trophy' + (earned ? ' trophy--earned' : ''));
      const badge = el('span', 'trophy__icon');
      badge.appendChild(icon(earned ? a.icon : 'lock'));
      const body = el('div', 'trophy__body');
      body.append(
        el('strong', 'trophy__name', earned || !a.secret ? a.name : 'Secret trophy'),
        el('span', 'trophy__desc', earned || !a.secret ? a.desc : 'Keep exploring…'),
      );
      item.append(badge, body);
      return item;
    }));
    $('trophy-count').textContent = state.achievements.length;
    $('trophy-total').textContent = ACHIEVEMENT_IDS.length;
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
  }

  function openVictory() {
    $('v-time').textContent = state.startedAt && state.finishedAt ? formatDuration(state.finishedAt - state.startedAt) : '—';
    $('v-level').textContent = `${levelIndex(state.xp) + 1} · ${LEVELS[levelIndex(state.xp)].title}`;
    $('v-sparks').textContent = state.sparks;
    $('v-combo').textContent = '×' + Math.max(1, state.bestCombo);
    $('v-trophies').textContent = `${state.achievements.length} / ${ACHIEVEMENT_IDS.length}`;
    openDialog($('victory'));
    if (!reduceMotion) {
      document.dispatchEvent(new CustomEvent('game:celebrate'));
      for (let i = 0; i < 4; i++) {
        setTimeout(() => burst(window.innerWidth * (0.2 + Math.random() * 0.6), window.innerHeight * (0.2 + Math.random() * 0.4), 24, 140), i * 260);
      }
    }
  }

  /* Welcome whisper */
  const welcome = $('unlock-welcome');
  let welcomeTimer = 0;
  function showWelcome() {
    if (!welcome || slots.every(isMounted)) return;
    welcome.classList.remove('unlock-welcome--fading');
    welcomeTimer = setTimeout(fadeWelcome, 6000);
  }
  function fadeWelcome() {
    clearTimeout(welcomeTimer);
    welcome?.classList.add('unlock-welcome--fading');
  }

  /* Title screen */
  const title = $('title-screen');

  function enterGame() {
    closeDialog(title);
    document.body.classList.add('game-on');
    hud.hidden = false;
    if (!state.startedAt) state.startedAt = Date.now();
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) award('night-owl');
    renderHud();
    updateCompass();
    save();
  }

  $('btn-start').addEventListener('click', () => {
    sound.ui();
    enterGame();
    showWelcome();
  });

  $('btn-new-game').addEventListener('click', () => {
    clearSave();
    window.location.reload();
  });

  $('btn-skip').addEventListener('click', () => {
    enterGame();
    revealAll();
    window.scrollTo({ top: 0 });
  });

  // Esc on the title screen just starts the game.
  title.addEventListener('cancel', (e) => {
    e.preventDefault();
    $('btn-start').click();
  });

  /* Keyboard: M toggles sound, Konami code unlocks a secret. */
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let konamiPos = 0;

  document.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, [contenteditable]')) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    // "Press Start": Enter works even if autofocus didn't land on the button.
    if (title.open && key === 'Enter' && !e.target.closest?.('button, a')) {
      e.preventDefault();
      $('btn-start').click();
      return;
    }

    konamiPos = key === KONAMI[konamiPos] ? konamiPos + 1 : (key === KONAMI[0] ? 1 : 0);
    if (konamiPos === KONAMI.length) {
      konamiPos = 0;
      document.dispatchEvent(new CustomEvent('game:celebrate'));
      burst(window.innerWidth / 2, window.innerHeight / 2, 40, 220);
      award('konami');
    }

    if (key === 'm' && !hud.hidden && !e.metaKey && !e.ctrlKey && !e.altKey) toggleSound();
  });

  /* ═══════════════════════════════════════
     BOOT — restore saved progress, then show the title screen
     ═══════════════════════════════════════ */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  state.unlocked.forEach((id) => {
    const slot = slotFor(id);
    if (slot) mount(slot);
  });
  $('title-zone-total').textContent = slots.length;
  document.querySelectorAll('[data-tap-word]').forEach((node) => { node.textContent = TAP; });
  renderHud();
  renderTrophies();
  syncNavLocks();
  document.body.classList.toggle('all-unlocked', slots.every(isMounted));

  document.body.classList.add('game-ready');

  if (slots.every(isMounted)) {
    // Returning visitor who has seen everything — straight to the portfolio.
    enterGame();
  } else {
    if (state.unlocked.length) {
      const progress = $('title-progress');
      progress.hidden = false;
      progress.textContent = `Saved game · ${state.unlocked.length}/${slots.length} zones · LV ${levelIndex(state.xp) + 1} · ${state.sparks} sparks`;
      $('btn-start-label').textContent = 'Continue';
      $('btn-new-game').hidden = false;
    }
    openDialog(title);
    $('btn-start').focus({ preventScroll: true });
  }
})();
