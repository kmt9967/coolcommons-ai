# CoolCommons AI

**Intelligent Urban Heat Resilience & Community Cooling Planner** — *"Turning climate data into cooler, safer communities."*

Team **Teqprotech** (Team ID E10) · **ATOX AI for Climate · Youth Climate Hackathon at COP31** · Category: Climate Adaptation & Resilience

- **Live app:** https://coolcommons-ai.vercel.app
- **Source:** https://github.com/kmt9967/coolcommons-ai

---

## The climate problem

Extreme heat is one of the deadliest climate hazards, and Karachi's humid coastal climate makes the heat people *feel* several degrees higher than the air temperature. In the reanalysis grid cell used by this app, daily maximum apparent temperature reached **43.7 °C on 16 June 2025** (air 38.0 °C, 74% humidity), and the number of days at or above 39 °C apparent temperature was **41 in 2024 and 39 in 2025**, compared with 4–16 per year in 2016–2023 (Open-Meteo / ERA5, see `src/data`).

Municipal resilience teams, NGOs and community planners have to decide where to put limited resources — water points, shade, cooling spaces, heat information — but climate data is rarely presented in a form that supports those decisions.

## Target users

Municipal climate-resilience teams · NGOs and humanitarian organisations · community planners · public-health and urban-planning stakeholders.

## What it does

| Feature | Description |
|---|---|
| **Climate Intelligence dashboard** | Apr–Jun 2025 daily air vs. apparent temperature, hourly profiles for the five highest-exposure days, 2016–2025 seasonal climatology, annual "Danger"-band day counts, and a separate **live 7-day forecast** (clearly distinguished from history). |
| **Community map** | 1,950 facilities from OpenStreetMap (hospitals, clinics, libraries, community centres, parks, drinking water) labelled as *potential facilities for assessment* — never as verified cooling centres. |
| **Intervention simulator** | Place hypothetical drinking-water points, shaded rest areas, community cooling spaces and heat-information stations, or let a **greedy maximal-coverage optimiser** suggest sites. Before/after comparison of a transparent, area-based access proxy with editable radii. |
| **Heat resilience assessment** | An explainable 0–100 Heat Exposure Index combining real reanalysis data with user assumptions; every component is tagged *Data*, *Assumption* or *Scenario*. |
| **AI adaptation planner** | Structured plans (evidence, exposure concerns, interventions, accessibility, resources, priorities, assumptions) grounded in the selected climate day, assessment and simulator results. Uses Google Gemini 2.5 Flash (free tier) when configured; otherwise a clearly labelled rules engine. |
| **Impact & methodology** | Formulas, data sources, limitations and the next validation step. |

## Architecture

```
Next.js 15 (App Router, TypeScript, Tailwind CSS v4)
├─ src/app/page.tsx              → client App (sections, shared scenario state)
├─ src/app/api/forecast          → server route: Open-Meteo forecast, retries, 30-min revalidation, honest failure state
├─ src/app/api/plan              → server route: zod validation, rate limit, size limit, cache,
│                                   25 s timeout, Gemini 2.5 Flash (free tier, JSON mode) → schema check → rules-engine fallback
├─ src/lib/heat.ts               → heat bands, Heat Exposure Index, haversine, sample grid, coverage, greedy placement
├─ src/lib/planner.ts            → request schema, grounded prompt builder, JSON parser, rules engine
├─ src/data/*.json               → cached Open-Meteo reanalysis (Apr–Jun 2025 hourly/daily; 2016–2025 daily climatology)
├─ public/data/facilities.json   → processed OSM facilities (ODbL)
├─ scripts/                      → reproducible data-processing scripts (Python + Overpass shell script)
└─ src/lib/heat.test.ts          → Vitest unit tests
```

Charts: Recharts · Map: Leaflet / react-leaflet with Esri Dark Gray basemap · Validation: zod. No database, no accounts, no authentication.

## Data sources

| Source | Use | Licence / notes |
|---|---|---|
| [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api) | `temperature_2m`, `apparent_temperature`, `relative_humidity_2m`, `precipitation`, daily max/min — Karachi (24.86 N, 67.00 E request; grid cell 24.85 N, 66.99 E, 7 m) | CC BY 4.0. Based on ERA5 / ERA5-Land reanalysis (ECMWF, Copernicus C3S) — **modelled reanalysis, not station observations**; ~9–25 km resolution |
| [Open-Meteo Forecast API](https://open-meteo.com/en/docs) | Live current conditions and 7-day forecast | CC BY 4.0 |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) via Overpass API | Community facilities (retrieved 16 Nov 2026) | © OpenStreetMap contributors, ODbL 1.0 |
| Esri World Dark Gray Canvas | Basemap tiles | © Esri, HERE, Garmin, OSM contributors |
| US NWS heat-index categories | Screening thresholds 27 / 32 / 39 / 51 °C, applied to apparent temperature as an indicative scale | Public domain guidance |
| WHO heat-health guidance | General list of groups more affected by heat and no-regret interventions | Referenced, not reproduced |

Reproduce data: `bash scripts/fetch_osm.sh` and `python scripts/process_climate.py <summer.json> <decade.json> src/data` (raw API URLs documented in the scripts).

## Methodology

- **Heat Exposure Index (0–100):** apparent temperature up to 45 pts (linear 27→51 °C); humidity up to 5 (50→90%); exposure 2.5 pts/h up to 8 h; activity 0/5/10; shade 0/5/10; no water within 250 m +5; distance to cooling space up to 5 (200→1,200 m). Weights are prototype design choices to be calibrated with local partners.
- **Access proxy:** evenly spaced sample points (100 m) within a 1.5 km study circle; coverage = % of points within an editable straight-line radius of ≥1 site; mean and worst nearest-site distance also reported.
- **Site suggestions:** greedy maximal-coverage location allocation over the sample grid.

## Model usage

- Provider: **Google Gemini API (free tier)**, default model `gemini-2.5-flash` (fallback alias `gemini-flash-latest`), key from Google AI Studio stored only as the server-side Vercel environment variable `GEMINI_API_KEY`. No billing is enabled and no paid API is used.
- The model receives only the structured context (climate values + source, assessment inputs, simulation results) and the user's question, with instructions not to invent statistics, health outcomes, costs or partners.
- Safeguards: zod input validation, 6 requests/min per IP, 6 KB request cap, 25 s timeout, 2,048 output tokens, JSON-mode output validated against a schema, 30-minute response cache, and graceful handling of free-tier quota exhaustion (HTTP 429).
- If no key is set, the provider fails, or quota is exhausted, a deterministic **rules-based engine** produces the plan. It is labelled *Rules-based output · no AI model called* and is never presented as AI.

## Limitations

- Reanalysis describes city-scale conditions; it cannot resolve neighbourhood microclimates, and the coastal grid cell may understate inland heat.
- OSM data may be incomplete or out of date; facility suitability, hours, capacity and owner consent are unknown.
- The access proxy is area-based and straight-line — not population, routes, safety or barriers.
- The index is not validated against health outcomes; no medical, mortality or temperature-reduction predictions are made.
- AI output can be wrong and must be reviewed by people with local knowledge.

**Next validation step:** co-design sessions with a Karachi NGO / municipal team; add ward-level population and Landsat land-surface-temperature layers; field-check candidate sites; calibrate weights against PDMA Sindh / NDMA heatwave guidance.

## Development

```bash
npm install
cp .env.example .env.local   # optional: add GEMINI_API_KEY
npm run dev                  # http://localhost:3000
npm test                     # unit tests (Vitest)
npm run build
```

### Deployment

Import the GitHub repo into Vercel (framework preset: Next.js). Optional env vars: `GEMINI_API_KEY`, `GEMINI_MODEL`. Never commit `.env.local`.

## Prior work & disclosure

- Bootstrapped with `create-next-app`; uses open-source libraries (Next.js, React, Tailwind CSS, Recharts, Leaflet, react-leaflet, zod, Vitest).
- No code was reused from the team's earlier projects (e.g. KhidmatConnect AI); only the general idea of a server-side LLM integration pattern was carried over.
- Code, data processing, documentation and media were produced with substantial assistance from an AI coding assistant (Claude Code), directed and reviewed by the team.
- Timing: the application code in this repository was written on **16 November 2026** (see git history), after the official core-development window (14–15 Nov) had closed.

## Team Teqprotech

Khawaja Muhammad Talal · Aqeela Urooj · Umer Anis · Aliya Yousuf

## Licence

Code: MIT. Data retains its original licences (Open-Meteo CC BY 4.0; OpenStreetMap ODbL).
