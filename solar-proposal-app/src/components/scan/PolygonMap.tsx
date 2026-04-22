"use client";

/**
 * Polygon drawing tool using Leaflet + OpenStreetMap.
 * Loaded client-side only via next/dynamic to avoid SSR issues with leaflet.
 */

import { useEffect, useRef, useState } from "react";
import { Trash2, CheckCircle } from "lucide-react";

export interface LatLng { lat: number; lng: number }

interface Props {
  onPolygonChange: (polygon: LatLng[]) => void;
}

export function PolygonMap({ onPolygonChange }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polygonLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [points, setPoints] = useState<LatLng[]>([]);
  const [searchAddr, setSearchAddr] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || mapRef.current) return;

    // Dynamically import leaflet CSS + lib
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    import("leaflet").then((L) => {
      if (!mapContainerRef.current || mapRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [20, 0],
        zoom: 3,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      map.on("click", (e: any) => {
        const newPt = { lat: e.latlng.lat, lng: e.latlng.lng };

        setPoints((prev) => {
          const updated = [...prev, newPt];
          updateMapOverlay(L, map, updated);
          return updated;
        });
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync polygon outward whenever points change
  useEffect(() => {
    onPolygonChange(points);
  }, [points, onPolygonChange]);

  function updateMapOverlay(L: any, map: any, pts: LatLng[]) {
    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Remove old polygon
    if (polygonLayerRef.current) {
      polygonLayerRef.current.remove();
      polygonLayerRef.current = null;
    }

    if (pts.length === 0) return;

    // Add vertex markers
    const icon = L.divIcon({
      className: "",
      html: `<div style="width:10px;height:10px;border-radius:50%;background:#f97316;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,.6)"></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });
    pts.forEach((p, i) => {
      const m = L.marker([p.lat, p.lng], { icon })
        .addTo(map)
        .bindTooltip(`Point ${i + 1}`, { permanent: false });
      markersRef.current.push(m);
    });

    // Draw polygon when ≥3 points
    if (pts.length >= 3) {
      polygonLayerRef.current = L.polygon(
        pts.map((p) => [p.lat, p.lng]),
        {
          color: "#f97316",
          fillColor: "#f97316",
          fillOpacity: 0.15,
          weight: 2,
          dashArray: "5 4",
        }
      ).addTo(map);
    } else {
      // Polyline while building
      polygonLayerRef.current = L.polyline(
        pts.map((p) => [p.lat, p.lng]),
        { color: "#f97316", weight: 2, dashArray: "5 4" }
      ).addTo(map);
    }
  }

  function clearPolygon() {
    setPoints([]);
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      updateMapOverlay(L, mapRef.current, []);
    });
  }

  function undoLast() {
    setPoints((prev) => {
      const updated = prev.slice(0, -1);
      if (!mapRef.current) return updated;
      import("leaflet").then((L) => updateMapOverlay(L, mapRef.current, updated));
      return updated;
    });
  }

  async function searchAddress() {
    if (!searchAddr.trim() || !mapRef.current) return;
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchAddr)}&format=json&limit=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": "SolarPropose/1.0" },
      });
      const data = await res.json();
      if (data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        mapRef.current.setView([lat, lng], 17);
      } else {
        alert("Address not found. Try a more specific location.");
      }
    } catch {
      alert("Search failed. Check your connection.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Address search */}
      <div className="flex gap-2">
        <input
          value={searchAddr}
          onChange={(e) => setSearchAddr(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchAddress()}
          placeholder="Search address to navigate map…"
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
        />
        <button
          onClick={searchAddress}
          disabled={searching}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors disabled:opacity-60"
        >
          {searching ? "…" : "Go"}
        </button>
      </div>

      {/* Map */}
      <div
        ref={mapContainerRef}
        className="w-full rounded-xl overflow-hidden border border-slate-700"
        style={{ height: 380 }}
      />

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {points.length === 0
            ? "Click on the map to place polygon vertices."
            : points.length < 3
            ? `${points.length} point${points.length > 1 ? "s" : ""} placed — need at least 3 to define an area.`
            : `${points.length} vertices · polygon ready`}
        </p>
        <div className="flex gap-2">
          <button
            onClick={undoLast}
            disabled={points.length === 0}
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg disabled:opacity-40 transition-colors"
          >
            Undo
          </button>
          <button
            onClick={clearPolygon}
            disabled={points.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg disabled:opacity-40 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        </div>
      </div>

      {points.length >= 3 && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          Area defined — click &quot;Start Scan&quot; to find all commercial buildings inside this polygon.
        </div>
      )}
    </div>
  );
}
