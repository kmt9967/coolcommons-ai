"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORY_META, Facility, STUDY_AREAS } from "@/lib/data";
import { coverage, CoverageResult, haversineM, LatLon, sampleGrid, suggestSites } from "@/lib/heat";
import type { PlacedSite } from "./MapCanvas";

const MapCanvas = dynamic(() => import("./MapCanvas"), { ssr: false, loading: () => <div className="h-full w-full grid place-items-center text-muted text-sm animate-pulse">Loading map…</div> });

export type InterventionType = { id: "water" | "shade" | "cooling" | "info"; label: string; color: string; existing: Facility["category"][]; defaultRadius: number };
export const INTERVENTIONS: InterventionType[] = [
  { id: "water", label: "Drinking-water point", color: "#60a5fa", existing: ["water"], defaultRadius: 250 },
  { id: "shade", label: "Shaded rest area", color: "#4ade80", existing: ["park"], defaultRadius: 300 },
  { id: "cooling", label: "Community cooling space", color: "#22d3ee", existing: ["public"], defaultRadius: 600 },
  { id: "info", label: "Heat-information station", color: "#f59e0b", existing: [], defaultRadius: 400 },
];

export type SimulationSummary = { areaName: string; accessRadiusM: number; baselinePct: number; afterPct: number; addedSites: number; existingSites: number; coolingNearestCenterM: number };

const STUDY_RADIUS = 1500;
const SPACING = 100;

export default function Simulator({ onSummary }: { onSummary: (s: SimulationSummary) => void }) {
  const [facilities, setFacilities] = useState<Facility[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [area, setArea] = useState(STUDY_AREAS[0]);
  const [center, setCenter] = useState<LatLon>({ lat: STUDY_AREAS[0].lat, lon: STUDY_AREAS[0].lon });
  const [visible, setVisible] = useState(new Set<string>(["public", "park", "water", "health"]));
  const [placeType, setPlaceType] = useState<InterventionType["id"]>("cooling");
  const [mode, setMode] = useState<"place" | "move">("place");
  const [radii, setRadii] = useState<Record<string, number>>(Object.fromEntries(INTERVENTIONS.map((t) => [t.id, t.defaultRadius])));
  const [placed, setPlaced] = useState<PlacedSite[]>([]);
  const [suggestN, setSuggestN] = useState(3);
  const [gridType, setGridType] = useState<InterventionType["id"]>("cooling");

  useEffect(() => {
    fetch("/data/facilities.json").then((r) => r.json()).then((j) => setFacilities(j.facilities)).catch(() => setLoadErr(true));
  }, []);

  const points = useMemo(() => sampleGrid(center, STUDY_RADIUS, SPACING), [center]);
  const inArea = useMemo(() => (facilities ?? []).filter((f) => haversineM(center, f) <= STUDY_RADIUS + 800), [facilities, center]);

  const results = useMemo(() => {
    const out: Record<string, { before: CoverageResult; after: CoverageResult; existing: number; added: number }> = {};
    for (const t of INTERVENTIONS) {
      const existing = inArea.filter((f) => t.existing.includes(f.category));
      const added = placed.filter((p) => p.type === t.id);
      out[t.id] = { before: coverage(points, existing, radii[t.id]), after: coverage(points, [...existing, ...added], radii[t.id]), existing: existing.length, added: added.length };
    }
    return out;
  }, [inArea, placed, points, radii]);

  const grid = useMemo(() => {
    const t = INTERVENTIONS.find((x) => x.id === gridType)!;
    const sites: LatLon[] = [...inArea.filter((f) => t.existing.includes(f.category)), ...placed.filter((p) => p.type === t.id)];
    return points.map((p) => ({ ...p, covered: sites.some((s) => haversineM(p, s) <= radii[t.id]) }));
  }, [gridType, inArea, placed, points, radii]);

  useEffect(() => {
    const r = results.cooling;
    const coolSites: LatLon[] = [...inArea.filter((f) => f.category === "public"), ...placed.filter((p) => p.type === "cooling")];
    const nearest = coolSites.length ? Math.min(...coolSites.map((s) => haversineM(center, s))) : 3000;
    onSummary({ areaName: area.name, accessRadiusM: radii.cooling, baselinePct: r.before.coveragePct, afterPct: r.after.coveragePct, addedSites: r.added, existingSites: r.existing, coolingNearestCenterM: Math.round(nearest) });
  }, [results, area.name, radii.cooling, inArea, placed, center, onSummary]);

  const addSite = (p: LatLon, type = placeType, suggested = false) => {
    const t = INTERVENTIONS.find((x) => x.id === type)!;
    setPlaced((arr) => [...arr, { ...p, id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, color: t.color, label: t.label, suggested }]);
  };

  const onMapClick = (p: LatLon) => {
    if (mode === "move") {
      setCenter(p);
      setArea({ id: "custom", name: `Custom area (${p.lat.toFixed(3)}, ${p.lon.toFixed(3)})`, lat: p.lat, lon: p.lon });
      setPlaced([]);
    } else if (haversineM(center, p) <= STUDY_RADIUS) addSite(p);
  };

  const autoSuggest = () => {
    const t = INTERVENTIONS.find((x) => x.id === placeType)!;
    const existing: LatLon[] = [...inArea.filter((f) => t.existing.includes(f.category)), ...placed.filter((p) => p.type === t.id)];
    suggestSites(points, existing, radii[t.id], suggestN).forEach((s) => addSite(s, t.id, true));
  };

  const chart = INTERVENTIONS.map((t) => ({ name: t.label.replace("Community ", "").replace("Heat-information", "Info"), Before: results[t.id].before.coveragePct, After: results[t.id].after.coveragePct }));

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-3">
        <div className="card p-3 flex flex-wrap gap-2 items-center">
          <label className="text-xs text-muted" htmlFor="area">Study area</label>
          <select id="area" className="text-sm" value={area.id} onChange={(e) => { const a = STUDY_AREAS.find((x) => x.id === e.target.value); if (a) { setArea(a); setCenter({ lat: a.lat, lon: a.lon }); setPlaced([]); } }}>
            {STUDY_AREAS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            {area.id === "custom" && <option value="custom">{area.name}</option>}
          </select>
          <div className="flex rounded-lg border border-line overflow-hidden text-xs" role="group" aria-label="Map click mode">
            <button className={`px-3 py-1.5 ${mode === "place" ? "bg-teal text-ink font-semibold" : "text-muted"}`} onClick={() => setMode("place")}>Click to place</button>
            <button className={`px-3 py-1.5 ${mode === "move" ? "bg-teal text-ink font-semibold" : "text-muted"}`} onClick={() => setMode("move")}>Click to move area</button>
          </div>
          <span className="text-xs text-muted">{facilities ? `${inArea.length} mapped facilities nearby` : loadErr ? "Facility data failed to load" : "Loading facilities…"}</span>
        </div>
        <div className="h-[420px] md:h-[520px] card p-1 relative">
          <MapCanvas center={center} radiusM={STUDY_RADIUS} facilities={inArea} visibleCats={visible} placed={placed} grid={grid} onMapClick={onMapClick} onRemove={(id) => setPlaced((a) => a.filter((p) => p.id !== id))} />
        </div>
        <div className="card p-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
          {(Object.keys(CATEGORY_META) as Facility["category"][]).map((c) => (
            <label key={c} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={visible.has(c)} onChange={() => setVisible((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; })} />
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_META[c].color }} />
              {CATEGORY_META[c].label}
            </label>
          ))}
          <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-teal/60" /> sample point within reach</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-amber" /> sample point beyond reach</span>
        </div>
        <p className="text-[11px] text-muted">Facilities: © OpenStreetMap contributors (ODbL), retrieved 16 Nov 2026 via Overpass API. No facility is a verified cooling centre; markers show <em>potential facilities for assessment</em>. Weather data is city-scale, so the map shows access, not neighbourhood temperature.</p>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Add hypothetical interventions</h3><span className="chip chip-scenario">Scenario</span></div>
          <div className="grid grid-cols-2 gap-2">
            {INTERVENTIONS.map((t) => (
              <button key={t.id} onClick={() => { setPlaceType(t.id); setGridType(t.id); setMode("place"); }} className={`text-left rounded-lg border p-2 text-xs transition ${placeType === t.id ? "border-teal bg-teal/10" : "border-line"}`}>
                <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: t.color }} />
                {t.label}
                <div className="text-muted mt-0.5">{results[t.id].added} added · {results[t.id].existing} mapped</div>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button className="btn btn-primary" onClick={autoSuggest}>Suggest best {suggestN} sites</button>
            <input type="number" aria-label="Number of sites to suggest" min={1} max={10} value={suggestN} onChange={(e) => setSuggestN(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className="w-16" />
            <button className="btn btn-ghost" onClick={() => setPlaced([])}>Reset</button>
          </div>
          <p className="text-[11px] text-muted">Click inside the dashed circle to place a {INTERVENTIONS.find((t) => t.id === placeType)!.label.toLowerCase()}, or let the greedy maximal-coverage algorithm suggest locations that reach the most currently unserved sample points.</p>
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Access radius assumptions</h3><span className="chip chip-assumption">Editable</span></div>
          {INTERVENTIONS.map((t) => (
            <div key={t.id} className="text-xs">
              <div className="flex justify-between"><span>{t.label}</span><span className="font-mono">{radii[t.id]} m</span></div>
              <input aria-label={`${t.label} access radius`} type="range" min={100} max={1200} step={50} value={radii[t.id]} onChange={(e) => setRadii((r) => ({ ...r, [t.id]: Number(e.target.value) }))} className="w-full" />
            </div>
          ))}
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-1"><h3 className="font-semibold">Before vs. after: area within reach</h3></div>
          <p className="text-[11px] text-muted mb-2">% of {points.length} evenly spaced sample points (every {SPACING} m within {STUDY_RADIUS / 1000} km) within straight-line reach of at least one site.</p>
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={chart} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke="#1d3552" strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: "#8ba3bf", fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={92} tick={{ fill: "#cfe0f2", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#0c1a2c", border: "1px solid #1d3552", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Before" fill="#475569" radius={[0, 4, 4, 0]} />
                <Bar dataKey="After" fill="#2dd4bf" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="w-full text-xs mt-2">
            <thead className="text-muted"><tr><th className="text-left font-normal">Type</th><th className="font-normal">Reach</th><th className="font-normal">Mean dist.</th><th className="font-normal">Worst</th></tr></thead>
            <tbody>
              {INTERVENTIONS.map((t) => { const r = results[t.id]; return (
                <tr key={t.id} className={`border-t border-line cursor-pointer ${gridType === t.id ? "text-teal-200" : ""}`} onClick={() => setGridType(t.id)}>
                  <td className="py-1">{t.label}</td>
                  <td className="text-center">{r.before.coveragePct}% → <b>{r.after.coveragePct}%</b></td>
                  <td className="text-center">{r.before.meanNearestM >= 5000 ? "—" : `${r.before.meanNearestM}`} → {r.after.meanNearestM >= 5000 ? "—" : r.after.meanNearestM} m</td>
                  <td className="text-center">{r.after.maxNearestM >= 5000 ? "—" : `${r.after.maxNearestM} m`}</td>
                </tr>); })}
            </tbody>
          </table>
          <p className="text-[11px] text-muted mt-2">Map dots show reach for the highlighted row. These are planning proxies only: they do not estimate temperature reduction, people served, or health outcomes.</p>
        </div>
      </div>
    </div>
  );
}
