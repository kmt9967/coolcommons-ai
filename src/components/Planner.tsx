"use client";

import { useEffect, useState } from "react";
import type { Plan, PlanRequest } from "@/lib/planner";

const EXAMPLES: { q: string; setting: PlanRequest["setting"] }[] = [
  { q: "How can a community organization reduce heat exposure around a busy outdoor market?", setting: "outdoor-market" },
  { q: "What low-cost measures can protect commuters waiting at a crowded bus stop during a heatwave?", setting: "bus-stop" },
  { q: "How should a school prepare for very hot days at the end of the academic year?", setting: "school" },
];

export default function Planner({ context }: { context: Omit<PlanRequest, "question" | "setting"> }) {
  const [q, setQ] = useState(EXAMPLES[0].q);
  const [setting, setSetting] = useState<PlanRequest["setting"]>("outdoor-market");
  const [plan, setPlan] = useState<(Plan & { cached?: boolean }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/plan").then((r) => r.json()).then((j) => setAiConfigured(Boolean(j.aiConfigured))).catch(() => setAiConfigured(false));
  }, []);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...context, question: q, setting }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Request failed");
      setPlan(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 card p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Ask the planner</h3>
          {aiConfigured === null ? null : aiConfigured ? <span className="chip chip-data">Live AI: Google Gemini (server-side)</span> : <span className="chip chip-assumption">Rules engine (no AI key set)</span>}
        </div>
        <label className="text-xs text-muted" htmlFor="setting">Setting</label>
        <select id="setting" className="w-full text-sm" value={setting} onChange={(e) => setSetting(e.target.value as PlanRequest["setting"])}>
          <option value="outdoor-market">Busy outdoor market</option>
          <option value="bus-stop">Public transport stop</option>
          <option value="school">School</option>
          <option value="informal-settlement">Dense neighbourhood with limited services</option>
          <option value="worksite">Outdoor worksite</option>
          <option value="general">General community area</option>
        </select>
        <label className="text-xs text-muted" htmlFor="q">Planning question</label>
        <textarea id="q" rows={4} maxLength={600} className="w-full text-sm" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button key={e.q} className="text-[11px] rounded-full border border-line px-2 py-1 text-muted hover:text-white hover:border-teal" onClick={() => { setQ(e.q); setSetting(e.setting); }}>{e.q.slice(0, 42)}…</button>
          ))}
        </div>
        <div className="rounded-lg bg-panel2 border border-line p-3 text-[11px] text-muted space-y-1">
          <div className="text-slate-200 font-medium text-xs">Grounding context sent with your question</div>
          <div>• Climate: {context.climate.label} — AT {context.climate.apparentMaxC} °C, air {context.climate.tempMaxC} °C, RH {context.climate.humidity}%</div>
          {context.assessment && <div>• Exposure index: {context.assessment.score}/100 ({context.assessment.level}), {context.assessment.exposureHours} h, {context.assessment.activity}, shade {context.assessment.shade}</div>}
          {context.simulation && <div>• Simulator: {context.simulation.areaName}, cooling reach {context.simulation.baselinePct}% → {context.simulation.afterPct}% (+{context.simulation.addedSites} sites)</div>}
        </div>
        <button className="btn btn-primary w-full" disabled={loading} onClick={run}>{loading ? "Generating plan…" : "Generate adaptation plan"}</button>
        {err && <p className="text-sm text-rose-300">{err}</p>}
      </div>

      <div className="lg:col-span-3 card p-4 md:p-5 min-h-[300px]">
        {!plan && !loading && (
          <div className="h-full grid place-items-center text-center text-muted text-sm p-6">
            <div>
              <div className="text-4xl mb-2">🧭</div>
              Generate a structured plan grounded in the selected climate day, your exposure assessment and the simulator results.
            </div>
          </div>
        )}
        {loading && <div className="space-y-3 animate-pulse">{[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-panel2 rounded" style={{ width: `${90 - i * 8}%` }} />)}</div>}
        {plan && !loading && (
          <div className="fade-in space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {plan.mode === "ai" ? <span className="chip chip-data">AI-generated · {plan.model}</span> : <span className="chip chip-assumption">Rules-based output · no AI model called</span>}
              {plan.cached && <span className="chip chip-scenario">cached</span>}
              <span className="text-[11px] text-muted">{new Date(plan.generatedAt).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })} PKT</span>
            </div>
            <p className="text-sm leading-relaxed">{plan.summary}</p>
            <div className="grid md:grid-cols-2 gap-3">
              {plan.sections.map((s) => (
                <div key={s.title} className={`rounded-lg border border-line p-3 bg-panel2/50 ${s.title.startsWith("Assumptions") ? "md:col-span-2 border-amber/40" : ""}`}>
                  <h4 className="text-sm font-semibold text-teal-200 mb-1.5">{s.title}</h4>
                  <ul className="text-xs space-y-1.5 list-disc pl-4 text-slate-300">{s.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted border-t border-line pt-2">{plan.notice} Verify with local authorities (PMD, PDMA Sindh), WHO heat-health guidance and residents before implementation.</p>
          </div>
        )}
      </div>
    </div>
  );
}
