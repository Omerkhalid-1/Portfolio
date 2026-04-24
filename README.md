# Omer Khalid — Portfolio Website

A premium, single-page portfolio website built with a **dark & gold** aesthetic. Features smooth scroll-triggered animations, an auto-rotating hero photo slider, an interactive work-experience timeline, and glassmorphic UI cards.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Hero Photo Slider** | Full-viewport auto-rotating carousel with crossfade transitions, dot navigation, and pause-on-hover |
| **Stats Counter** | Animated number counters that trigger on scroll (years, projects, certifications, clients) |
| **Work Experience Timeline** | Alternating left/right timeline with slide-in animations |
| **Certifications Grid** | Glassmorphic cards with gold-accent hover effects |
| **Projects Showcase** | Image-zoom cards with tech-stack tags and project links |
| **Smooth Scroll Animations** | Intersection Observer–powered fade/slide transitions throughout |
| **Responsive Design** | Mobile-first layout with hamburger navigation |
| **Back-to-Top Button** | Floating gold button that appears on scroll |

---

## 🛠 Tech Stack

- **HTML5** — Semantic markup
- **CSS3** — Custom properties, CSS Grid, Flexbox, `backdrop-filter`, keyframe animations
- **JavaScript (ES6+)** — Intersection Observer, `requestAnimationFrame` counters
- **Google Fonts** — [Inter](https://fonts.google.com/specimen/Inter) + [Outfit](https://fonts.google.com/specimen/Outfit)
- **Lucide Icons** — Lightweight SVG icon library via CDN

---

## 📁 Project Structure

```
Portfolio-Website/
├── index.html          # Main single-page HTML
├── style.css           # Complete design system & responsive styles
├── script.js           # Slider, animations, counters, mobile menu
├── images/
│   ├── hero-1.png      # Slider image 1
│   ├── hero-2.png      # Slider image 2
│   └── hero-3.png      # Slider image 3
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

1. **Hero section** — Update name, tagline, and replace images in `images/`
2. **Stats** — Change the `data-count` attributes to your real numbers
3. **Work Experience** — Update roles, companies, dates, and descriptions
4. **Certifications** — Add your actual certifications
5. **Projects** — Replace with your real projects, images, and links
6. **Footer** — Add your social media URLs

---

## 🌐 Deployment

This is a **static site** — no build step required. Deploy to any static hosting platform:

### GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source to **main** branch, root folder `/`
4. Your site will be live at `https://your-username.github.io/Portfolio-Website/`

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

Upload `index.html`, `style.css`, `script.js`, and the `images/` folder to any web server or CDN (e.g., AWS S3 + CloudFront, Firebase Hosting, Cloudflare Pages).

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
