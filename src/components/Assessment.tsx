"use client";

import { Activity, assessExposure, Assessment as A, ShadeAccess } from "@/lib/heat";
import type { ClimateRef } from "@/lib/data";

export type AssessmentState = { refId: string; exposureHours: number; activity: Activity; shade: ShadeAccess; water: boolean; coolingM: number };

const chipFor = (p: string) => (p === "data" ? "chip chip-data" : p === "assumption" ? "chip chip-assumption" : "chip chip-scenario");
const provLabel = (p: string) => (p === "data" ? "Data" : p === "assumption" ? "Assumption" : "Scenario");

export default function Assessment({ refs, state, setState, simCoolingM }: { refs: ClimateRef[]; state: AssessmentState; setState: (s: AssessmentState) => void; simCoolingM?: number }) {
  const ref = refs.find((r) => r.id === state.refId) ?? refs[0];
  const result: A = assessExposure({ apparentMaxC: ref.apparentMaxC, relativeHumidity: ref.humidity, exposureHours: state.exposureHours, activity: state.activity, shade: state.shade, waterWithin250m: state.water, coolingDistanceM: state.coolingM });
  const set = (p: Partial<AssessmentState>) => setState({ ...state, ...p });
  const levelColor = result.level === "Very high" ? "#f43f5e" : result.level === "High" ? "#fb923c" : result.level === "Moderate" ? "#facc15" : "#2dd4bf";

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card p-4 md:p-5 space-y-4">
        <div>
          <label className="text-sm font-medium flex items-center gap-2" htmlFor="ref">Climate reference day <span className="chip chip-data">Data</span></label>
          <select id="ref" className="w-full mt-1 text-sm" value={state.refId} onChange={(e) => set({ refId: e.target.value })}>
            {refs.map((r) => <option key={r.id} value={r.id}>{r.label} — AT {r.apparentMaxC} °C, RH {r.humidity}%</option>)}
          </select>
          <p className="text-[11px] text-muted mt-1">Source: {ref.source}. Historical reference — not today’s conditions.</p>
        </div>
        <div>
          <div className="flex justify-between text-sm"><span className="flex items-center gap-2">Hours outdoors in hottest period <span className="chip chip-assumption">Assumption</span></span><span className="font-mono">{state.exposureHours} h</span></div>
          <input aria-label="Hours outdoors" type="range" min={0} max={10} step={0.5} value={state.exposureHours} onChange={(e) => set({ exposureHours: Number(e.target.value) })} className="w-full" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm flex items-center gap-2" htmlFor="act">Activity level <span className="chip chip-assumption">Assumption</span></label>
            <select id="act" className="w-full mt-1 text-sm" value={state.activity} onChange={(e) => set({ activity: e.target.value as Activity })}>
              <option value="light">Light (sitting, vending)</option><option value="moderate">Moderate (walking, trading)</option><option value="heavy">Heavy (loading, construction)</option>
            </select>
          </div>
          <div>
            <label className="text-sm flex items-center gap-2" htmlFor="shade">Shade access <span className="chip chip-assumption">Assumption</span></label>
            <select id="shade" className="w-full mt-1 text-sm" value={state.shade} onChange={(e) => set({ shade: e.target.value as ShadeAccess })}>
              <option value="none">None</option><option value="partial">Partial</option><option value="good">Good</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={state.water} onChange={(e) => set({ water: e.target.checked })} /> Drinking water within 250 m <span className="chip chip-assumption">Assumption</span></label>
        <div>
          <div className="flex justify-between text-sm"><span className="flex items-center gap-2">Distance to potential cooling space <span className="chip chip-scenario">Scenario</span></span><span className="font-mono">{state.coolingM} m</span></div>
          <input aria-label="Distance to cooling space" type="range" min={0} max={2000} step={50} value={state.coolingM} onChange={(e) => set({ coolingM: Number(e.target.value) })} className="w-full" />
          {simCoolingM !== undefined && (
            <button className="text-xs text-teal-300 underline" onClick={() => set({ coolingM: Math.min(2000, simCoolingM) })}>Use simulator value: {simCoolingM} m from study-area centre to nearest cooling-space candidate</button>
          )}
        </div>
      </div>

      <div className="card p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted">Heat Exposure Index (planning proxy)</div>
            <div className="text-5xl font-bold mt-1" style={{ color: levelColor }}>{result.score}<span className="text-xl text-muted">/100</span></div>
            <div className="font-semibold mt-1" style={{ color: levelColor }}>{result.level}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted">Apparent-temperature band</div>
            <div className="font-semibold" style={{ color: result.band.color }}>{result.band.label}</div>
            <div className="text-[11px] text-muted max-w-48">{result.band.note}</div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {result.components.map((c) => (
            <div key={c.key}>
              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-2">{c.label} <span className={chipFor(c.provenance)}>{provLabel(c.provenance)}</span></span>
                <span className="font-mono">{c.points}/{c.max}</span>
              </div>
              <div className="h-1.5 bg-panel2 rounded mt-1 overflow-hidden"><div className="h-full rounded" style={{ width: `${(c.points / c.max) * 100}%`, background: levelColor }} /></div>
              <div className="text-[11px] text-muted mt-0.5">{c.explanation}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted mt-4 border-t border-line pt-3">A transparent weighted index for comparing planning scenarios. It is not a medical assessment, a health-risk prediction or a validated vulnerability ranking. Weights are documented in Methodology and should be calibrated with local partners.</p>
      </div>
    </div>
  );
}
