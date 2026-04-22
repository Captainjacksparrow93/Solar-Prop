"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "@/components/ui/Toaster";
import type { DetectedZone } from "@/app/api/solar/detect-zones/route";

interface Props {
  leadId: string;
  imageUrl: string;
  zones: DetectedZone[];
  totalAreaSqM: number;
  onConfirm: (
    selectedZones: DetectedZone[],
    panelCount: number,
    areaSqM: number
  ) => void;
}

const ZONE_COLORS = [
  "rgba(34, 197, 94, 0.4)", // green
  "rgba(59, 130, 246, 0.4)", // blue
  "rgba(249, 115, 22, 0.4)", // orange
  "rgba(168, 85, 247, 0.4)", // purple
  "rgba(236, 72, 153, 0.4)", // pink
  "rgba(14, 165, 233, 0.4)", // sky
];

const ZONE_BORDERS = [
  "2px solid rgb(34, 197, 94)",
  "2px solid rgb(59, 130, 246)",
  "2px solid rgb(249, 115, 22)",
  "2px solid rgb(168, 85, 247)",
  "2px solid rgb(236, 72, 153)",
  "2px solid rgb(14, 165, 233)",
];

export function ZoneSelector({
  leadId,
  imageUrl,
  zones: initialZones,
  totalAreaSqM: initialArea,
  onConfirm,
}: Props) {
  const [zones, setZones] = useState<DetectedZone[]>(initialZones);
  const [selectedZoneIds, setSelectedZoneIds] = useState<Set<string>>(
    new Set(initialZones.filter((z) => z.usable).map((z) => z.id))
  );
  const [totalAreaSqM, setTotalAreaSqM] = useState(initialArea);
  const [unitSqFeet, setUnitSqFeet] = useState(false);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  // Detect zones on mount
  useEffect(() => {
    const detectZones = async () => {
      if (!imageUrl) return;

      setLoading(true);
      try {
        const res = await fetch("/api/solar/detect-zones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl,
            leadId,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Zone detection failed");
        }

        const data = await res.json();
        setZones(data.zones);
        setSelectedZoneIds(
          new Set(
            data.zones
              .filter((z: DetectedZone) => z.usable)
              .map((z: DetectedZone) => z.id)
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Detection failed";
        toast(message, "error");
      } finally {
        setLoading(false);
      }
    };

    detectZones();
  }, [imageUrl]);

  // Draw zones on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      setImageSize({ width: img.width, height: img.height });

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Draw zones
      zones.forEach((zone, idx) => {
        const bbox = zone.boundingBox;
        const x = bbox.x * img.width;
        const y = bbox.y * img.height;
        const w = bbox.width * img.width;
        const h = bbox.height * img.height;

        const isSelected = selectedZoneIds.has(zone.id);

        // Fill
        ctx.fillStyle = ZONE_COLORS[idx % ZONE_COLORS.length];
        ctx.fillRect(x, y, w, h);

        // Border
        ctx.strokeStyle = ZONE_BORDERS[idx % ZONE_BORDERS.length];
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(x, y, w, h);

        // Label
        ctx.fillStyle = "#000";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        const labelY = y + h / 2;
        ctx.fillText(zone.label, x + w / 2, labelY - 8);
        ctx.fillText(
          `${zone.estimatedAreaSqM.toFixed(0)} sqm`,
          x + w / 2,
          labelY + 8
        );
      });
    };
    img.src = imageUrl;
  }, [zones, imageUrl, selectedZoneIds]);

  const handleZoneToggle = (zoneId: string) => {
    const newSelected = new Set(selectedZoneIds);
    if (newSelected.has(zoneId)) {
      newSelected.delete(zoneId);
    } else {
      newSelected.add(zoneId);
    }
    setSelectedZoneIds(newSelected);
  };

  const selectedZones = zones.filter((z) => selectedZoneIds.has(z.id));
  const estimatedTotalArea = selectedZones.reduce(
    (sum, z) => sum + z.estimatedAreaSqM,
    0
  ) || totalAreaSqM;

  // Panel calculation: 2 sqm per panel
  const panelCount = Math.max(
    1,
    Math.floor(
      (unitSqFeet ? totalAreaSqM / 10.764 : totalAreaSqM) / 2.0
    )
  );

  const handleConfirm = () => {
    if (selectedZones.length === 0) {
      toast("Select at least one zone", "error");
      return;
    }

    const areaSqM = unitSqFeet ? totalAreaSqM / 10.764 : totalAreaSqM;
    onConfirm(selectedZones, panelCount, areaSqM);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">
          Detected Roof Zones
        </h3>
        <p className="text-sm text-slate-400">
          Select usable zones and confirm total roof area
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-orange-400 animate-spin mr-2" />
          <span className="text-slate-300">Detecting zones...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Canvas with overlay */}
          <div
            ref={containerRef}
            className="rounded-xl overflow-hidden border border-slate-700 bg-slate-950"
          >
            <canvas
              ref={canvasRef}
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                maxHeight: "400px",
              }}
            />
          </div>

          {/* Area input */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Total Roof Area
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  value={totalAreaSqM}
                  onChange={(e) =>
                    setTotalAreaSqM(Math.max(0, parseFloat(e.target.value) || 0))
                  }
                  min="0"
                  step="100"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-400"
                />
              </div>
              <button
                onClick={() => setUnitSqFeet(!unitSqFeet)}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                {unitSqFeet ? "sq ft" : "sq m"}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Enter the total usable roof area. This helps estimate per-zone capacity.
            </p>
          </div>

          {/* Zone selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">
              Select Usable Zones
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-800/30 rounded-lg p-3">
              {zones.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  No zones detected
                </p>
              ) : (
                zones.map((zone, idx) => (
                  <label
                    key={zone.id}
                    className="flex items-center gap-3 p-2 hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedZoneIds.has(zone.id)}
                      onChange={() => handleZoneToggle(zone.id)}
                      className="w-4 h-4 accent-orange-400"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-200">
                        {zone.label}
                      </p>
                      <p className="text-xs text-slate-500">
                        ~{zone.estimatedAreaSqM.toFixed(0)} sqm
                        {!zone.usable && " (Shaded/Pitched - may not be ideal)"}
                      </p>
                    </div>
                    {selectedZoneIds.has(zone.id) && (
                      <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                    )}
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Panel count summary */}
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-400">
                Estimated solar panels that fit:
              </span>
              <span className="text-2xl font-bold text-orange-400">
                {panelCount}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Based on {selectedZones.length} selected zone(s) ·
              {unitSqFeet ? (totalAreaSqM / 10.764).toFixed(0) : totalAreaSqM.toFixed(0)} sqm
            </p>
          </div>

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={selectedZones.length === 0}
            className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            Confirm Selection & Update Layout
          </button>
        </>
      )}
    </div>
  );
}
