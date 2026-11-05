# Mental Math Trainer

A mobile-first, offline-capable web app for mastering quick mental math:

- **3-digit addition** — left to right, biggest place value first (478 + 346 → 778 → 818 → 824), plus round-and-adjust (478 + 199 → 478 + 200 − 1).
- **3-digit subtraction** — count up through a round number, no borrowing (703 − 468 → 32 + 203 = 235), plus round-and-adjust (625 − 298 → 625 − 300 + 2).
- **Percentages** — build any percent from anchors 10%, 5%, 1%, 50%, 25%; increase/decrease, real-world problems, percent change and reverse percentages.

After every answer the app shows the "fast way" for that exact problem, step by step.

## Sections

- **Learn** — the method for each skill, worked examples, and a tap-to-reveal "try one".
- **Practice** — untimed, leveled problems. "Show method" reveals one step per tap. The answer is checked automatically as you type.
- **Drill** — 60-second rounds or 10-question sets mixing everything you've unlocked; ends with accuracy and seconds per question.
- **Progress** — day streak, per-skill accuracy and speed trends, and your weakest problem types.

Levels unlock at 90% accuracy over the last 20 questions. The generator leans toward problem types you miss or answer slowly, and a missed type comes back a few questions later as a fresh problem. Progress is stored in `localStorage` on your device.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for generators, walkthroughs and the adaptive engine
npm run build      # production build in dist/
npm run preview    # serve dist/ (service worker active)
```

## Deploy

Live (Netlify): https://mental-math-trainer-dp.netlify.app

To redeploy there: `npm run build`, zip the contents of `dist/`, and POST the zip to the Netlify deploys API for the site (or drag `dist/` onto the site's Deploys page).

### GitHub Pages


`.github/workflows/deploy.yml` tests, builds and publishes `dist/` to GitHub Pages on every push to the default branch.

One-time setup: in the repo go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**, then re-run the workflow (Actions tab → *Deploy to GitHub Pages* → *Run workflow*).

The site is then at `https://<user>.github.io/<repo>/`. On your phone, open it and use **Add to Home Screen** (iOS Share menu, or Android's *Install app*) to install it; it works offline after the first visit.

## Tech

Vite + vanilla TypeScript, no runtime dependencies and no network calls at runtime. The service worker (`src/sw-template.js`) is generated at build time with the list of built files so the whole app is precached.

```
src/core/methods.ts     step-by-step fast-way explanations
src/core/generators.ts  skills → levels → problem types
src/core/engine.ts      unlocks, adaptive weighting, retries, stats
src/ui/*                Learn / Practice / Drill / Progress views
tests/*                 vitest unit tests
```
