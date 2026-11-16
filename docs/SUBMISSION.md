# CoolCommons AI — Submission Package

**Project:** CoolCommons AI — Intelligent Urban Heat Resilience & Community Cooling Planner
**Tagline:** Turning climate data into cooler, safer communities.
**Team:** Teqprotech (Team ID E10) — ATOX AI for Climate · Youth Climate Hackathon at COP31
**Category:** Climate Adaptation & Resilience · Focus: Karachi, Pakistan

## Links

| Material | Link |
|---|---|
| Live demo | https://coolcommons-ai.vercel.app |
| Source code (MIT) | https://github.com/kmt9967/coolcommons-ai |
| Pitch deck (.pptx) | https://coolcommons-ai.vercel.app/submission/CoolCommons-AI-pitch.pptx |
| Pitch deck PDF backup | https://coolcommons-ai.vercel.app/submission/CoolCommons-AI-pitch.pdf |
| Recorded demo (.mp4) | https://coolcommons-ai.vercel.app/submission/CoolCommons-AI-demo.mp4 |
| README (architecture, data, model, limitations) | https://github.com/kmt9967/coolcommons-ai#readme |

## Team members and roles

- Khawaja Muhammad Talal — project lead, submission contact
- Aqeela Urooj — team member
- Umer Anis — team member
- Aliya Yousuf — team member

## Project summary

Extreme heat is one of the deadliest climate hazards, and Karachi's humid coastal air makes heat feel far worse than the thermometer shows. In ERA5 reanalysis for the city, apparent ("feels-like") temperature peaked at 43.7 °C on 16 June 2025, and days at or above 39 °C apparent numbered 41 in 2024 and 39 in 2025, compared with 4–16 per year in 2016–2023. Municipal resilience teams, NGOs and community planners must decide where scarce resources — drinking water, shade, cooling spaces and heat information — will help most, but climate data rarely arrives in a decision-ready form. CoolCommons AI combines real climate data, 1,950 OpenStreetMap community facilities, an intervention simulator with a maximal-coverage optimiser, an explainable Heat Exposure Index and a grounded AI planner in one web app, so users can compare low-cost adaptation options before acting.

## AI approach and data sources

- **AI:** Google Gemini Flash models via the Gemini API free tier (gemini-2.5-flash first, falling back to Flash-Lite models when overloaded or rate-limited), called server-side from a Next.js API route. The model receives only structured context (selected climate day and its source, assessment inputs and score, simulator results) plus the user's question, and must return JSON with seven sections (evidence, exposure concerns, interventions, accessibility, resources, priorities, assumptions & uncertainties). Safeguards: zod validation, rate limits, request-size cap, 45 s timeout, token cap, schema validation, caching, quota handling. If AI is unavailable, a deterministic rules engine produces a plan that is labelled "no AI model called".
- **Optimisation (not AI):** greedy maximal-coverage location allocation suggests sites that reach the most currently unserved sample points.
- **Data:** Open-Meteo Historical Weather API (ERA5/ERA5-Land reanalysis, CC BY 4.0) and Forecast API; OpenStreetMap via Overpass (ODbL); Esri Dark Gray basemap; NWS heat-index bands (27/32/39/51 °C) as a screening scale.
- **Limitations:** reanalysis is city-scale (~9–25 km), not station or street level; OSM may be incomplete; the access proxy is area-based, not population-based; the index weights are not validated against health outcomes; AI output must be reviewed. No sensors or hardware.

## Prototype test instructions

Open https://coolcommons-ai.vercel.app (no login). 1) Climate Intelligence: click a day or use the dropdown. 2) Community Map: choose "Lyari", select "Drinking-water point", click "Suggest best 3 sites", and compare before/after reach. 3) Assessment: change shade/activity and click "Use simulator value". 4) AI Planner: click "Generate adaptation plan"; the badge shows whether output is AI-generated (Gemini) or rules-based.

## Existing work and event contributions

- Pre-existing: team's general experience with web apps and server-side LLM integration (earlier project KhidmatConnect AI). **No code was reused.**
- Third-party: Next.js, React, Tailwind CSS, Recharts, Leaflet/react-leaflet, zod, Vitest, pptxgenjs, Playwright; data from Open-Meteo/ECMWF ERA5, OpenStreetMap, Esri basemap.
- AI-generated content: application code, documentation, slides and the demo recording script were produced with substantial assistance from an AI coding assistant (Claude Code), directed and reviewed by the team. The planner's plans are generated at runtime by Gemini (or the rules engine).
- **Timing disclosure:** the CoolCommons AI code, data processing, deployment and materials were created on 16 November 2026 (see git history), i.e. after the official 14–15 November core-development window, during the morning designated for recording, documentation and submission.

## Climate impact and next steps

- **Expected contribution (not yet measured):** help local organisations site water points, shade and cooling spaces where they extend access most, using transparent evidence — supporting heat adaptation and resilience before the next hot season.
- **Tested so far:** 12 automated unit tests (calculations, data parsing, coverage optimiser) pass; production build verified; browser tests on desktop and mobile; real climate data retrieval verified. No field pilot or user study has been run; no temperature, health or population-coverage outcomes are claimed.
- **Next step:** co-design and test with a Karachi NGO or municipal team; add ward-level population and Landsat land-surface-temperature layers; field-check candidate sites; calibrate index weights with PDMA Sindh / NDMA heatwave guidance.

## COP31 presentation availability

To be confirmed by the team. Remote or recorded participation is the default; in-person attendance only with a valid Blue Zone badge.
