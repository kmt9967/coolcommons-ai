#!/usr/bin/env bash
# Fetch candidate community facilities in central Karachi from OpenStreetMap (ODbL) via Overpass API.
OUT=${1:-src/data/osm-raw.json}
Q='[out:json][timeout:90];(node["amenity"~"^(hospital|clinic|library|community_centre|drinking_water)$"](24.80,66.97,24.98,67.15);way["amenity"~"^(hospital|clinic|library|community_centre)$"](24.80,66.97,24.98,67.15);way["leisure"="park"]["name"](24.80,66.97,24.98,67.15););out center tags;'
for i in 1 2 3 4 5 6; do
  for url in https://overpass-api.de/api/interpreter https://overpass.kumi.systems/api/interpreter; do
    curl -s -m 100 -A "CoolCommonsAI-hackathon-prototype/0.1" --data-urlencode "data=$Q" "$url" -o "$OUT.tmp"
    if [ "$(head -c 1 "$OUT.tmp")" = "{" ]; then mv "$OUT.tmp" "$OUT"; echo "ok from $url"; exit 0; fi
  done
  sleep $((i*15))
done
echo "failed"; exit 1
