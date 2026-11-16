import { z } from "zod";

export const PlanRequestSchema = z.object({
  question: z.string().trim().min(10, "Please describe the planning question (at least 10 characters).").max(600),
  setting: z.enum(["outdoor-market", "bus-stop", "school", "informal-settlement", "worksite", "general"]),
  climate: z.object({
    label: z.string().max(120),
    apparentMaxC: z.number().min(-10).max(70),
    tempMaxC: z.number().min(-10).max(60),
    humidity: z.number().min(0).max(100),
    source: z.string().max(200),
  }),
  assessment: z
    .object({
      score: z.number().min(0).max(100),
      level: z.string().max(20),
      exposureHours: z.number().min(0).max(24),
      shade: z.enum(["none", "partial", "good"]),
      activity: z.enum(["light", "moderate", "heavy"]),
      waterWithin250m: z.boolean(),
    })
    .optional(),
  simulation: z
    .object({
      areaName: z.string().max(80),
      accessRadiusM: z.number().min(50).max(3000),
      baselinePct: z.number().min(0).max(100),
      afterPct: z.number().min(0).max(100),
      addedSites: z.number().int().min(0).max(50),
      existingSites: z.number().int().min(0).max(5000),
    })
    .optional(),
});
export type PlanRequest = z.infer<typeof PlanRequestSchema>;

export type PlanSection = { title: string; items: string[] };
export type Plan = {
  mode: "ai" | "rules";
  model?: string;
  summary: string;
  sections: PlanSection[];
  generatedAt: string;
  notice: string;
};

export const SECTION_TITLES = [
  "Climate evidence",
  "Potential exposure concerns",
  "Suggested low-cost interventions",
  "Accessibility considerations",
  "Resource requirements",
  "Implementation priorities",
  "Assumptions & uncertainties",
] as const;

const SETTING_LABEL: Record<PlanRequest["setting"], string> = {
  "outdoor-market": "busy outdoor market",
  "bus-stop": "public transport stop",
  school: "school and its surroundings",
  "informal-settlement": "dense residential neighbourhood with limited services",
  worksite: "outdoor worksite",
  general: "community area",
};

export function buildPrompt(req: PlanRequest): { system: string; user: string } {
  const system = [
    "You are CoolCommons AI, a climate-adaptation planning assistant for municipal teams and NGOs in Karachi, Pakistan.",
    "Produce practical, low-cost heat-resilience plans. Ground every statement in the CONTEXT provided.",
    "Rules: do not invent statistics, temperatures, populations, costs in currency, health outcomes or named partner organisations.",
    "Do not give medical diagnoses. Clearly mark assumptions. Refer to locations only as 'candidate sites for assessment'.",
    "Recommend checking WHO/NDMA/PDMA heat-health guidance and consulting local residents.",
    `Return ONLY valid JSON: {"summary": string, "sections": [{"title": string, "items": string[]}]} with exactly these section titles in order: ${SECTION_TITLES.join(" | ")}. 3-5 concise items per section.`,
  ].join("\n");
  const ctx: string[] = [
    `Setting: ${SETTING_LABEL[req.setting]}.`,
    `Climate reference (${req.climate.label}; source: ${req.climate.source}): daily max apparent temperature ${req.climate.apparentMaxC} °C, air temperature max ${req.climate.tempMaxC} °C, mean relative humidity ${req.climate.humidity}%.`,
  ];
  if (req.assessment) {
    const a = req.assessment;
    ctx.push(`Heat Exposure Index (transparent proxy, 0-100): ${a.score} (${a.level}). Assumptions: ${a.exposureHours} h outdoors, ${a.activity} activity, ${a.shade} shade, water within 250 m: ${a.waterWithin250m ? "yes" : "no"}.`);
  }
  if (req.simulation) {
    const s = req.simulation;
    ctx.push(`Access simulation for ${s.areaName}: ${s.existingSites} mapped OSM sites; area share within ${s.accessRadiusM} m straight-line of a site rises from ${s.baselinePct}% to ${s.afterPct}% with ${s.addedSites} hypothetical new sites. This is an area-based proxy, not population coverage.`);
  }
  return { system, user: `CONTEXT:\n${ctx.join("\n")}\n\nQUESTION: ${req.question}` };
}

/** Validates and normalises the model's JSON into a Plan shape. */
export function parsePlanJson(text: string): { summary: string; sections: PlanSection[] } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    const schema = z.object({
      summary: z.string().min(1).max(1500),
      sections: z.array(z.object({ title: z.string().max(80), items: z.array(z.string().max(600)).max(8) })).min(3).max(10),
    });
    const parsed = schema.safeParse(obj);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Deterministic, rules-based planning engine. Used when no AI provider key is
 * configured or the provider fails. Always labelled as rules-based in the UI.
 */
export function rulesPlan(req: PlanRequest): Plan {
  const at = req.climate.apparentMaxC;
  const hot = at >= 39;
  const veryHumid = req.climate.humidity >= 70;
  const a = req.assessment;
  const s = req.simulation;
  const where = SETTING_LABEL[req.setting];

  const evidence = [
    `${req.climate.label}: max apparent temperature ${at} °C (air ${req.climate.tempMaxC} °C) — ${hot ? "within the 'Danger' screening band (≥39 °C)" : at >= 32 ? "within the 'Extreme caution' band (32–39 °C)" : "below the 32 °C 'Extreme caution' band"}.`,
    `Mean relative humidity ${req.climate.humidity}%${veryHumid ? ": humid coastal air limits sweat evaporation, so 'feels-like' heat exceeds air temperature." : "."}`,
    `Source: ${req.climate.source}. Reanalysis grid values describe city-scale conditions, not street-level microclimate.`,
  ];
  if (s) evidence.push(`Access proxy for ${s.areaName}: ${s.baselinePct}% of the sampled area lies within ${s.accessRadiusM} m of a mapped candidate site.`);

  const concerns = [
    `Prolonged outdoor presence at the ${where} during peak afternoon hours.`,
    a ? `Heat Exposure Index ${a.score}/100 (${a.level}) under the stated assumptions (${a.exposureHours} h outdoors, ${a.activity} activity).` : "Exposure duration and activity level not yet assessed — run the assessment step.",
    a && a.shade !== "good" ? `Limited shade (${a.shade}) increases direct solar load.` : "Shade availability should be verified on site.",
    a && !a.waterWithin250m ? "No known drinking-water point within 250 m." : "Drinking-water availability should be verified on site.",
    "Groups likely to be more affected: outdoor workers and vendors, older adults, young children, pregnant people and people with chronic illness or disabilities (general WHO guidance, not a local ranking).",
  ];

  const interventions = [
    "Temporary shade structures (fabric canopies, shade nets) over waiting and trading areas; prioritise west/south-facing exposures.",
    "Free drinking-water points with clear signage, refilled from a safe source and checked daily during hot periods.",
    "Designate a nearby public building (library, community centre, school hall) as a candidate cooling space during heat alerts, subject to owner agreement and site assessment.",
    "Heat-awareness boards and loudspeaker or SMS messages in Urdu and Sindhi explaining warning signs and where to find water and shade.",
  ];
  if (req.setting === "outdoor-market" || req.setting === "worksite") interventions.push("Encourage schedule shifts: heavy loading and strenuous work before 11:00 and after 16:00 on 'Danger' band days.");
  if (req.setting === "school") interventions.push("Move outdoor assemblies and sports indoors or to early morning on high-heat days; ensure classroom ventilation.");
  if (s && s.addedSites > 0) interventions.push(`The simulator's ${s.addedSites} suggested site(s) raise the area access proxy from ${s.baselinePct}% to ${s.afterPct}% — treat them as candidate locations for field assessment.`);

  const access = [
    "Step-free routes and seating at shade and water points; seating with back-rests for older adults.",
    "Signage with pictograms plus Urdu text; audio announcements for people with limited literacy or vision.",
    "Separate or screened rest areas so women and girls can use cooling spaces comfortably.",
    "Opening hours that cover the hottest part of the day (approx. 12:00–17:00).",
  ];

  const resources = [
    "Shade materials, water containers/dispensers, cups or refill stations, printed signage.",
    "Volunteers or staff to refill water, monitor sites and guide people during heat alerts.",
    "Agreements with owners of candidate cooling spaces; basic first-aid kits and oral rehydration salts.",
    "Simple log sheet to record daily use, issues and feedback (no personal data needed).",
  ];

  const priorities = [
    hot ? "Immediate (before next hot season): water points and shade at the highest-footfall spots." : "Prepare before April: water points and shade at the highest-footfall spots.",
    "Short term: confirm candidate cooling spaces on site; agree activation triggers linked to official PMD/PDMA heat alerts.",
    "Medium term: tree planting and permanent shade where space allows; review usage logs and community feedback.",
    "Continuously: compare with forecast apparent temperature and adjust staffing on 'Danger' band days.",
  ];

  const assumptions = [
    "Climate values are reanalysis/forecast grid estimates for the city, not street-level measurements.",
    "Access proxy uses straight-line distance over evenly spaced sample points — not population, routes, capacity or opening hours.",
    "OpenStreetMap facility data may be incomplete or outdated; no facility is a verified cooling centre.",
    "Exposure index weights are prototype design choices that require calibration with local health and planning partners.",
  ];

  return {
    mode: "rules",
    summary: `Rules-based plan for a ${where} on a reference day with ${at} °C apparent temperature${a ? ` and a Heat Exposure Index of ${a.score}/100` : ""}. Focus first on water, shade and a clearly signposted cooling space, then validate on site with residents.`,
    sections: [
      { title: SECTION_TITLES[0], items: evidence },
      { title: SECTION_TITLES[1], items: concerns },
      { title: SECTION_TITLES[2], items: interventions },
      { title: SECTION_TITLES[3], items: access },
      { title: SECTION_TITLES[4], items: resources },
      { title: SECTION_TITLES[5], items: priorities },
      { title: SECTION_TITLES[6], items: assumptions },
    ],
    generatedAt: new Date().toISOString(),
    notice: "Generated by the transparent rules-based engine (no live AI model was called).",
  };
}
