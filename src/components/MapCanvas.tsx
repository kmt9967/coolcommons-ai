"use client";

import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { useEffect } from "react";
import { CATEGORY_META, Facility } from "@/lib/data";
import type { LatLon } from "@/lib/heat";

export type PlacedSite = LatLon & { id: string; type: string; color: string; label: string; suggested?: boolean };
export type GridPoint = LatLon & { covered: boolean };

function ClickHandler({ onClick }: { onClick: (p: LatLon) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lon: e.latlng.lng }) });
  return null;
}
function Recenter({ center }: { center: LatLon }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([center.lat, center.lon], 14, { duration: 0.8 });
  }, [center.lat, center.lon, map]);
  return null;
}

export default function MapCanvas({
  center,
  radiusM,
  facilities,
  visibleCats,
  placed,
  grid,
  onMapClick,
  onRemove,
}: {
  center: LatLon;
  radiusM: number;
  facilities: Facility[];
  visibleCats: Set<string>;
  placed: PlacedSite[];
  grid: GridPoint[];
  onMapClick: (p: LatLon) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <MapContainer center={[center.lat, center.lon]} zoom={14} preferCanvas className="h-full w-full rounded-xl" scrollWheelZoom={false}>
      <TileLayer
        attribution='Basemap &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors | Facilities &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (ODbL)'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}" maxZoom={16} />
      <Recenter center={center} />
      <ClickHandler onClick={onMapClick} />
      <Circle center={[center.lat, center.lon]} radius={radiusM} pathOptions={{ color: "#2dd4bf", weight: 1.5, dashArray: "6 6", fillOpacity: 0.03 }} />
      {grid.map((g, i) => (
        <CircleMarker key={i} center={[g.lat, g.lon]} radius={2} pathOptions={{ stroke: false, fillColor: g.covered ? "#2dd4bf" : "#f59e0b", fillOpacity: g.covered ? 0.35 : 0.55 }} />
      ))}
      {facilities
        .filter((f) => visibleCats.has(f.category))
        .map((f) => (
          <CircleMarker key={f.id} center={[f.lat, f.lon]} radius={5} pathOptions={{ color: "#06101d", weight: 1, fillColor: CATEGORY_META[f.category].color, fillOpacity: 0.95 }}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{f.name}</div>
                <div className="text-xs opacity-80">{CATEGORY_META[f.category].label}</div>
                <div className="text-xs mt-1 text-amber-300">{CATEGORY_META[f.category].assess}</div>
                <div className="text-[10px] mt-1 opacity-60">OSM {f.id}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      {placed.map((p) => (
        <CircleMarker key={p.id} center={[p.lat, p.lon]} radius={9} pathOptions={{ color: "#fff", weight: 2, dashArray: p.suggested ? "3 3" : undefined, fillColor: p.color, fillOpacity: 0.9 }} eventHandlers={{ contextmenu: () => onRemove(p.id) }}>
          <Tooltip>{p.label}{p.suggested ? " (algorithm-suggested)" : " (user-placed)"} — hypothetical</Tooltip>
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">Hypothetical {p.label}</div>
              <div className="text-xs opacity-80">{p.suggested ? "Suggested by greedy max-coverage placement" : "Placed by user"}</div>
              <button className="mt-2 text-xs underline text-rose-300" onClick={() => onRemove(p.id)}>Remove</button>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
