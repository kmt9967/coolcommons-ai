"""Convert raw Overpass JSON into compact facility list. Data (c) OpenStreetMap contributors, ODbL 1.0."""
import json, sys
raw = json.load(open(sys.argv[1], encoding="utf-8")); out = []
CAT = {"hospital": "health", "clinic": "health", "library": "public", "community_centre": "public", "drinking_water": "water", "park": "park"}
for e in raw["elements"]:
    t = e.get("tags", {}); kind = t.get("amenity") or t.get("leisure")
    if kind not in CAT: continue
    lat = e.get("lat") or e.get("center", {}).get("lat"); lon = e.get("lon") or e.get("center", {}).get("lon")
    if lat is None: continue
    name = t.get("name:en") or t.get("name") or ""
    if not name and kind != "drinking_water": continue
    out.append(dict(id=f'{e["type"]}/{e["id"]}', name=name or "Drinking water (unnamed)", kind=kind, category=CAT[kind], lat=round(lat, 6), lon=round(lon, 6)))
json.dump(dict(source="OpenStreetMap contributors via Overpass API", license="ODbL 1.0", retrieved=sys.argv[3], bbox=[24.80, 66.97, 24.98, 67.15], facilities=out), open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False)
from collections import Counter; print(len(out), Counter(f["kind"] for f in out))
