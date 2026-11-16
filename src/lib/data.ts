import summer from "@/data/karachi-summer-2025.json";
import clim from "@/data/karachi-climatology-2016-2025.json";

export type DailyRecord = { date: string; tmax: number; tmin: number; atmax: number; atmin: number; rh: number; precip: number };
export type HourlyRecord = { time: string; temp: number; rh: number; at: number };

export const summer2025 = summer as unknown as {
  meta: { source: string; sourceUrl: string; license: string; dataType: string; resolutionNote: string; gridCell: { latitude: number; longitude: number; elevation: number }; timezone: string };
  period: { start: string; end: string };
  daily: DailyRecord[];
  topDays: DailyRecord[];
  peakDate: string;
  hourly: Record<string, HourlyRecord[]>;
};

export const climatology = clim as unknown as {
  meta: { period: string; source: string };
  monthly: { month: string; tmax: number; atmax: number; rh: number }[];
  annualHotDays: { year: number; daysAtOrAbove: number; daysCounted: number }[];
  thresholdC: number;
};

export type ClimateRef = {
  id: string;
  label: string;
  apparentMaxC: number;
  tempMaxC: number;
  humidity: number;
  provenance: "data" | "forecast";
  source: string;
};

export function climateRefs(): ClimateRef[] {
  const src = "Open-Meteo Historical Weather API (ERA5 reanalysis)";
  const refs: ClimateRef[] = summer2025.topDays.map((d, i) => ({
    id: d.date,
    label: `${new Date(d.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${i === 0 ? " — peak 2025 day" : ""}`,
    apparentMaxC: d.atmax,
    tempMaxC: d.tmax,
    humidity: d.rh,
    provenance: "data",
    source: src,
  }));
  const jun = climatology.monthly[5];
  refs.push({ id: "jun-avg", label: "Average June day (2016–2025)", apparentMaxC: jun.atmax, tempMaxC: jun.tmax, humidity: jun.rh, provenance: "data", source: src + ", 10-year mean" });
  return refs;
}

export type Facility = { id: string; name: string; kind: string; category: "health" | "public" | "water" | "park"; lat: number; lon: number };

export const CATEGORY_META: Record<Facility["category"], { label: string; color: string; assess: string }> = {
  public: { label: "Public building (library / community centre)", color: "#22d3ee", assess: "Potential cooling space — for assessment" },
  park: { label: "Park / green space", color: "#4ade80", assess: "Potential shaded rest area — for assessment" },
  water: { label: "Mapped drinking water", color: "#60a5fa", assess: "Mapped water point — verify on site" },
  health: { label: "Health facility (hospital / clinic)", color: "#f472b6", assess: "Health facility — referral point, not a cooling centre" },
};

export const STUDY_AREAS = [
  { id: "saddar", name: "Saddar (central Karachi)", lat: 24.856, lon: 67.026 },
  { id: "lyari", name: "Lyari", lat: 24.866, lon: 67.0 },
  { id: "clifton", name: "Clifton (coastal)", lat: 24.817, lon: 67.03 },
  { id: "gulshan", name: "Gulshan-e-Iqbal", lat: 24.921, lon: 67.093 },
  { id: "korangi", name: "Korangi", lat: 24.835, lon: 67.125 },
];
