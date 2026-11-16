import { NextRequest, NextResponse } from "next/server";
import { buildPrompt, parsePlanJson, Plan, PlanRequestSchema, rulesPlan } from "@/lib/planner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const models = [...new Set([process.env.GEMINI_MODEL || "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest"])];
  let lastErr = "provider-error";
  const started = Date.now();
  const attempts = models.flatMap((m) => [{ model: m, thinkingOff: true }]).concat(models.map((m) => ({ model: m, thinkingOff: false })));
  for (const { model, thinkingOff } of attempts) {
    if (Date.now() - started > 45_000) break;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1600, responseMimeType: "application/json", ...(thinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
        }),
        signal: ctrl.signal,
      });
      if (res.status === 429) { lastErr = "quota"; continue; }
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 300).replace(/AIza[0-9A-Za-z_-]+/g, "[redacted]");
        console.error(`gemini ${model} thinkingOff=${thinkingOff} status=${res.status}: ${detail}`);
        lastErr = `${model}:${res.status}`;
        if (res.status === 404 || res.status === 400 || res.status >= 500) continue;
        throw new Error(`provider-${res.status}`);
      }
      const json = await res.json();
      const text = (json?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      return { text, model };
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("provider-")) throw e;
      lastErr = `${model}:timeout`;
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
    plan.fallbackReason = reason;
    if (reason === "quota") plan.notice += " The free-tier AI quota is currently exhausted, so the rules-based engine was used.";
    else if (reason !== "no-key") plan.notice += " The AI provider was unavailable, so the rules-based engine was used.";
  }
  if (plan.mode === "ai" || !process.env.GEMINI_API_KEY) cache.set(key, { plan, at: Date.now() });
  if (cache.size > 500) cache.clear();
  return NextResponse.json(plan);
}

export async function GET() {
  return NextResponse.json({ aiConfigured: Boolean(process.env.GEMINI_API_KEY) });
}
