# DokterSolar ☀️

A solar design and proposal studio: sketch a roof on satellite imagery, auto-fill it with panels, estimate energy and savings, and send a printable customer proposal.

> Portfolio project. All names, branding, copy and UI are original.

**Stack:** React 18 · Vite · TypeScript · Tailwind CSS · React Router · Leaflet (react-leaflet) with Esri World Imagery · Recharts · localStorage · Netlify (+ an optional Netlify Function for NREL PVWatts)

---

## Features

| Area | What it does |
| --- | --- |
| **Dashboard** (`/home`) | Stat cards (active projects, kWp designed, proposals sent/accepted), recent projects, projects-per-month chart, drag-and-drop pipeline (Lead → Designing → Proposal Sent → Won → Installed) |
| **Projects** (`/projects`, `/projects/:id/:tab`) | Create projects (address geocoded with Nominatim), search/filter, tabs for Info, Design, Energy, Proposal |
| **Design tool** | Satellite map, click to draw the roof polygon (double-click or **Finish** to close), drag corners to edit, panels auto-filled in a grid with edge setback and gap. Wattage, size, orientation, tilt, azimuth and max panels are editable, with a live panel count and kWp |
| **Energy & savings** | `kWp × peak sun hours × 365 × 0.8`, or NREL PVWatts if configured. Monthly production chart, tariff, price per watt, degradation, tariff escalation, payback and 25-year cumulative savings |
| **Proposal** (`/proposals/:id`) | Clean customer-facing page with map snapshot, key numbers, charts and assumptions. **Export to PDF** uses the browser print dialog with print CSS. **Share link** puts the proposal data in the URL so it opens on any device |
| **Leads / Designs / Proposals** | Focused list views |
| **Settings** | Company name, contact, logo upload (stored as base64), default panel wattage, price per watt, tariff, peak sun hours and currency. You can also reset to the demo data |

Five sample projects in Malaysia are seeded on first load. Default currency is **MYR (RM)**; you can change it in Settings.

---

## Project structure

```
doktersolar/
├─ netlify.toml                 # build + SPA redirect
├─ netlify/functions/pvwatts.mjs  # optional NREL PVWatts proxy (key stays server-side)
├─ public/favicon.svg
├─ index.html
├─ src/
│  ├─ main.tsx, App.tsx, index.css, types.ts
│  ├─ lib/
│  │  ├─ solar.ts      # roof geometry, panel layout, energy + financial model
│  │  ├─ store.ts      # localStorage-backed store + React hooks
│  │  ├─ defaults.ts   # default settings / design / energy
│  │  ├─ seed.ts       # 5 demo projects
│  │  ├─ api.ts        # Nominatim geocoding, PVWatts client, share-link encoding
│  │  └─ format.ts     # currency / number / date helpers
│  ├─ components/      # Layout, SolarMap, Charts, Pipeline, ProposalDocument, ui…
│  └─ pages/           # Home, Projects, ProjectDetail (+ project/ tabs), Leads, Designs, Proposals, ProposalView, Settings
└─ README.md
```

---

## Run locally

You need **Node.js 18+** (20 LTS recommended).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. Other scripts:

```bash
npm run build
```

```bash
npm run preview
```

### Running the PVWatts function locally (optional)

`npm run dev` runs the frontend only, so the **Get PVWatts estimate** button shows "function not available". To run the function too, use the Netlify CLI:

```bash
npm install -g netlify-cli
```

Create a `.env` file (copy `.env.example`) containing `NREL_API_KEY=your-key`, then:

```bash
netlify dev
```

This serves the app and `/.netlify/functions/pvwatts` together (usually at http://localhost:8888).

Get a free NREL key at https://developer.nrel.gov/signup/.

---

## Deploy to Netlify (step by step)

1. **Push to GitHub** (or GitLab/Bitbucket):
   ```bash
   git init
   ```
   ```bash
   git add . && git commit -m "DokterSolar"
   ```
   Then create a repo and push.
2. In **Netlify → Add new site → Import an existing project**, pick the repo.
3. Netlify reads `netlify.toml`, so the settings fill in on their own:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. Click **Deploy**. The `/* → /index.html 200` redirect in `netlify.toml` makes deep links such as `/projects/demo-1/design` and shared proposal links work.
5. **(Optional) Turn on PVWatts:**
   1. Go to **Site configuration → Environment variables → Add a variable**.
   2. Key: `NREL_API_KEY`, Value: your NREL key. Scope: at least *Functions*.
   3. Go to **Deploys → Trigger deploy → Deploy site** so the function picks it up.
   4. Open a project's **Energy** tab and click **Get PVWatts estimate**.

   The key is only read inside `netlify/functions/pvwatts.mjs` (`process.env.NREL_API_KEY`). It is never bundled into the frontend. Don't prefix it with `VITE_`.

**Alternative (CLI deploy):**

```bash
netlify deploy --build --prod
```

---

## How the numbers work

- **Roof area:** the polygon is projected to local metres (equirectangular around its centroid), then the shoelace formula gives the area. Sloped area = plan area ÷ cos(tilt).
- **Panel fill:** the roof is rotated so rows run perpendicular to the azimuth. A grid of panel footprints is tested: all four corners must sit inside the roof, at least the setback distance from every edge, and no roof vertex may poke into a panel. The plan-view length of a panel shrinks by cos(tilt). Sixteen grid offsets are tried and the one that fits the most panels wins.
- **Production (simple):** `kWp × peak sun hours × 365 × 0.8`, split across months by day count with a mild seasonal curve that grows with latitude.
- **Production (PVWatts):** NREL PVWatts v8, fixed roof mount, 14% losses. The function tries the `nsrdb` dataset first and falls back to `intl`.
- **Savings:** year-*n* savings = production × (1 − degradation)^(n−1) × tariff × (1 + escalation)^(n−1). Payback is the interpolated year where cumulative savings exceed the system cost (`kWp × 1000 × price per watt`).

These are indicative estimates for a portfolio demo, not engineering-grade simulations. They don't model shading, inverter clipping, export tariffs or net metering.

---

## Notes & limitations

- **Storage:** all data lives in `localStorage` in your browser. Clearing site data, or using another browser, gives a fresh demo. Use **Settings → Reset demo data** to start over.
- **Share links** embed the proposal as base64 JSON in the URL fragment (`#d=…`). The fragment is never sent to the server. The uploaded logo is left out to keep links short.
- **Nominatim** is a free, rate-limited service (about 1 request per second). Geocoding runs only when you create a project or press **Locate/Go**.
- **Imagery:** Esri World Imagery tiles. Keep the on-map attribution. Check Esri's terms before any commercial use.
- **Sample roofs** are approximate rectangles placed near real coordinates for demo purposes.

## License

MIT for the code in this repository.
