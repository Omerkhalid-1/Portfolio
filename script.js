/* ============================================
   PORTFOLIO WEBSITE — JAVASCRIPT
   ============================================
   Sections live in <template>s and are mounted by game.js when unlocked, so
   nothing here can assume an element exists at page load. Each feature
   initialises inside the root that game.js announces via `portfolio:mounted`.
   Loaded with `defer` before game.js, so the listener is ready before any
   saved progress is restored. */

(function () {
  'use strict';

  // ──────────────────────────────────────────
  // 0. FRAME-BUSTING — clickjacking defence for hosts that can't send
  //    `frame-ancestors` / X-Frame-Options headers (e.g. GitHub Pages).
  // ──────────────────────────────────────────
  if (window.top !== window.self) {
    try {
      window.top.location.replace(window.self.location.href);
    } catch (_) {
      document.documentElement.hidden = true; // sandboxed frame: just show nothing
    }
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ──────────────────────────────────────────
  // 1. MOBILE MENU TOGGLE
  // ──────────────────────────────────────────
  function setMenuOpen(open) {
    const hamburger = document.querySelector('.nav-hamburger');
    const links = document.querySelector('.nav-links');
    if (!hamburger || !links) return;
    hamburger.classList.toggle('active', open);
    links.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  function initMenu(root) {
    const hamburger = root.querySelector('.nav-hamburger');
    if (!hamburger) return;
    hamburger.addEventListener('click', () => {
      setMenuOpen(hamburger.getAttribute('aria-expanded') !== 'true');
    });
  }

  // ──────────────────────────────────────────
  // 2. IN-PAGE LINKS — smooth scroll, falling back to the locked zone
  // ──────────────────────────────────────────
  // "#certifications" resolves to the mounted section, or — if that zone is
  // still locked — to the slot whose firefly will unlock it.
  function resolveAnchor(hash) {
    const id = hash.slice(1);
    if (!id) return null;
    return document.getElementById(id)
      || document.querySelector(`.section-slot[data-anchor~="${CSS.escape(id)}"]`);
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const target = resolveAnchor(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    setMenuOpen(false);
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });

  // ──────────────────────────────────────────
  // 3. NAVBAR / BACK-TO-TOP / ACTIVE LINK (one rAF-throttled scroll handler)
  // ──────────────────────────────────────────
  function updateActiveNav() {
    const navLinks = document.querySelectorAll('.nav-links a');
    if (!navLinks.length) return;
    const probe = window.scrollY + 150;
    let activeId = null;
    document.querySelectorAll('section[id]').forEach((section) => {
      if (probe >= section.offsetTop && probe < section.offsetTop + section.offsetHeight) activeId = section.id;
    });
    if (activeId === 'stats') activeId = 'hero';
    navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === '#' + activeId));
  }

  let scrollQueued = false;
  function onScroll() {
    scrollQueued = false;
    const scrollY = window.scrollY;
    document.querySelector('.navbar')?.classList.toggle('scrolled', scrollY > 80);
    document.querySelector('.back-to-top')?.classList.toggle('visible', scrollY > 600);
    updateActiveNav();
  }

  window.addEventListener('scroll', () => {
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(onScroll);
    }
  }, { passive: true });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.back-to-top')) {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  });

  // ──────────────────────────────────────────
  // 4. STATS COUNTER ANIMATION
  // ──────────────────────────────────────────
  function animateCounter(el, end, duration, suffix) {
    if (reduceMotion) {
      el.textContent = end + suffix;
      return;
    }
    const startTime = performance.now();
    function update(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.floor(end * eased) + suffix;
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      animateCounter(el, parseInt(el.dataset.count, 10) || 0, 2000, el.dataset.suffix || '');
      counterObserver.unobserve(el);
    });
  }, { threshold: 0.5 });

  function initCounters(root) {
    root.querySelectorAll('.stat-number[data-count]').forEach((el) => counterObserver.observe(el));
  }

  // ──────────────────────────────────────────
  // 5. CARD TILT — subtle 3D lean toward the pointer (desktop only)
  // ──────────────────────────────────────────
  function initTilt(root) {
    if (reduceMotion || !finePointer) return;
    root.querySelectorAll('.project-card, .cert-card, .research-card').forEach((card) => {
      card.classList.add('tilt');
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', ((px - 0.5) * 8).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - py) * 8).toFixed(2) + 'deg');
        card.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  // ──────────────────────────────────────────
  // 6. PROJECT GITHUB LINKS (from project_links.json)
  // ──────────────────────────────────────────
  // Only absolute https:// URLs are accepted, so a bad or tampered entry can
  // never become a `javascript:` or `data:` link.
  function safeExternalUrl(value) {
    try {
      const url = new URL(String(value));
      return url.protocol === 'https:' ? url.href : null;
    } catch (_) {
      return null;
    }
  }

  // Same-origin only, no cookies, no redirects, and it must really be JSON
  // (not an HTML error page served in its place).
  const projectLinks = fetch('project_links.json', { mode: 'same-origin', credentials: 'omit', redirect: 'error' })
    .then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (!(res.headers.get('content-type') || '').includes('application/json')) throw new Error('Not JSON');
      return res.json();
    })
    .then((data) => {
      const linkMap = new Map();
      ['projects', 'research', 'miniProjects'].forEach((key) => {
        (Array.isArray(data?.[key]) ? data[key] : []).forEach((item) => {
          const url = safeExternalUrl(item?.github);
          if (typeof item?.name === 'string' && url) linkMap.set(item.name, url);
        });
      });
      return linkMap;
    })
    .catch((err) => {
      console.warn('Could not load project links:', err);
      return new Map();
    });

  function applyProjectLinks(root) {
    const links = root.querySelectorAll('.project-github-link[data-project]');
    if (!links.length) return;
    projectLinks.then((linkMap) => {
      links.forEach((el) => {
        const url = linkMap.get(el.dataset.project);
        if (url) el.href = url;
        el.rel = 'noopener noreferrer';
        // A link still pointing at "#" would just open this page in a new tab.
        if (el.getAttribute('href') === '#') el.hidden = true;
      });
    });
  }

  // ──────────────────────────────────────────
  // 7. CONTACT LINKS — assembled at runtime
  // ──────────────────────────────────────────
  // The email address and phone number never appear in the HTML, so simple
  // scrapers that harvest mailto:/tel: links and addresses from page source
  // come away empty. Markup uses data-contact / data-contact-text hooks.
  const CONTACT = {
    email: ['omerkhalid0333', 'gmail.com'],
    phone: ['+92', '335', '5232462'],
  };
  const contactHref = new Map([
    ['email', () => 'mailto:' + CONTACT.email.join('@')],
    ['phone', () => 'tel:' + CONTACT.phone.join('')],
  ]);
  const contactText = new Map([
    ['email', () => CONTACT.email.join('@')],
    ['phone', () => CONTACT.phone.join(' ')],
  ]);

  function hydrateContacts(root) {
    root.querySelectorAll('[data-contact]').forEach((a) => {
      const make = contactHref.get(a.dataset.contact);
      if (make) a.href = make();
    });
    root.querySelectorAll('[data-contact-text]').forEach((el) => {
      const make = contactText.get(el.dataset.contactText);
      if (make) el.textContent = make();
    });
  }

  hydrateContacts(document);

  // ──────────────────────────────────────────
  // 8. MOUNT HOOK
  // ──────────────────────────────────────────
  document.addEventListener('portfolio:mounted', (e) => {
    const root = e.detail.root;
    hydrateContacts(root);
    initMenu(root);
    initCounters(root);
    initTilt(root);
    applyProjectLinks(root);
    onScroll();
  });

  // ──────────────────────────────────────────
  // 9. FAILSAFE — the content must never stay locked
  // ──────────────────────────────────────────
  // If game.js didn't boot (blocked, failed to download, crashed), show every
  // section as a plain portfolio instead of an empty dark page.
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (document.body.classList.contains('game-ready')) return;
      document.body.classList.add('game-ready', 'game-on', 'game-failsafe');
      document.querySelectorAll('.section-slot:not(.section-slot--mounted)').forEach((slot) => {
        const tpl = document.getElementById('tpl-' + slot.dataset.section);
        if (!tpl) return;
        const wrap = document.createElement('div');
        wrap.className = 'unlocked-section';
        wrap.appendChild(tpl.content.cloneNode(true));
        wrap.querySelectorAll('.animate-on-scroll').forEach((el) => el.classList.remove('animate-on-scroll'));
        slot.classList.add('section-slot--mounted');
        slot.replaceChildren(wrap);
        document.dispatchEvent(new CustomEvent('portfolio:mounted', { detail: { id: slot.dataset.section, root: wrap } }));
      });
    }, 1500);
  });
})();
