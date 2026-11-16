import { NextResponse } from "next/server";

export const revalidate = 1800;

const URL_FORECAST =
  "https://api.open-meteo.com/v1/forecast?latitude=24.8607&longitude=67.0011&daily=temperature_2m_max,apparent_temperature_max,relative_humidity_2m_mean,precipitation_sum&current=temperature_2m,apparent_temperature,relative_humidity_2m&timezone=Asia%2FKarachi&forecast_days=7";

export async function GET() {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(URL_FORECAST, { signal: ctrl.signal, next: { revalidate: 1800 } });
      clearTimeout(t);
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      const d = j.daily;
      return NextResponse.json({
        ok: true,
        source: "Open-Meteo Forecast API (numerical weather prediction models)",
        sourceUrl: "https://open-meteo.com/en/docs",
        retrievedAt: new Date().toISOString(),
        current: j.current,
        daily: d.time.map((date: string, i: number) => ({
          date,
          tmax: d.temperature_2m_max[i],
          atmax: d.apparent_temperature_max[i],
          rh: d.relative_humidity_2m_mean[i],
          precip: d.precipitation_sum[i],
        })),
      });
    } catch {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return NextResponse.json({ ok: false, error: "Forecast service unavailable. Historical analysis remains available from the cached reanalysis dataset." }, { status: 503 });
}
