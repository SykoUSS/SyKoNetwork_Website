# SyKoNetwork — Indie Game Developer Website

The official website for **SyKoSoFi** (Sofia), an indie game developer operating under the studio name **SyKoNetwork**. Built with Astro and Tailwind CSS, deployed to GitHub Pages.

🌐 **Live site**: [syko.network](https://syko.network) *(after deployment)*

---

## Tech Stack

- **[Astro v5](https://astro.build)** — Static site generator
- **[Tailwind CSS v4](https://tailwindcss.com)** — Utility-first CSS framework (Vite plugin)
- **[GitHub Pages](https://pages.github.com)** — Hosting
- **[GitHub Actions](https://github.com/features/actions)** — CI/CD deployment
- **[Patreon API v2](https://docs.patreon.com)** — Build-time data fetching

---

## Getting Started

### Prerequisites

- **Node.js** v20 or later
- **npm** (or pnpm/yarn)

### Installation

```bash
# Clone the repository
git clone https://github.com/sykosofi/sykosofi.github.io.git
cd sykosofi.github.io

# Install dependencies
npm install
```

### Development

```bash
# Start the dev server (hot reload at localhost:4321)
npm run dev
```

### Production Build

```bash
# Build for production (output in dist/)
npm run build

# Preview the production build locally
npm run preview
```

---

## Project Structure

```
/
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions CI/CD
├── public/
│   ├── favicon.svg             # Site favicon
│   ├── robots.txt              # SEO robots file
│   ├── CNAME                   # Custom domain placeholder
│   └── images/                 # Static image assets
├── scripts/
│   └── fetch-patreon.js        # Build-time Patreon data fetcher
├── src/
│   ├── components/             # Reusable Astro components
│   │   ├── Header.astro        # Navigation bar
│   │   ├── Footer.astro        # Site footer
│   │   ├── Hero.astro          # Home page hero section
│   │   ├── ProjectCard.astro   # Project display card
│   │   ├── PostCard.astro      # Patreon post card
│   │   ├── NewsFeed.astro      # Post list renderer
│   │   ├── SocialLinks.astro   # Social media icon row
│   │   └── SectionHeader.astro # Reusable section title
│   ├── data/                   # JSON data files
│   │   ├── site-config.json    # Site-wide constants
│   │   ├── projects.json       # Project definitions
│   │   ├── patreon-posts.json  # Patreon posts (fetched/cached)
│   │   └── social-links.json   # Social platform URLs
│   ├── layouts/
│   │   └── BaseLayout.astro    # HTML shell with meta/SEO
│   ├── pages/
│   │   ├── index.astro         # Home page
│   │   ├── projects.astro      # Projects page
│   │   ├── news.astro          # News/updates page
│   │   └── about.astro         # About page
│   └── styles/
│       └── global.css          # Tailwind v4 + custom design system
├── astro.config.mjs            # Astro configuration
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript configuration
└── README.md                   # This file
```

---

## Adding New Projects

Edit `src/data/projects.json` and add a new entry:

```json
{
  "id": "my-new-project",
  "title": "My New Project",
  "description": "A short description of the project.",
  "thumbnail": "/images/placeholder-project.svg",
  "link": "https://example.com",
  "linkLabel": "Learn More",
  "status": "coming-soon",
  "tags": ["New Project", "In Development"]
}
```

**Status values:**
- `"active"` — Currently in active development (green badge)
- `"coming-soon"` — Announced but not yet released (amber badge)
- `"legacy"` — Archived/legacy project (sepia styling, "ARCHIVED" badge)

**Thumbnail:** Place images in `public/images/` and reference them as `/images/filename.png`.

---

## Patreon Integration

The site displays public posts from the [SyKoSoFi Patreon page](https://www.patreon.com/SyKoSoFi/home). Posts are fetched at **build time** — no client-side API calls.

### How It Works

1. The script `scripts/fetch-patreon.js` runs during the build
2. It tries the **Patreon API v2** first (if a token is available)
3. Falls back to **sitemap scraping** if the API fails
4. Keeps the **cached JSON file** if both methods fail (so the build never breaks)

### Setting Up the Patreon API Token

To get full post content and public/private status, you need a Patreon Creator's Access Token:

1. **Register a Patreon API client:**
   - Go to [Patreon Platform Portal](https://www.patreon.com/portal/registration/register-clients)
   - Create a new **API v2** client
   - Note your **Client ID** and **Client Secret**

2. **Get your Creator's Access Token:**
   - On the same page, you'll see your **Creator's Access Token**
   - This token has access to your campaign data

3. **Add the token to GitHub Actions:**
   - Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
   - Add a new secret named `PATREON_ACCESS_TOKEN`
   - Paste your Creator's Access Token as the value

4. **For local development:**
   - Create a `.env` file in the project root (it's gitignored):
     ```
     PATREON_ACCESS_TOKEN=your_token_here
     ```
   - Run `npm run fetch-patreon` to test the fetch locally

> **Note:** Without the token, the site still works! It falls back to scraping the Patreon sitemap for post titles and dates, or uses the cached data.

---

## Deployment

### Automatic (recommended)

Push to the `main` branch — GitHub Actions automatically builds and deploys to GitHub Pages.

### Manual

```bash
npm run build
# Deploy the dist/ folder to your hosting provider
```

### First-Time Setup

1. Push the repository to GitHub
2. Go to **Settings** → **Pages**
3. Under **Build and deployment**, select **Source: GitHub Actions**
4. The next push to `main` will trigger the deployment

### Custom Domain

1. Uncomment and edit `public/CNAME` with your domain (e.g., `sykonetwork.dev`)
2. Configure DNS with your domain provider (see [GitHub Docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site))
3. Update `site` in `astro.config.mjs` to your custom domain and remove `base`

### Repository Name Notes

- **User/org site** (`username.github.io`): `base: '/'` in `astro.config.mjs`
- **Project site** (`username.github.io/repo-name`): `base: '/repo-name'` in `astro.config.mjs`

---

## Design

- **Dark theme** with near-black backgrounds (`#0a0a0f`)
- **Neon purple** accent (`#c026d3`) with cyan secondary (`#06b6d4`)
- **Glitch text effect** on the brand name
- **Grid pattern** background on the hero
- **Legacy/Archive section** with sepia-toned styling for discontinued Minecraft projects
- **Responsive** — mobile hamburger menu, tablet 2-column, desktop 3-column grids
- **View Transitions** for smooth page navigation
- **CSS scroll animations** for staggered card reveals

---

## SEO

- Unique `<title>` and `<meta description>` on every page
- Open Graph tags for social sharing
- JSON-LD structured data (Organization + Person)
- Auto-generated sitemap via `@astrojs/sitemap`
- `robots.txt` configured

---

## License

All rights reserved. This is a personal website for SyKoSoFi / SyKoNetwork.

---

Built with ❤️ by SyKoSoFi using [Astro](https://astro.build).
