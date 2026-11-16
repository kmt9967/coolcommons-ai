/**
 * CoolCommons AI — transparent heat-exposure and access calculations.
 *
 * Everything here is deterministic and documented so that judges, planners and
 * reviewers can recompute every number. None of these values is a medical
 * diagnosis, a validated vulnerability ranking, or a predicted health outcome.
 */

export type HeatBand = {
  id: "low" | "caution" | "extreme-caution" | "danger" | "extreme-danger";
  label: string;
  min: number; // inclusive lower bound, °C apparent temperature
  color: string;
  note: string;
};

/**
 * Screening bands adapted from the US National Weather Service heat-index
 * categories (27 / 32 / 39 / 51 °C). Open-Meteo's apparent temperature is a
 * different (Steadman-type) formulation, so these are used only as an
 * indicative screening scale, not an official warning level.
 */
export const HEAT_BANDS: HeatBand[] = [
  { id: "low", label: "Lower concern", min: -Infinity, color: "#2dd4bf", note: "Below 27 °C apparent temperature." },
  { id: "caution", label: "Caution", min: 27, color: "#facc15", note: "Fatigue possible with prolonged exposure and activity." },
  { id: "extreme-caution", label: "Extreme caution", min: 32, color: "#fb923c", note: "Heat cramps and exhaustion possible with prolonged exposure." },
  { id: "danger", label: "Danger", min: 39, color: "#f43f5e", note: "Heat exhaustion likely with prolonged exposure; heat stroke possible." },
  { id: "extreme-danger", label: "Extreme danger", min: 51, color: "#c026d3", note: "Heat stroke highly likely with continued exposure." },
];

export function heatBand(apparentC: number): HeatBand {
  let band = HEAT_BANDS[0];
  for (const b of HEAT_BANDS) if (apparentC >= b.min) band = b;
  return band;
}

export type ShadeAccess = "none" | "partial" | "good";
export type Activity = "light" | "moderate" | "heavy";

export type AssessmentInput = {
  apparentMaxC: number; // from reanalysis / forecast (data)
  relativeHumidity: number; // % (data)
  exposureHours: number; // hours outdoors in the hottest part of the day (assumption)
  activity: Activity; // assumption
  shade: ShadeAccess; // assumption
  waterWithin250m: boolean; // assumption
  coolingDistanceM: number; // distance to nearest potential cooling space (assumption or simulator)
};

export type ScoreComponent = {
  key: string;
  label: string;
  points: number;
  max: number;
  provenance: "data" | "assumption" | "scenario";
  explanation: string;
};

export type Assessment = {
  score: number; // 0–100 Heat Exposure Index (proxy)
  level: "Low" | "Moderate" | "High" | "Very high";
  band: HeatBand;
  components: ScoreComponent[];
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Heat Exposure Index (0–100). Weights are explicit design choices for a
 * planning prototype and are intended to be calibrated with local partners:
 *  - Apparent temperature: up to 45 pts, linear from 27 °C (0) to 51 °C (45)
 *  - Humidity: up to 5 pts, linear from 50% (0) to 90% (5) — limits sweat cooling
 *  - Exposure duration: up to 20 pts, 2.5 pts per hour, capped at 8 h
 *  - Activity: light 0, moderate 5, heavy 10
 *  - Shade: good 0, partial 5, none 10
 *  - Drinking water within 250 m: yes 0, no 5
 *  - Distance to potential cooling space: up to 5 pts, linear 200 m (0) to 1,200 m (5)
 */
export function assessExposure(input: AssessmentInput): Assessment {
  const at = input.apparentMaxC;
  const tempPts = clamp(((at - 27) / (51 - 27)) * 45, 0, 45);
  const rhPts = clamp(((input.relativeHumidity - 50) / 40) * 5, 0, 5);
  const durPts = clamp(input.exposureHours, 0, 8) * 2.5;
  const actPts = { light: 0, moderate: 5, heavy: 10 }[input.activity];
  const shadePts = { good: 0, partial: 5, none: 10 }[input.shade];
  const waterPts = input.waterWithin250m ? 0 : 5;
  const coolPts = clamp(((input.coolingDistanceM - 200) / 1000) * 5, 0, 5);

  const components: ScoreComponent[] = [
    { key: "temp", label: "Apparent temperature", points: round1(tempPts), max: 45, provenance: "data", explanation: `${round1(at)} °C daily max apparent temperature (reanalysis/forecast).` },
    { key: "rh", label: "Humidity", points: round1(rhPts), max: 5, provenance: "data", explanation: `${Math.round(input.relativeHumidity)}% mean relative humidity reduces evaporative cooling.` },
    { key: "dur", label: "Exposure duration", points: round1(durPts), max: 20, provenance: "assumption", explanation: `${input.exposureHours} h outdoors during hottest hours (user assumption).` },
    { key: "act", label: "Physical activity", points: actPts, max: 10, provenance: "assumption", explanation: `${input.activity} activity level (user assumption).` },
    { key: "shade", label: "Shade access", points: shadePts, max: 10, provenance: "assumption", explanation: `${input.shade} shade available (user assumption).` },
    { key: "water", label: "Drinking-water access", points: waterPts, max: 5, provenance: "assumption", explanation: input.waterWithin250m ? "Water point within 250 m (user assumption)." : "No known water point within 250 m (user assumption)." },
    { key: "cool", label: "Distance to cooling space", points: round1(coolPts), max: 5, provenance: "scenario", explanation: `${Math.round(input.coolingDistanceM)} m to nearest potential cooling space (scenario).` },
  ];
  const score = Math.round(components.reduce((s, c) => s + c.points, 0));
  const level = score >= 70 ? "Very high" : score >= 50 ? "High" : score >= 30 ? "Moderate" : "Low";
  return { score, level, band: heatBand(at), components };
}

/* ------------------------------------------------------------------ */
/* Geographic access proxy used by the intervention simulator          */
/* ------------------------------------------------------------------ */

export type LatLon = { lat: number; lon: number };

export function haversineM(a: LatLon, b: LatLon): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Regular sample grid (spacing in metres) inside a circular study area. */
export function sampleGrid(center: LatLon, radiusM: number, spacingM: number): LatLon[] {
  const pts: LatLon[] = [];
  const dLat = spacingM / 111320;
  const dLon = spacingM / (111320 * Math.cos((center.lat * Math.PI) / 180));
  const n = Math.ceil(radiusM / spacingM);
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const p = { lat: center.lat + i * dLat, lon: center.lon + j * dLon };
      if (haversineM(center, p) <= radiusM) pts.push(p);
    }
  }
  return pts;
}

export type CoverageResult = {
  samplePoints: number;
  coveredPoints: number;
  coveragePct: number; // share of sampled area within the access radius
  meanNearestM: number; // mean straight-line distance to nearest site
  maxNearestM: number; // worst-served sample point
};

/**
 * Area-based access proxy: share of evenly spaced sample points within a
 * straight-line access radius of at least one site. This is NOT population
 * coverage and ignores walking routes, barriers, opening hours and capacity.
 */
export function coverage(points: LatLon[], sites: LatLon[], accessRadiusM: number): CoverageResult {
  if (points.length === 0) return { samplePoints: 0, coveredPoints: 0, coveragePct: 0, meanNearestM: 0, maxNearestM: 0 };
  let covered = 0;
  let sum = 0;
  let max = 0;
  for (const p of points) {
    let best = Infinity;
    for (const s of sites) {
      const d = haversineM(p, s);
      if (d < best) best = d;
    }
    if (best <= accessRadiusM) covered++;
    const capped = Number.isFinite(best) ? best : 5000;
    sum += capped;
    if (capped > max) max = capped;
  }
  return {
    samplePoints: points.length,
    coveredPoints: covered,
    coveragePct: round1((covered / points.length) * 100),
    meanNearestM: Math.round(sum / points.length),
    maxNearestM: Math.round(max),
  };
}

/**
 * Greedy maximal-coverage placement: repeatedly adds the candidate location
 * (drawn from the sample grid) that covers the most currently-uncovered
 * points. A classic, explainable location-allocation heuristic.
 */
export function suggestSites(points: LatLon[], existing: LatLon[], accessRadiusM: number, count: number): LatLon[] {
  const uncovered = new Set<number>();
  points.forEach((p, i) => {
    if (!existing.some((s) => haversineM(p, s) <= accessRadiusM)) uncovered.add(i);
  });
  const chosen: LatLon[] = [];
  const candidates = points.filter((_, i) => i % 2 === 0);
  for (let k = 0; k < count && uncovered.size > 0; k++) {
    let bestIdx = -1;
    let bestGain = 0;
    let bestSet: number[] = [];
    candidates.forEach((c, ci) => {
      const gained: number[] = [];
      uncovered.forEach((ui) => {
        if (haversineM(c, points[ui]) <= accessRadiusM) gained.push(ui);
      });
      if (gained.length > bestGain) {
        bestGain = gained.length;
        bestIdx = ci;
        bestSet = gained;
      }
    });
    if (bestIdx < 0) break;
    chosen.push(candidates[bestIdx]);
    bestSet.forEach((i) => uncovered.delete(i));
  }
  return chosen;
}
