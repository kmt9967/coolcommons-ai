import { NextRequest, NextResponse } from "next/server";
import { buildPrompt, parsePlanJson, Plan, PlanRequestSchema, rulesPlan } from "@/lib/planner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simple per-instance safeguards against uncontrolled usage.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 6;
const hits = new Map<string, number[]>();
const cache = new Map<string, { plan: Plan; at: number }>();
const CACHE_TTL_MS = 30 * 60_000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > RATE_MAX;
}

async function callGemini(system: string, user: string): Promise<{ text: string; model: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no-key");
  const models = [process.env.GEMINI_MODEL || "gemini-2.5-flash", "gemini-flash-latest"];
  let lastErr = "provider-error";
  for (const model of models) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: ctrl.signal,
      });
      if (res.status === 429) throw new Error("quota");
      if (res.status === 404) { lastErr = "model-404"; continue; }
      if (!res.ok) throw new Error(`provider-${res.status}`);
      const json = await res.json();
      const text = (json?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      return { text, model };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(lastErr);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return NextResponse.json({ error: "Too many requests — please wait a minute." }, { status: 429 });

  const raw = await req.text();
  if (raw.length > 6000) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = PlanRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  const key = JSON.stringify(parsed.data);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return NextResponse.json({ ...hit.plan, cached: true });

  const { system, user } = buildPrompt(parsed.data);
  let plan: Plan;
  try {
    const { text, model } = await callGemini(system, user);
    const out = parsePlanJson(text);
    if (!out) throw new Error("unparseable");
    plan = {
      mode: "ai",
      model,
      summary: out.summary,
      sections: out.sections,
      generatedAt: new Date().toISOString(),
      notice: `Generated live by Google ${model} (Gemini API, free tier) from the climate data and scenario shown. Review before use.`,
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "error";
    plan = rulesPlan(parsed.data);
    if (reason === "quota") plan.notice += " The free-tier AI quota is currently exhausted, so the rules-based engine was used.";
    else if (reason !== "no-key") plan.notice += " The AI provider was unavailable, so the rules-based engine was used.";
  }
  cache.set(key, { plan, at: Date.now() });
  if (cache.size > 500) cache.clear();
  return NextResponse.json(plan);
}

export async function GET() {
  return NextResponse.json({ aiConfigured: Boolean(process.env.GEMINI_API_KEY) });
}
