"""Process raw Open-Meteo archive JSON into compact app datasets.
Usage: python scripts/process_climate.py <summer2025.json> <decade.json> <out_dir>
Source: Open-Meteo Historical Weather API (ERA5/ERA5-Land reanalysis based), CC BY 4.0.
"""
import json, sys, statistics as st
from collections import defaultdict
summer, decade, out = sys.argv[1], sys.argv[2], sys.argv[3]
s = json.load(open(summer, encoding="utf-8")); d = json.load(open(decade, encoding="utf-8"))
dl = s["daily"]
days = [dict(date=dl["time"][i], tmax=dl["temperature_2m_max"][i], tmin=dl["temperature_2m_min"][i],
             atmax=dl["apparent_temperature_max"][i], atmin=dl["apparent_temperature_min"][i],
             rh=dl["relative_humidity_2m_mean"][i], precip=dl["precipitation_sum"][i]) for i in range(len(dl["time"]))]
top = sorted([x for x in days if x["atmax"] is not None], key=lambda x: -x["atmax"])[:5]
peak = top[0]["date"]
h = s["hourly"]
hourly = {}
for t in sorted({x["date"] for x in top}):
    hourly[t] = [dict(time=h["time"][i][11:16], temp=h["temperature_2m"][i], rh=h["relative_humidity_2m"][i], at=h["apparent_temperature"][i])
                 for i in range(len(h["time"])) if h["time"][i].startswith(t)]
meta = dict(source="Open-Meteo Historical Weather API (reanalysis: ERA5 / ERA5-Land, ECMWF Copernicus)",
            sourceUrl="https://open-meteo.com/en/docs/historical-weather-api", license="CC BY 4.0 (Open-Meteo); contains modified Copernicus Climate Change Service information",
            requested=dict(latitude=24.8607, longitude=67.0011), gridCell=dict(latitude=s["latitude"], longitude=s["longitude"], elevation=s["elevation"]),
            timezone=s["timezone"], dataType="reanalysis (modelled, not station observations)", resolutionNote="~9-25 km grid cell; city-scale, not neighbourhood-scale")
json.dump(dict(meta=meta, period=dict(start=days[0]["date"], end=days[-1]["date"]), daily=days, topDays=top, peakDate=peak, hourly=hourly),
          open(f"{out}/karachi-summer-2025.json", "w"), indent=1)
dd = d["daily"]; bym = defaultdict(lambda: defaultdict(list)); hot = defaultdict(int); n = defaultdict(int)
for i, t in enumerate(dd["time"]):
    y, m = int(t[:4]), int(t[5:7]); tm, at, rh = dd["temperature_2m_max"][i], dd["apparent_temperature_max"][i], dd["relative_humidity_2m_mean"][i]
    if tm is None: continue
    bym[m]["tmax"].append(tm); bym[m]["atmax"].append(at); bym[m]["rh"].append(rh); n[y] += 1
    if at >= 39: hot[y] += 1
months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
clim = [dict(month=months[m-1], tmax=round(st.mean(bym[m]["tmax"]),1), atmax=round(st.mean(bym[m]["atmax"]),1), rh=round(st.mean(bym[m]["rh"]),1)) for m in range(1,13)]
years = [dict(year=y, daysAtOrAbove=hot[y], daysCounted=n[y]) for y in sorted(n)]
json.dump(dict(meta=dict(meta, period=f'{dd["time"][0]} to {dd["time"][-1]}'), monthly=clim, annualHotDays=years, thresholdC=39),
          open(f"{out}/karachi-climatology-2016-2025.json", "w"), indent=1)
print("peak", peak, top); print(clim); print(years)
