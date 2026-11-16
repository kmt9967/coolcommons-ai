"use client";

import { useCallback, useMemo, useState } from "react";
import ClimateIntel from "./ClimateIntel";
import Simulator, { SimulationSummary } from "./Simulator";
import Assessment, { AssessmentState } from "./Assessment";
import Planner from "./Planner";
import { climateRefs, summer2025 } from "@/lib/data";
import { assessExposure } from "@/lib/heat";

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "climate", label: "Climate Intelligence" },
  { id: "map", label: "Community Map" },
  { id: "assess", label: "Assessment" },
  { id: "planner", label: "AI Planner" },
  { id: "method", label: "Impact & Method" },
  { id: "team", label: "Team" },
];

function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section id={id} className="max-w-7xl mx-auto px-4 md:px-6 py-14 md:py-20">
      <div className="text-xs font-mono uppercase tracking-[0.2em] text-teal-300">{eyebrow}</div>
      <h2 className="text-2xl md:text-4xl font-bold mt-2">{title}</h2>
      <p className="text-muted mt-3 max-w-3xl">{intro}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function App() {
  const refs = useMemo(() => climateRefs(), []);
  const [selectedDay, setSelectedDay] = useState(summer2025.peakDate);
  const [assess, setAssess] = useState<AssessmentState>({ refId: summer2025.peakDate, exposureHours: 6, activity: "moderate", shade: "partial", water: false, coolingM: 900 });
  const [sim, setSim] = useState<SimulationSummary | undefined>();
  const [menu, setMenu] = useState(false);
  const onSummary = useCallback((s: SimulationSummary) => setSim(s), []);

  const ref = refs.find((r) => r.id === assess.refId) ?? refs[0];
  const result = assessExposure({ apparentMaxC: ref.apparentMaxC, relativeHumidity: ref.humidity, exposureHours: assess.exposureHours, activity: assess.activity, shade: assess.shade, waterWithin250m: assess.water, coolingDistanceM: assess.coolingM });

  const plannerContext = {
    climate: { label: ref.label, apparentMaxC: ref.apparentMaxC, tempMaxC: ref.tempMaxC, humidity: ref.humidity, source: ref.source },
    assessment: { score: result.score, level: result.level, exposureHours: assess.exposureHours, shade: assess.shade, activity: assess.activity, waterWithin250m: assess.water },
    simulation: sim ? { areaName: sim.areaName, accessRadiusM: sim.accessRadiusM, baselinePct: sim.baselinePct, afterPct: sim.afterPct, addedSites: sim.addedSites, existingSites: sim.existingSites } : undefined,
  };

  return (
    <div>
      <a href="#climate" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[2000] btn btn-primary">Skip to content</a>
      <header className="sticky top-0 z-[1000] backdrop-blur bg-ink/80 border-b border-line">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <a href="#overview" className="flex items-center gap-2 font-bold">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal to-cyan grid place-items-center text-ink text-sm">❄</span>
            CoolCommons <span className="text-teal-300">AI</span>
          </a>
          <nav aria-label="Main" className="hidden lg:flex gap-1 text-sm">
            {NAV.map((n) => <a key={n.id} href={`#${n.id}`} className="px-3 py-1.5 rounded-md text-muted hover:text-white hover:bg-panel2">{n.label}</a>)}
          </nav>
          <button className="lg:hidden btn btn-ghost text-xs" aria-expanded={menu} aria-controls="mobile-nav" onClick={() => setMenu(!menu)}>Menu</button>
        </div>
        {menu && (
          <nav id="mobile-nav" aria-label="Mobile" className="lg:hidden border-t border-line px-4 py-2 grid grid-cols-2 gap-1 text-sm">
            {NAV.map((n) => <a key={n.id} href={`#${n.id}`} onClick={() => setMenu(false)} className="px-3 py-2 rounded-md text-muted hover:text-white hover:bg-panel2">{n.label}</a>)}
          </nav>
        )}
      </header>

      <main>
        <section id="overview" className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(60% 60% at 75% 20%, rgba(245,158,11,.18), transparent 60%), radial-gradient(50% 60% at 15% 80%, rgba(45,212,191,.16), transparent 60%)" }} />
          <div className="relative max-w-7xl mx-auto px-4 md:px-6 pt-16 md:pt-24 pb-16 grid lg:grid-cols-2 gap-10 items-center">
            <div className="fade-in">
              <div className="chip chip-data mb-4">ATOX AI for Climate · Youth Climate Hackathon at COP31 · Team Teqprotech</div>
              <h1 className="text-4xl md:text-6xl font-bold leading-[1.05]">Turning climate data into <span className="bg-gradient-to-r from-teal to-amber bg-clip-text text-transparent">cooler, safer communities.</span></h1>
              <p className="text-lg text-muted mt-5 max-w-xl">CoolCommons AI helps municipal teams, NGOs and community planners in Karachi understand heat exposure and compare low-cost interventions — cooling spaces, shade, drinking water and heat information — using real climate data, open maps and transparent AI.</p>
              <div className="flex flex-wrap gap-3 mt-7">
                <a href="#map" className="btn btn-primary">Try the intervention simulator</a>
                <a href="#planner" className="btn btn-ghost">Generate an adaptation plan</a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 fade-in">
              {[
                { n: "1", t: "Evidence", d: "Real ERA5 reanalysis for Karachi: the hottest ‘feels-like’ days of 2025 and a 10-year seasonal baseline.", c: "from-amber/30" },
                { n: "2", t: "Map", d: "1,950 OpenStreetMap facilities, labelled honestly as potential sites for assessment.", c: "from-cyan/30" },
                { n: "3", t: "Simulate", d: "Place shade, water and cooling spaces; an optimisation algorithm suggests where reach improves most.", c: "from-teal/30" },
                { n: "4", t: "Plan", d: "AI-assisted plans grounded in the selected data, with assumptions and uncertainties stated.", c: "from-rose/30" },
              ].map((x) => (
                <div key={x.n} className={`card p-4 bg-gradient-to-br ${x.c} to-transparent`}>
                  <div className="text-xs font-mono text-muted">0{x.n}</div>
                  <div className="font-semibold mt-1">{x.t}</div>
                  <div className="text-xs text-muted mt-1 leading-relaxed">{x.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Section id="climate" eyebrow="01 · Climate intelligence" title="What Karachi’s heat looked like in 2025" intro="Karachi’s humid coastal air means the temperature people feel can be several degrees above the thermometer. The record below is historical reanalysis for April–June 2025 — the latest full pre-monsoon season — kept separate from the live forecast for today.">
          <ClimateIntel selectedDay={selectedDay} onSelectDay={(d) => { setSelectedDay(d); setAssess((a) => ({ ...a, refId: d })); }} />
        </Section>

        <Section id="map" eyebrow="02 · Community map & simulator" title="Where could people find water, shade and a cool place?" intro="Choose a study area, explore mapped community facilities and test hypothetical interventions. Coverage is a transparent, area-based access proxy — the share of the study area within a chosen distance of a site — so different strategies can be compared side by side.">
          <Simulator onSummary={onSummary} />
        </Section>

        <Section id="assess" eyebrow="03 · Heat resilience assessment" title="An explainable exposure check for a community setting" intro="Combine a real high-heat reference day with your assumptions about how people use a place. Every point in the score is traceable to data, an assumption or a scenario setting.">
          <Assessment refs={refs} state={assess} setState={setAssess} simCoolingM={sim?.coolingNearestCenterM} />
        </Section>

        <Section id="planner" eyebrow="04 · AI adaptation planner" title="From evidence to an actionable, low-cost plan" intro="Ask a planning question. The planner receives the selected climate data, your assessment and simulator results, and returns a structured plan with interventions, accessibility, resources, priorities, and explicit assumptions.">
          <Planner context={plannerContext} />
        </Section>

        <Section id="method" eyebrow="05 · Impact & methodology" title="How CoolCommons AI supports climate adaptation" intro="Heat is one of the deadliest climate hazards and is rising with warming. Local organisations often lack an accessible way to turn climate data into decisions about where scarce resources should go. CoolCommons AI is a decision-support prototype for that gap.">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              ["Climate adaptation", "Moves from awareness of heat to concrete, comparable actions communities can take before the next hot season."],
              ["Heat resilience", "Focuses on no-regret, low-cost measures — water, shade, cooling spaces, information — recommended in public heat-health guidance."],
              ["Better resource allocation", "The simulator and greedy optimiser show where a limited number of new sites would extend reach the most."],
              ["Accessible planning", "Plain-language outputs, accessibility considerations and a mobile-friendly interface for non-specialists."],
              ["Evidence-informed local action", "Every number is traceable: reanalysis data, OSM records, and documented formulas with provenance chips."],
              ["Honest AI", "AI outputs are grounded in supplied context and labelled. Without an AI key, a rules engine is used and clearly marked."],
            ].map(([t, d]) => (
              <div key={t} className="card p-4"><div className="font-semibold text-teal-200">{t}</div><p className="text-sm text-muted mt-1">{d}</p></div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mt-8">
            <div className="card p-5 text-sm space-y-2">
              <h3 className="font-semibold text-base">Methodology</h3>
              <p><b>Climate data.</b> Open-Meteo Historical Weather API (ERA5/ERA5-Land reanalysis, ECMWF Copernicus), grid cell near 24.85°N 66.99°E, hourly and daily: temperature_2m, apparent_temperature, relative_humidity_2m, precipitation. Forecast panel: Open-Meteo Forecast API.</p>
              <p><b>Heat bands.</b> Screening thresholds of 27/32/39/51 °C adapted from US NWS heat-index categories, applied to apparent temperature as an indicative scale.</p>
              <p><b>Heat Exposure Index (0–100).</b> Apparent temperature up to 45 pts (linear 27→51 °C); humidity up to 5 (50→90%); exposure 2.5 pts/hour up to 8 h; activity 0/5/10; shade 0/5/10; no water within 250 m 5; distance to cooling space up to 5 (200→1,200 m).</p>
              <p><b>Access proxy.</b> Sample points every 100 m within a 1.5 km study circle; coverage = share within the editable straight-line radius of at least one site. Suggestions use greedy maximal-coverage location allocation.</p>
              <p><b>AI.</b> Server-side Google Gemini Flash models (Gemini API free tier: 2.5 Flash, falling back to Flash-Lite when overloaded); input validation, rate limits, 45 s timeout, 1,600-token cap, JSON-schema validation and caching. Otherwise a deterministic rules engine.</p>
            </div>
            <div className="card p-5 text-sm space-y-2 border-amber/40">
              <h3 className="font-semibold text-base text-amber-300">Limitations & future validation</h3>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li>Reanalysis grid (~9–25 km) describes city-scale conditions; it cannot resolve neighbourhood or street microclimates, and the coastal grid cell may understate inland heat.</li>
                <li>OpenStreetMap data can be incomplete or outdated. No site is a verified cooling centre; suitability, opening hours, capacity and owner consent are unknown.</li>
                <li>The access proxy uses straight-line distance and evenly spaced points — not population, walking routes, barriers or safety.</li>
                <li>Index weights are prototype design choices, not validated against health outcomes. No medical or mortality predictions are made.</li>
                <li>AI output can be wrong; it must be reviewed by people with local knowledge.</li>
                <li><b>Next validation step:</b> co-design with a Karachi NGO or municipal team; add ward-level population and land-surface-temperature (Landsat) layers; field-check candidate sites; calibrate weights against local heat-health guidance (PDMA Sindh / NDMA heatwave plans).</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section id="team" eyebrow="06 · About the team" title="Team Teqprotech" intro="Built for the ATOX AI for Climate · Youth Climate Hackathon at COP31 (Team ID E10).">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {["Khawaja Muhammad Talal", "Aqeela Urooj", "Umer Anis", "Aliya Yousuf"].map((n) => (
              <div key={n} className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal/50 to-amber/40 grid place-items-center font-bold">{n.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>
                <div className="font-medium">{n}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-6">Open source: <a className="text-teal-300 underline" href="https://github.com/kmt9967/coolcommons-ai" target="_blank" rel="noreferrer">github.com/kmt9967/coolcommons-ai</a>. Data: Open-Meteo (CC BY 4.0, ERA5 © ECMWF/Copernicus), © OpenStreetMap contributors (ODbL), basemap © Esri.</p>
        </Section>
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">CoolCommons AI — a climate-adaptation decision-support prototype. Not an emergency service. In an emergency in Pakistan call 1122 (Rescue) or 115 (Edhi).</footer>
    </div>
  );
}
