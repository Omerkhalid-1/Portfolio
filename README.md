# Omer Khalid — Portfolio Website

A premium, single-page portfolio website built with a **dark & gold** aesthetic — played as a small game. Visitors scroll through the dark to find a firefly in each of 8 zones; clicking it unlocks that section. Along the way they earn XP, level up, chain spark combos and collect trophies. Recruiters can skip straight to the full portfolio from the title screen.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Firefly Quest** | Title screen, 8 unlockable zones, XP & levels, spark combos, 13 trophies (2 secret), victory screen, saved progress, "show me everything" skip |
| **Arcade side tab** | Slide-out drawer with *Lantern Keeper*, a canvas mini-game: steer a lantern, catch fireflies to stay lit, dodge moths that hide in the dark. Runs earn XP; 25+ earns a trophy |
| **Themed 404** | Script-free "You wandered off the map" page served for any missing path |
| **Game HUD** | Level badge, XP bar, zone map (click to fast-travel), spark counter, sound toggle (`M`), reveal-all, new game |
| **Typographic Hero** | Name, role, three quick facts and calls to action — no photos, loads instantly |
| **Stats Counter** | Animated number counters that trigger on scroll (years, projects, certifications, clients) |
| **Work Experience Timeline** | Alternating left/right timeline with slide-in animations |
| **Certifications Grid** | Glassmorphic cards with gold-accent hover effects |
| **Projects Showcase** | Image-zoom cards with tech-stack tags and project links |
| **Smooth Scroll Animations** | Intersection Observer–powered fade/slide transitions throughout |
| **Responsive Design** | Tested from 320px phones up; touch-friendly game and arcade controls |
| **Adaptive performance** | Device-aware quality tiers (high / mid / low) with an automatic frame-rate watchdog |
| **Back-to-Top Button** | Floating gold button that appears on scroll |

---

## 🛠 Tech Stack

- **HTML5** — Semantic markup
- **CSS3** — Custom properties, CSS Grid, Flexbox, `backdrop-filter`, keyframe animations
- **JavaScript (ES6+)** — Intersection Observer, `requestAnimationFrame` counters
- **Google Fonts** — [Inter](https://fonts.google.com/specimen/Inter) + [Outfit](https://fonts.google.com/specimen/Outfit)
- **Lucide Icons** — self-hosted as an inline SVG sprite (no third-party scripts)
- **Web Audio API** — synthesized game sounds (no audio files)

---

## 📁 Project Structure

```
Portfolio-Website/
├── index.html          # Markup, section <template>s, HUD & dialogs, icon sprite
├── style.css           # Design system & section styles
├── game.css            # Game layer: HUD, title/victory screens, toasts, FX
├── ambience.js         # Fireflies (catchable sparks), shooting stars, cursor aura
├── script.js           # Nav, counters, card tilt, project links, contact links, failsafe
├── game.js             # Zone unlocks, XP, trophies, sound, saved progress
├── arcade.js / .css    # Side tab + "Lantern Keeper" mini-game
├── 404.html            # Themed not-found page (no JavaScript)
├── favicon.svg
├── project_links.json  # GitHub/paper URLs (https only)
├── images/
│   └── cert/           # Certification logos
├── netlify.toml        # Netlify deployment config
└── README.md
```

---

## 🚀 Getting Started

### Run Locally

```bash
# Clone the repository
git clone https://github.com/your-username/Portfolio-Website.git
cd Portfolio-Website

# Serve with any static file server
npx serve .
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Customize Content

Edit `index.html` to replace placeholder content with your own:

1. **Hero section** — Update name, tagline and the three highlight chips
2. **Stats** — Change the `data-count` attributes to your real numbers
3. **Work Experience** — Update roles, companies, dates, and descriptions
4. **Certifications** — Add your actual certifications
5. **Projects** — Replace with your real projects, images, and links
6. **Footer** — Add your social media URLs

---

## 🌐 Deployment

This is a **static site** — no build step required. Deploy to any static hosting platform:

### GitHub Pages

Live at **https://omerkhalid-1.github.io/Portfolio/** — Pages builds from the `main` branch, root folder `/`. Every push to `main` redeploys (about a minute).

- `.nojekyll` makes Pages serve the files as-is (no Jekyll build step).
- `404.html` uses `<base href="/Portfolio/">` because a project site lives under `/<repo-name>/`. If the repo is renamed or the site moves to a domain root (custom domain, Netlify, or a `<user>.github.io` repo), update that one line.
- GitHub Pages can't send custom headers, so `netlify.toml` is ignored there. The `<meta>` CSP (scripts, Trusted Types, images, fonts) still applies, GitHub adds HSTS, and `script.js` breaks out of frames to stand in for the missing `frame-ancestors` clickjacking header. For the full header set, deploy the same repo on Netlify.

### Netlify (recommended)

1. Push this repo to GitHub
2. Go to [netlify.com](https://netlify.com) → **Add new site → Import from Git**
3. Select your repository
4. Deploy settings are auto-configured via `netlify.toml`
5. Click **Deploy site**

### Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project → Import**
3. Select your repository — Vercel auto-detects static sites
4. Click **Deploy**

### Manual / Any Host

Upload the HTML, CSS and JS files, `project_links.json`, `favicon.svg` and the `images/` folder to any web server or CDN (e.g., AWS S3 + CloudFront, Firebase Hosting, Cloudflare Pages).

---

## ⚡ Performance

- **One canvas for the ambience.** Fireflies and shooting stars are drawn on a single `<canvas>` (one GPU layer) instead of ~120 animated elements, with a frame cap per device.
- **Quality tiers.** `ambience.js` picks `high` (capable desktops), `mid` (phones, ≤4-core or ≤4 GB machines) or `low` (reduced motion / data saver) and writes it to `<html data-fx>`. A watchdog steps the tier down if the real frame rate drops. Expensive CSS (frosted-glass blur, extra nebula glows) only switches on at `high`.
- **No per-frame repaints.** Removed the blurred, constantly repainting background layers; the nebula uses plain gradients and transform-only drift.
- **Arcade-friendly.** While a Lantern Keeper run is live the page's firefly field pauses, and the game pauses itself when the tab is hidden.
- **Failsafe.** If `game.js` fails to load, `script.js` shows every section as a normal portfolio after page load.

---

## 🔒 Security

- **Strict Content-Security-Policy** (`script-src 'self'`) — no inline scripts, no third-party JS, no frames or workers. Sent as a header by `netlify.toml` and mirrored in a `<meta>` tag; keep the two in sync if you add a CDN or image host.
- **Trusted Types** (`require-trusted-types-for 'script'`) — the browser refuses HTML-string DOM sinks such as `innerHTML`, so DOM-based XSS is blocked even if a bug slips in. All dynamic text uses `textContent`.
- Clickjacking protection (`frame-ancestors 'none'`, `X-Frame-Options`), `nosniff`, HSTS, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`.
- **Contact details are not in the HTML** — the email and phone are assembled at runtime (`script.js`, `CONTACT`) so source-scraping spam bots don't find them. Edit them there.
- Third-party images load with `referrerpolicy="no-referrer"`.
- External links use `rel="noopener noreferrer"`; `project_links.json` is fetched same-origin, without cookies or redirects, must be real JSON, and only `https://` URLs are accepted.
- Saved game state and arcade scores in `localStorage` are validated on load.
- No catch-all rewrite: unknown paths return a real `404`, and repo files (`.git/`, `README.md`, `netlify.toml`, `.DS_Store`…) are force-404'd even though the repo root is published.

---

## 🎨 Design System

| Token | Value |
|-------|-------|
| Background Primary | `#0a0a0a` |
| Background Secondary | `#111111` |
| Gold Primary | `#d4a850` |
| Gold Light | `#f0d48a` |
| Gold Dark | `#b8912e` |
| Text Primary | `#f5f0e8` |
| Text Secondary | `#a09882` |
| Heading Font | Outfit |
| Body Font | Inter |

---

## 📄 License

© 2026 Omer Khalid. All rights reserved.
