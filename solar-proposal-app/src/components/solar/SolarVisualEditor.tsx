"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Layers, RotateCcw, Save, Loader2, ZoomIn, ZoomOut, Info } from "lucide-react";
import { toast } from "@/components/ui/Toaster";

interface Props {
  leadId: string;
  lat: number;
  lng: number;
  panelCount: number;
  initialLayout: unknown;
  uploadedImageUrl?: string;
}

interface Panel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  selected: boolean;
}

const PANEL_W = 36;
const PANEL_H = 20;
const MAP_ZOOM = 20;

function getSatelliteUrl(lat: number, lng: number, zoom: number) {
  return `/api/satellite?lat=${lat}&lng=${lng}&zoom=${zoom}`;
}

function generatePanelGrid(count: number, canvasW: number, canvasH: number): Panel[] {
  const panels: Panel[] = [];
  const cols = Math.ceil(Math.sqrt(count * 2));
  const startX = canvasW * 0.15;
  const startY = canvasH * 0.2;
  const gapX = PANEL_W + 4;
  const gapH = PANEL_H + 4;

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    panels.push({
      id: `panel-${i}`,
      x: startX + col * gapX,
      y: startY + row * gapH,
      width: PANEL_W,
      height: PANEL_H,
      rotation: 0,
      selected: false,
    });
  }
  return panels;
}

export function SolarVisualEditor({ leadId, lat, lng, panelCount, initialLayout, uploadedImageUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<{ panelId: string; offsetX: number; offsetY: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const apiKey = ""; // no longer needed — satellite images served via /api/satellite

  // Canvas size
  const CANVAS_W = 640;
  const CANVAS_H = 400;

  // Initialize panels
  useEffect(() => {
    if (initialLayout && Array.isArray(initialLayout)) {
      setPanels(initialLayout as Panel[]);
    } else {
      setPanels(generatePanelGrid(panelCount, CANVAS_W, CANVAS_H));
    }
  }, [panelCount, initialLayout]);

  // Load image (uploaded or satellite)
  useEffect(() => {
    setImageLoading(true);
    setImageError(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setBgImage(img);
      setImageLoading(false);
    };
    img.onerror = () => {
      setImageError(true);
      setImageLoading(false);
    };

    // Use uploaded image if available, otherwise fall back to satellite image
    if (uploadedImageUrl) {
      img.src = uploadedImageUrl;
    } else {
      img.src = getSatelliteUrl(lat, lng, MAP_ZOOM);
    }
  }, [uploadedImageUrl, lat, lng, apiKey]);

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Background
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, CANVAS_W, CANVAS_H);
    } else {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#475569";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        imageError ? "Satellite image unavailable (check API key)" : "Loading satellite image...",
        CANVAS_W / 2,
        CANVAS_H / 2
      );
    }

    // Draw panels
    panels.forEach((panel) => {
      ctx.save();
      ctx.translate(panel.x + panel.width / 2, panel.y + panel.height / 2);
      ctx.rotate((panel.rotation * Math.PI) / 180);

      // Panel body
      ctx.fillStyle = panel.id === selectedId
        ? "rgba(251, 146, 60, 0.85)"   // orange when selected
        : "rgba(30, 58, 138, 0.82)";   // dark blue
      ctx.strokeStyle = panel.id === selectedId ? "#fb923c" : "#3b82f6";
      ctx.lineWidth = 1.5;

      const rx = -panel.width / 2;
      const ry = -panel.height / 2;

      ctx.beginPath();
      ctx.roundRect(rx, ry, panel.width, panel.height, 2);
      ctx.fill();
      ctx.stroke();

      // Grid lines (simulate cells)
      ctx.strokeStyle = panel.id === selectedId
        ? "rgba(251,146,60,0.5)"
        : "rgba(59,130,246,0.4)";
      ctx.lineWidth = 0.5;
      const cols = 4;
      const rows = 2;
      for (let c = 1; c < cols; c++) {
        const lx = rx + (panel.width / cols) * c;
        ctx.beginPath();
        ctx.moveTo(lx, ry);
        ctx.lineTo(lx, ry + panel.height);
        ctx.stroke();
      }
      for (let r = 1; r < rows; r++) {
        const ly = ry + (panel.height / rows) * r;
        ctx.beginPath();
        ctx.moveTo(rx, ly);
        ctx.lineTo(rx + panel.width, ly);
        ctx.stroke();
      }

      ctx.restore();
    });

    // Panel count label
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(8, 8, 120, 26);
    ctx.fillStyle = "#fb923c";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${panels.length} solar panels`, 14, 25);
  }, [panels, bgImage, imageError, selectedId]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse events for drag
  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function hitTest(pos: { x: number; y: number }): Panel | null {
    // Iterate in reverse so top panels get priority
    for (let i = panels.length - 1; i >= 0; i--) {
      const p = panels[i];
      if (
        pos.x >= p.x &&
        pos.x <= p.x + p.width &&
        pos.y >= p.y &&
        pos.y <= p.y + p.height
      ) {
        return p;
      }
    }
    return null;
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getCanvasPos(e);
    const hit = hitTest(pos);
    if (hit) {
      setSelectedId(hit.id);
      setDragging({ panelId: hit.id, offsetX: pos.x - hit.x, offsetY: pos.y - hit.y });
    } else {
      setSelectedId(null);
    }
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragging) return;
    const pos = getCanvasPos(e);
    setPanels((prev) =>
      prev.map((p) =>
        p.id === dragging.panelId
          ? { ...p, x: pos.x - dragging.offsetX, y: pos.y - dragging.offsetY }
          : p
      )
    );
  }

  function onMouseUp() {
    setDragging(null);
  }

  function resetLayout() {
    setPanels(generatePanelGrid(panelCount, CANVAS_W, CANVAS_H));
    setSelectedId(null);
  }

  function addPanel() {
    const id = `panel-${Date.now()}`;
    setPanels((prev) => [
      ...prev,
      { id, x: 50, y: 50, width: PANEL_W, height: PANEL_H, rotation: 0, selected: false },
    ]);
  }

  function removeSelected() {
    if (!selectedId) return;
    setPanels((prev) => prev.filter((p) => p.id !== selectedId));
    setSelectedId(null);
  }

  function rotateSelected() {
    if (!selectedId) return;
    setPanels((prev) =>
      prev.map((p) =>
        p.id === selectedId ? { ...p, rotation: (p.rotation + 90) % 360 } : p
      )
    );
  }

  async function saveLayout() {
    setSaving(true);
    try {
      const res = await fetch(`/api/solar/layout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, layout: panels }),
      });
      if (res.ok) {
        toast("Layout saved!", "success");
      } else {
        toast("Failed to save layout", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-orange-400" />
          <h2 className="text-lg font-semibold text-white">Solar Panel Layout Editor</h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={addPanel} className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
            + Add Panel
          </button>
          {selectedId && (
            <>
              <button onClick={rotateSelected} className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
                Rotate 90°
              </button>
              <button onClick={removeSelected} className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                Remove
              </button>
            </>
          )}
          <button onClick={resetLayout} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button onClick={() => setZoom((z) => Math.min(z + 0.25, 2))} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={saveLayout}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg transition-colors font-medium"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Layout
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
        <Info className="w-3.5 h-3.5 shrink-0" />
        Click a panel to select it. Drag to reposition. Use controls to rotate, remove, or add panels.
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="overflow-auto rounded-xl border border-slate-700 bg-slate-950"
      >
        {imageLoading && (
          <div className="flex items-center justify-center h-[400px]">
            <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
            <span className="ml-2 text-slate-400 text-sm">Loading satellite imagery...</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{
            display: imageLoading ? "none" : "block",
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            cursor: dragging ? "grabbing" : "grab",
            width: "100%",
            maxWidth: CANVAS_W,
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
      </div>

      <p className="mt-3 text-xs text-slate-500 text-right">
        {panels.length} panels placed
        {selectedId ? " · 1 selected" : ""}
      </p>
    </div>
  );
}
