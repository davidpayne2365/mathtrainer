# Mental Math Trainer

A mobile-first, offline-capable web app for mastering quick mental math:

- **Facts 1–10, memorized** — every addition fact (1 + 1 to 10 + 10), subtraction fact (2 − 1 to 20 − 10) and times-table fact (1 × 1 to 10 × 10). Each fact is tracked on its own and is mastered after 3 fast, correct answers in a row; shaky facts come back more often until they stick.
- **3-digit addition** — left to right, biggest place value first (478 + 346 → 778 → 818 → 824), plus round-and-adjust (478 + 199 → 478 + 200 − 1).
- **3-digit subtraction** — count up through a round number, no borrowing (703 − 468 → 32 + 203 = 235), plus round-and-adjust (625 − 298 → 625 − 300 + 2).
- **Percentages** — build any percent from anchors 10%, 5%, 1%, 50%, 25%; increase/decrease, real-world problems, percent change and reverse percentages.

A correct answer moves straight on to the next question (the previous problem's fast way is one tap away). A wrong answer stops and shows the fast way for that exact problem, step by step.

## Sections

- **Practice** — untimed, leveled problems. "Show method" reveals one step per tap. The answer is checked automatically as you type.
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

To redeploy: `npm run build`, then upload the contents of `dist/` to the Netlify site (drag the folder onto the site's Deploys page, or POST a zip of it to the Netlify deploys API).

`.github/workflows/ci.yml` runs the tests and a production build on every push.

## Tech

Vite + vanilla TypeScript, no runtime dependencies and no network calls at runtime. The service worker (`src/sw-template.js`) is generated at build time with the list of built files so the whole app is precached.

```
src/core/methods.ts     step-by-step fast-way explanations
src/core/generators.ts  skills → levels → problem types
src/core/engine.ts      unlocks, adaptive weighting, retries, stats
src/ui/*                Practice / Progress views
tests/*                 vitest unit tests
```
