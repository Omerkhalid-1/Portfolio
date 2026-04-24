/* ============================================
   PORTFOLIO WEBSITE — JAVASCRIPT
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ──────────────────────────────────────────
  // 1. HERO SLIDER
  // ──────────────────────────────────────────
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.slider-dot');
  let currentSlide = 0;
  let sliderInterval;

  function goToSlide(index) {
    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');
    currentSlide = index;
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
  }

  function nextSlide() {
    goToSlide((currentSlide + 1) % slides.length);
  }

  function startSlider() {
    sliderInterval = setInterval(nextSlide, 4500);
  }

  function stopSlider() {
    clearInterval(sliderInterval);
  }

  // Dot click
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      stopSlider();
      goToSlide(i);
      startSlider();
    });
  });

  // Pause on hover
  const heroSection = document.querySelector('.hero');
  heroSection.addEventListener('mouseenter', stopSlider);
  heroSection.addEventListener('mouseleave', startSlider);

  startSlider();

  // ──────────────────────────────────────────
  // 2. NAVBAR SCROLL EFFECT
  // ──────────────────────────────────────────
  const navbar = document.querySelector('.navbar');
  const backToTop = document.querySelector('.back-to-top');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;

    // Navbar background
    if (scrollY > 80) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    // Back to top button
    if (scrollY > 600) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }

    // Active nav link
    updateActiveNav();
  });

  // ──────────────────────────────────────────
  // 3. ACTIVE NAV LINK HIGHLIGHTING
  // ──────────────────────────────────────────
  const navLinks = document.querySelectorAll('.nav-links a');
  const sections = document.querySelectorAll('section[id]');

  function updateActiveNav() {
    const scrollY = window.scrollY + 150;

    sections.forEach((section) => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');

      if (scrollY >= top && scrollY < top + height) {
        navLinks.forEach((link) => {
          link.classList.remove('active');
          if (link.getAttribute('href') === '#' + id) {
            link.classList.add('active');
          }
        });
      }
    });
  }

  // ──────────────────────────────────────────
  // 4. MOBILE MENU TOGGLE
  // ──────────────────────────────────────────
  const hamburger = document.querySelector('.nav-hamburger');
  const navLinksContainer = document.querySelector('.nav-links');

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navLinksContainer.classList.toggle('open');
  });

  // Close on link click
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      navLinksContainer.classList.remove('open');
    });
  });

  // ──────────────────────────────────────────
  // 5. SCROLL ANIMATIONS (Intersection Observer)
  // ──────────────────────────────────────────
  const animatedElements = document.querySelectorAll('.animate-on-scroll');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, idx) => {
        if (entry.isIntersecting) {
          // Stagger the animations for elements in a grid
          const delay = entry.target.dataset.delay || 0;
          setTimeout(() => {
            entry.target.classList.add('in-view');
          }, delay);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
  );

  animatedElements.forEach((el, i) => {
    // Auto-stagger for grid items
    if (el.closest('.cert-grid') || el.closest('.projects-grid') || el.closest('.stats-grid')) {
      el.dataset.delay = i * 100;
    }
    observer.observe(el);
  });

  // ──────────────────────────────────────────
  // 6. STATS COUNTER ANIMATION
  // ──────────────────────────────────────────
  const statNumbers = document.querySelectorAll('.stat-number');

  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target;
          const end = parseInt(target.dataset.count, 10);
          const suffix = target.dataset.suffix || '';
          animateCounter(target, 0, end, 2000, suffix);
          counterObserver.unobserve(target);
        }
      });
    },
    { threshold: 0.5 }
  );

  statNumbers.forEach((el) => counterObserver.observe(el));

  function animateCounter(el, start, end, duration, suffix) {
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (end - start) * eased);
      el.textContent = current + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  // ──────────────────────────────────────────
  // 7. BACK TO TOP
  // ──────────────────────────────────────────
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ──────────────────────────────────────────
  // 8. SMOOTH SCROLL FOR NAV LINKS
  // ──────────────────────────────────────────
  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      const targetSection = document.querySelector(targetId);
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
  // ──────────────────────────────────────────
  // 9. LOAD PROJECT GITHUB LINKS
  // ──────────────────────────────────────────
  fetch('project_links.json')
    .then((res) => res.json())
    .then((data) => {
      const allLinks = document.querySelectorAll('.project-github-link[data-project]');
      // Build a name→url map from all categories
      const linkMap = {};
      ['projects', 'research', 'miniProjects'].forEach((key) => {
        if (data[key]) {
          data[key].forEach((item) => {
            linkMap[item.name] = item.github;
          });
        }
      });
      allLinks.forEach((el) => {
        const name = el.dataset.project;
        if (linkMap[name]) {
          el.href = linkMap[name];
        }
      });
    })
    .catch((err) => console.warn('Could not load project links:', err));

});
