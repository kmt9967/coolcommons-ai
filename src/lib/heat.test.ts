import { describe, expect, it } from "vitest";
import { assessExposure, coverage, haversineM, heatBand, sampleGrid, suggestSites } from "./heat";
import summer from "../data/karachi-summer-2025.json";
import clim from "../data/karachi-climatology-2016-2025.json";

describe("heatBand", () => {
  it("maps apparent temperature to documented screening bands", () => {
    expect(heatBand(20).id).toBe("low");
    expect(heatBand(27).id).toBe("caution");
    expect(heatBand(35).id).toBe("extreme-caution");
    expect(heatBand(39).id).toBe("danger");
    expect(heatBand(52).id).toBe("extreme-danger");
  });
});

describe("assessExposure", () => {
  const base = { apparentMaxC: 43, relativeHumidity: 74, exposureHours: 6, activity: "heavy" as const, shade: "none" as const, waterWithin250m: false, coolingDistanceM: 1200 };
  it("follows the documented weights", () => {
    const a = assessExposure(base);
    const pts = Object.fromEntries(a.components.map((c) => [c.key, c.points]));
    expect(pts.temp).toBe(30); // (43-27)/24*45
    expect(pts.rh).toBe(3); // (74-50)/40*5
    expect(pts.dur).toBe(15);
    expect(pts.act).toBe(10);
    expect(pts.shade).toBe(10);
    expect(pts.water).toBe(5);
    expect(pts.cool).toBe(5);
    expect(a.score).toBe(78);
    expect(a.level).toBe("Very high");
  });
  it("drops when shade, water and cooling are provided", () => {
    const a = assessExposure({ ...base, shade: "good", waterWithin250m: true, coolingDistanceM: 150 });
    expect(a.score).toBe(58);
  });
  it("never exceeds 0–100", () => {
    expect(assessExposure({ ...base, apparentMaxC: 70, exposureHours: 20 }).score).toBeLessThanOrEqual(100);
    expect(assessExposure({ ...base, apparentMaxC: 10, exposureHours: 0, activity: "light", shade: "good", waterWithin250m: true, coolingDistanceM: 0, relativeHumidity: 20 }).score).toBe(0);
  });
  it("labels provenance for every component", () => {
    const a = assessExposure(base);
    expect(a.components.filter((c) => c.provenance === "data").map((c) => c.key)).toEqual(["temp", "rh"]);
  });
});

describe("geometry", () => {
  it("haversine distance is approximately correct", () => {
    // 0.01° latitude ≈ 1,112 m
    expect(Math.round(haversineM({ lat: 24.86, lon: 67 }, { lat: 24.87, lon: 67 }))).toBeGreaterThan(1100);
    expect(Math.round(haversineM({ lat: 24.86, lon: 67 }, { lat: 24.87, lon: 67 }))).toBeLessThan(1125);
  });
  it("coverage is 100% when a site sits at the centre of a small area", () => {
    const c = { lat: 24.86, lon: 67.0 };
    const pts = sampleGrid(c, 300, 50);
    const r = coverage(pts, [c], 400);
    expect(r.coveragePct).toBe(100);
  });
  it("coverage is 0% with no sites", () => {
    const pts = sampleGrid({ lat: 24.86, lon: 67.0 }, 500, 100);
    expect(coverage(pts, [], 400).coveragePct).toBe(0);
  });
  it("greedy suggestions increase coverage monotonically", () => {
    const c = { lat: 24.86, lon: 67.0 };
    const pts = sampleGrid(c, 1500, 100);
    const before = coverage(pts, [], 400).coveragePct;
    const s1 = suggestSites(pts, [], 400, 1);
    const s3 = suggestSites(pts, [], 400, 3);
    const a1 = coverage(pts, s1, 400).coveragePct;
    const a3 = coverage(pts, s3, 400).coveragePct;
    expect(a1).toBeGreaterThan(before);
    expect(a3).toBeGreaterThan(a1);
  });
});

describe("climate dataset", () => {
  it("contains a full Apr–Jun 2025 daily record with units in °C", () => {
    expect(summer.daily.length).toBe(91);
    expect(summer.period.start).toBe("2025-04-01");
    expect(summer.daily.every((d) => typeof d.atmax === "number")).toBe(true);
  });
  it("peak date is the highest apparent temperature day", () => {
    const max = Math.max(...summer.daily.map((d) => d.atmax as number));
    expect(summer.topDays[0].atmax).toBe(max);
    expect(summer.peakDate).toBe(summer.topDays[0].date);
  });
  it("has 12 months of climatology and 10 years of hot-day counts", () => {
    expect(clim.monthly.length).toBe(12);
    expect(clim.annualHotDays.length).toBe(10);
  });
});
