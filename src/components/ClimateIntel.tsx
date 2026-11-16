"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { climatology, summer2025 } from "@/lib/data";
import { heatBand } from "@/lib/heat";

type Forecast = { ok: boolean; source?: string; retrievedAt?: string; current?: { time: string; temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number }; daily?: { date: string; tmax: number; atmax: number; rh: number; precip: number }[]; error?: string };

const tt = { contentStyle: { background: "#0c1a2c", border: "1px solid #1d3552", borderRadius: 8, color: "#e6eef7" }, labelStyle: { color: "#8ba3bf" } };
const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function ClimateIntel({ selectedDay, onSelectDay }: { selectedDay: string; onSelectDay: (d: string) => void }) {
  const [fc, setFc] = useState<Forecast | null>(null);
  useEffect(() => {
    fetch("/api/forecast").then((r) => r.json()).then(setFc).catch(() => setFc({ ok: false, error: "Forecast request failed." }));
  }, []);

  const daily = summer2025.daily.map((d) => ({ ...d, label: fmtDate(d.date) }));
  const hourly = summer2025.hourly[selectedDay] ?? [];
  const sel = summer2025.daily.find((d) => d.date === selectedDay)!;
  const daysDanger = summer2025.daily.filter((d) => d.atmax >= 39).length;
  const daysExtremeCaution = summer2025.daily.filter((d) => d.atmax >= 32).length;
  const nights = summer2025.daily.filter((d) => d.atmin >= 30).length;
  const nov = climatology.monthly[10];
  const peakMonth = useMemo(() => climatology.monthly.reduce((a, b) => (b.atmax > a.atmax ? b : a)), []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { k: "Peak apparent temp, Apr–Jun 2025", v: `${summer2025.topDays[0].atmax} °C`, s: `${fmtDate(summer2025.peakDate)} · air ${summer2025.topDays[0].tmax} °C`, c: "text-rose-400" },
          { k: "Days in 'Danger' band (≥39 °C AT)", v: `${daysDanger} / 91`, s: `${daysExtremeCaution} days ≥32 °C ('Extreme caution')`, c: "text-amber-400" },
          { k: "Warm nights (min AT ≥30 °C)", v: `${nights}`, s: "Little overnight relief", c: "text-cyan-300" },
          { k: "Danger-band days per year", v: `${climatology.annualHotDays.at(-2)!.daysAtOrAbove} → ${climatology.annualHotDays.at(-1)!.daysAtOrAbove}`, s: "2024 → 2025 (vs. 4–16 in 2016–2023)", c: "text-teal-300" },
        ].map((x) => (
          <div key={x.k} className="card p-4">
            <div className="text-xs text-muted">{x.k}</div>
            <div className={`text-2xl md:text-3xl font-bold mt-1 ${x.c}`}>{x.v}</div>
            <div className="text-xs text-muted mt-1">{x.s}</div>
          </div>
        ))}
      </div>

      <div className="card p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-semibold">Karachi, 1 Apr – 30 Jun 2025: daily maximum temperature vs. apparent (“feels-like”) temperature</h3>
            <p className="text-xs text-muted">Click a point to inspect that day. Dashed lines: 32 °C and 39 °C screening thresholds.</p>
          </div>
          <span className="chip chip-data">Historical reanalysis · not live</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <ComposedChart data={daily} onClick={(e) => { const p = (e as unknown as { activePayload?: { payload: { date: string } }[] })?.activePayload?.[0]?.payload; if (p && summer2025.hourly[p.date]) onSelectDay(p.date); }}>
              <CartesianGrid stroke="#1d3552" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: "#8ba3bf", fontSize: 11 }} interval={13} />
              <YAxis unit="°C" domain={[20, 46]} tick={{ fill: "#8ba3bf", fontSize: 11 }} />
              <Tooltip {...tt} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={39} stroke="#f43f5e" strokeDasharray="5 5" />
              <ReferenceLine y={32} stroke="#fb923c" strokeDasharray="5 5" />
              <Area type="monotone" dataKey="atmax" name="Apparent temp max (°C)" stroke="#f59e0b" fill="#f59e0b33" strokeWidth={2} />
              <Line type="monotone" dataKey="tmax" name="Air temp max (°C)" stroke="#22d3ee" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="rh" name="Mean RH (%)" stroke="#64748b" dot={false} strokeWidth={1} hide />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="font-semibold">Hourly profile of a high-exposure day</h3>
            <select aria-label="Select high-exposure day" value={selectedDay} onChange={(e) => onSelectDay(e.target.value)} className="text-sm">
              {summer2025.topDays.map((d, i) => (
                <option key={d.date} value={d.date}>{fmtDate(d.date)} 2025 — AT {d.atmax} °C{i === 0 ? " (peak)" : ""}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted mb-2">
            {fmtDate(sel.date)}: air max {sel.tmax} °C, apparent max {sel.atmax} °C (<span style={{ color: heatBand(sel.atmax).color }}>{heatBand(sel.atmax).label}</span>), humidity {sel.rh}%, overnight apparent min {sel.atmin} °C.
          </p>
          <div className="h-60">
            <ResponsiveContainer>
              <LineChart data={hourly}>
                <CartesianGrid stroke="#1d3552" strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fill: "#8ba3bf", fontSize: 11 }} interval={3} />
                <YAxis unit="°C" domain={[24, 46]} tick={{ fill: "#8ba3bf", fontSize: 11 }} />
                <Tooltip {...tt} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={39} stroke="#f43f5e" strokeDasharray="5 5" />
                <Line dataKey="at" name="Apparent temp (°C)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line dataKey="temp" name="Air temp (°C)" stroke="#22d3ee" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4 md:p-5">
          <h3 className="font-semibold mb-1">Seasonal comparison — monthly mean of daily maxima, 2016–2025</h3>
          <p className="text-xs text-muted mb-2">Humid pre-monsoon months (May–Jun) feel hottest: apparent temperature peaks in {peakMonth.month} at {peakMonth.atmax} °C. November (now) averages {nov.atmax} °C.</p>
          <div className="h-60">
            <ResponsiveContainer>
              <ComposedChart data={climatology.monthly}>
                <CartesianGrid stroke="#1d3552" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: "#8ba3bf", fontSize: 11 }} />
                <YAxis unit="°C" domain={[15, 40]} tick={{ fill: "#8ba3bf", fontSize: 11 }} />
                <Tooltip {...tt} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="atmax" name="Apparent temp max (°C)" radius={[4, 4, 0, 0]}>
                  {climatology.monthly.map((m) => (<Cell key={m.month} fill={m.month === "Nov" ? "#2dd4bf" : heatBand(m.atmax).color} fillOpacity={0.75} />))}
                </Bar>
                <Line dataKey="tmax" name="Air temp max (°C)" stroke="#22d3ee" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-4 md:p-5">
          <h3 className="font-semibold mb-1">Days per year with apparent temperature ≥ {climatology.thresholdC} °C</h3>
          <p className="text-xs text-muted mb-2">Count of days in the reanalysis grid cell reaching the ‘Danger’ screening band. A short 10-year window — indicative, not a trend attribution.</p>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={climatology.annualHotDays}>
                <CartesianGrid stroke="#1d3552" strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fill: "#8ba3bf", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8ba3bf", fontSize: 11 }} />
                <Tooltip {...tt} />
                <Bar dataKey="daysAtOrAbove" name="Days ≥39 °C apparent" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="font-semibold">Current conditions & 7-day forecast</h3>
            <span className="chip chip-forecast">Live forecast · separate from history</span>
          </div>
          {!fc && <p className="text-sm text-muted animate-pulse">Loading forecast from Open-Meteo…</p>}
          {fc && !fc.ok && <p className="text-sm text-amber-300">{fc.error}</p>}
          {fc?.ok && fc.daily && (
            <>
              <p className="text-xs text-muted mb-3">
                Now ({fc.current?.time.replace("T", " ")} PKT): air {fc.current?.temperature_2m} °C, apparent {fc.current?.apparent_temperature} °C, RH {fc.current?.relative_humidity_2m}%. Retrieved {new Date(fc.retrievedAt!).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })} PKT.
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {fc.daily.map((d) => (
                  <div key={d.date} className="rounded-lg border border-line p-2 text-center bg-panel2">
                    <div className="text-[11px] text-muted">{fmtDate(d.date)}</div>
                    <div className="text-lg font-bold" style={{ color: heatBand(d.atmax).color }}>{Math.round(d.atmax)}°</div>
                    <div className="text-[10px] text-muted">air {Math.round(d.tmax)}°</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted mt-3">Values are apparent-temperature daily maxima. Source: {fc.source}.</p>
            </>
          )}
        </div>
      </div>

      <div className="card p-4 text-xs text-muted leading-relaxed">
        <strong className="text-slate-200">Data provenance.</strong> Historical values: {summer2025.meta.source}, {summer2025.meta.dataType}; grid cell centred {summer2025.meta.gridCell.latitude.toFixed(3)}°N, {summer2025.meta.gridCell.longitude.toFixed(3)}°E (elevation {summer2025.meta.gridCell.elevation} m); {summer2025.meta.resolutionNote}. Times in Asia/Karachi (PKT). Licence: {summer2025.meta.license}. Retrieved 16 Nov 2026 and cached in the repository so the app works if the API is unavailable.
        {" "}
        <a className="text-teal-300 underline" href={summer2025.meta.sourceUrl} target="_blank" rel="noreferrer">API documentation</a>.
      </div>
    </div>
  );
}
