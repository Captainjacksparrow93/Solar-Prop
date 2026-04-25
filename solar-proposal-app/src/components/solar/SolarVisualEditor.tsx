"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Layers, RotateCcw, Save, Loader2, ZoomIn, ZoomOut,
  Plus, Minus, Info, Sun, Zap, Home,
} from "lucide-react";
import { toast } from "@/components/ui/Toaster";

// ─── Geo/panel maths (mirrors visual-builder.ts) ─────────────────────────────

const MAP_ZOOM    = 19;
const TILE_SIZE   = 256;
const CANVAS_W    = 640;
const CANVAS_H    = 400;
const HEADER_H    = 55;
const FOOTER_H    = 32;
const PANEL_W_M   = 2.0;
const PANEL_H_M   = 1.0;
const PANEL_GAP_M = 0.20;
const VIS_SCALE   = 1.4;

function mppAt(lat: number, zoom: number) {
  return (156543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}
function latLngToTileFloat(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return { x, y };
}
function panelPx(lat: number) {
  const scale = mppAt(lat, MAP_ZOOM);
  return {
    pW:   Math.max(12, Math.round((PANEL_W_M   * VIS_SCALE) / scale)),
    pH:   Math.max(7,  Math.round((PANEL_H_M   * VIS_SCALE) / scale)),
    gapX: Math.max(2,  Math.round((PANEL_GAP_M * VIS_SCALE) / scale)),
  };
}
function ptInPoly(px: number, py: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const { x: xi, y: yi } = poly[i];
    const { x: xj, y: yj } = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Project lat/lng building outline onto canvas pixels. Returns null when unusable. */
function projectOsm(
  cLat: number, cLng: number,
  geom: { lat: number; lng: number }[],
): { x: number; y: number }[] | null {
  if (!geom || geom.length < 3) return null;
  const ct = latLngToTileFloat(cLat, cLng, MAP_ZOOM);
  const pts = geom.map(p => {
    const t = latLngToTileFloat(p.lat, p.lng, MAP_ZOOM);
    return {
      x: CANVAS_W / 2 + (t.x - ct.x) * TILE_SIZE,
      y: CANVAS_H / 2 + (t.y - ct.y) * TILE_SIZE,
    };
  });
  const inside = pts.filter(p => p.x > -80 && p.x < CANVAS_W + 80 && p.y > -80 && p.y < CANVAS_H + 80);
  if (inside.length < 3) return null;
  // Clip to safe rendering area
  return pts.map(p => ({
    x: Math.max(0,        Math.min(CANVAS_W,          p.x)),
    y: Math.max(HEADER_H, Math.min(CANVAS_H - FOOTER_H, p.y)),
  }));
}

/** Fill a polygon with panel rectangles, returning the placed array. */
function fillPolygon(
  poly: { x: number; y: number }[],
  lat: number,
  maxCount: number,
): Panel[] {
  const { pW, pH, gapX } = panelPx(lat);
  const gapY = gapX;
  const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const panels: Panel[] = [];
  let id = 0;
  outer: for (let y = minY + gapY; y + pH <= maxY - gapY; y += pH + gapY) {
    for (let x = minX + gapX; x + pW <= maxX - gapX; x += pW + gapX) {
      if (id >= maxCount) break outer;
      if (ptInPoly(x + pW / 2, y + pH / 2, poly)) {
        panels.push({ id: `p-${id}`, x: Math.round(x), y: Math.round(y), width: pW, height: pH, rotation: 0, selected: false });
        id++;
      }
    }
  }
  return panels;
}

/** Grid layout fallback when no polygon available. */
function gridLayout(
  lat: number,
  count: number,
  bounds: { x: number; y: number; w: number; h: number },
): Panel[] {
  const { pW, pH, gapX } = panelPx(lat);
  const gapY = gapX;
  const cols = Math.max(1, Math.floor(bounds.w / (pW + gapX)));
  const gridW = cols * (pW + gapX) - gapX;
  const startX = Math.round(bounds.x + (bounds.w - gridW) / 2);
  const panels: Panel[] = [];
  for (let i = 0; i < count; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    const x = startX + c * (pW + gapX);
    const y = bounds.y + gapY + r * (pH + gapY);
    if (y + pH > bounds.y + bounds.h) break;
    panels.push({ id: `p-${i}`, x, y, width: pW, height: pH, rotation: 0, selected: false });
  }
  return panels;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Panel {
  id: string;
  x: number; y: number;
  width: number; height: number;
  rotation: number;
  selected: boolean;
}

export interface Props {
  leadId: string;
  lat: number;
  lng: number;
  panelCount: number;
  roofAreaSqM?: number | null;
  annualSavingsUsd?: number | null;
  initialLayout: unknown;
  uploadedImageUrl?: string;
  osmGeometry?: { lat: number; lng: number }[] | null;
  /** Compact = embedded inside a modal; full = standalone section */
  compact?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SolarVisualEditor({
  leadId, lat, lng, panelCount, roofAreaSqM, annualSavingsUsd,
  initialLayout, uploadedImageUrl, osmGeometry, compact = false,
}: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const [panels, setPanels]         = useState<Panel[]>([]);
  const [bgImage, setBgImage]       = useState<HTMLImageElement | null>(null);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [zoom, setZoom]             = useState(compact ? 1.5 : 1);
  const [dragging, setDragging]     = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roofPoly, setRoofPoly]     = useState<{ x: number; y: number }[] | null>(null);

  // ── Derive roof polygon from OSM geometry once ───────────────────────────
  useEffect(() => {
    if (osmGeometry && osmGeometry.length >= 3) {
      setRoofPoly(projectOsm(lat, lng, osmGeometry));
    }
  }, [lat, lng, osmGeometry]);

  // ── Initialise panels ────────────────────────────────────────────────────
  useEffect(() => {
    const stored = initialLayout as any;
    // New format: { panels: [...], osmGeometry: [...] }
    const savedPanels: Panel[] | null = Array.isArray(stored?.panels)
      ? (stored.panels as Panel[])
      : Array.isArray(stored) ? (stored as Panel[]) : null;

    if (savedPanels && savedPanels.length > 0) {
      setPanels(savedPanels);
      return;
    }

    // Generate fresh layout
    const poly = osmGeometry ? projectOsm(lat, lng, osmGeometry) : null;
    if (poly && poly.length >= 3) {
      setPanels(fillPolygon(poly, lat, panelCount));
    } else {
      const pad = 40;
      setPanels(gridLayout(lat, panelCount, {
        x: pad, y: HEADER_H + pad,
        w: CANVAS_W - pad * 2,
        h: CANVAS_H - HEADER_H - FOOTER_H - pad * 2,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelCount, lat, lng]);

  // ── Load satellite image ─────────────────────────────────────────────────
  useEffect(() => {
    setImgLoading(true);
    setImgError(false);
    const img = new Image();
    img.onload  = () => { setBgImage(img); setImgLoading(false); };
    img.onerror = () => { setImgError(true); setImgLoading(false); };
    img.src = uploadedImageUrl ?? `/api/satellite?lat=${lat}&lng=${lng}&zoom=${MAP_ZOOM}`;
  }, [uploadedImageUrl, lat, lng]);

  // ── Draw ─────────────────────────────────────────────────────────────────
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
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      if (!imgLoading) {
        ctx.fillStyle = "#475569";
        ctx.font = "13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(imgError ? "Satellite imagery unavailable" : "Loading…", CANVAS_W / 2, CANVAS_H / 2);
      }
    }

    // Roof polygon outline
    if (roofPoly && roofPoly.length >= 3) {
      ctx.beginPath();
      roofPoly.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = "rgba(59,130,246,0.07)";
      ctx.fill();
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = "rgba(96,165,250,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Panels
    panels.forEach(panel => {
      ctx.save();
      ctx.translate(panel.x + panel.width / 2, panel.y + panel.height / 2);
      if (panel.rotation) ctx.rotate((panel.rotation * Math.PI) / 180);

      const isSelected = panel.id === selectedId;
      ctx.fillStyle   = isSelected ? "rgba(251,146,60,0.90)" : "rgba(15,40,105,0.93)";
      ctx.strokeStyle = isSelected ? "#fb923c" : "#3b82f6";
      ctx.lineWidth   = isSelected ? 1.5 : 0.8;

      const rx = -panel.width / 2, ry = -panel.height / 2;
      ctx.beginPath();
      ctx.roundRect(rx, ry, panel.width, panel.height, 1);
      ctx.fill();
      ctx.stroke();

      // Internal cell lines (only when large enough)
      if (panel.width >= 12) {
        ctx.strokeStyle = isSelected ? "rgba(251,146,60,0.4)" : "rgba(59,130,246,0.35)";
        ctx.lineWidth = 0.4;
        for (let c = 1; c < 3; c++) {
          const lx = rx + (panel.width / 3) * c;
          ctx.beginPath(); ctx.moveTo(lx, ry); ctx.lineTo(lx, ry + panel.height); ctx.stroke();
        }
        if (panel.height >= 9) {
          const ly = ry + panel.height / 2;
          ctx.beginPath(); ctx.moveTo(rx, ly); ctx.lineTo(rx + panel.width, ly); ctx.stroke();
        }
      }
      ctx.restore();
    });

    // Header overlay
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, 0, CANVAS_W, HEADER_H);
    ctx.fillStyle = "#fb923c";
    ctx.font = "bold 13px Arial,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`⚡ ${panels.length} Solar Panels`, 14, 22);
    const capKw = ((panels.length * 400) / 1000).toFixed(1);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px Arial,sans-serif";
    ctx.fillText(`${capKw} kW system`, 14, 42);
    if (roofAreaSqM) {
      ctx.fillText(`Roof: ${Math.round(roofAreaSqM)} m²`, CANVAS_W / 2 - 30, 32);
    }
    if (annualSavingsUsd) {
      ctx.fillStyle = "#4ade80";
      ctx.fillText(`₹${Math.round(annualSavingsUsd).toLocaleString("en-IN")}/yr savings`, CANVAS_W - 180, 32);
    }
    // Roof source indicator
    ctx.fillStyle = roofPoly ? "#60a5fa" : "#64748b";
    ctx.font = "9px Arial,sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(roofPoly ? "✓ OSM rooftop detected" : "⚠ Roof bounds estimated", CANVAS_W - 10, CANVAS_H - FOOTER_H - 4);
    ctx.textAlign = "left";

    // Footer overlay
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, CANVAS_H - FOOTER_H, CANVAS_W, FOOTER_H);
    ctx.fillStyle = "#fb923c";
    ctx.font = "bold 10px Arial,sans-serif";
    ctx.fillText("SolarPropose · Interactive Panel Editor", 14, CANVAS_H - 10);
  }, [panels, bgImage, imgLoading, imgError, selectedId, roofPoly, roofAreaSqM, annualSavingsUsd]);

  useEffect(() => { draw(); }, [draw]);

  // ── Canvas mouse/touch helpers ───────────────────────────────────────────
  function canvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top)  * (CANVAS_H / rect.height),
    };
  }
  function hitTest(pos: { x: number; y: number }): Panel | null {
    for (let i = panels.length - 1; i >= 0; i--) {
      const p = panels[i];
      if (pos.x >= p.x && pos.x <= p.x + p.width && pos.y >= p.y && pos.y <= p.y + p.height) return p;
    }
    return null;
  }
  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = canvasPos(e);
    const hit = hitTest(pos);
    if (hit) { setSelectedId(hit.id); setDragging({ id: hit.id, ox: pos.x - hit.x, oy: pos.y - hit.y }); }
    else setSelectedId(null);
  }
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragging) return;
    const pos = canvasPos(e);
    setPanels(prev => prev.map(p =>
      p.id === dragging.id ? { ...p, x: pos.x - dragging.ox, y: pos.y - dragging.oy } : p
    ));
  }
  function onMouseUp() { setDragging(null); }

  // ── Actions ──────────────────────────────────────────────────────────────
  function resetLayout() {
    const poly = osmGeometry ? projectOsm(lat, lng, osmGeometry) : null;
    if (poly && poly.length >= 3) {
      setPanels(fillPolygon(poly, lat, panelCount));
    } else {
      const pad = 40;
      setPanels(gridLayout(lat, panelCount, {
        x: pad, y: HEADER_H + pad,
        w: CANVAS_W - pad * 2,
        h: CANVAS_H - HEADER_H - FOOTER_H - pad * 2,
      }));
    }
    setSelectedId(null);
    toast("Layout reset to auto-detected roof bounds", "success");
  }

  function addPanel() {
    const { pW, pH } = panelPx(lat);
    setPanels(prev => [...prev, {
      id: `p-${Date.now()}`, x: 60, y: HEADER_H + 10, width: pW, height: pH, rotation: 0, selected: false,
    }]);
  }
  function removeSelected() {
    if (!selectedId) return;
    setPanels(prev => prev.filter(p => p.id !== selectedId));
    setSelectedId(null);
  }
  function rotateSelected() {
    if (!selectedId) return;
    setPanels(prev => prev.map(p => p.id === selectedId ? { ...p, rotation: (p.rotation + 90) % 360 } : p));
  }

  async function saveLayout() {
    setSaving(true);
    try {
      const res = await fetch("/api/solar/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, layout: panels, osmGeometry }),
      });
      if (res.ok) toast(`Layout saved — ${panels.length} panels`, "success");
      else toast("Failed to save layout", "error");
    } catch { toast("Network error", "error"); }
    finally { setSaving(false); }
  }

  const capacity = ((panels.length * 400) / 1000).toFixed(1);

  return (
    <div className={compact ? "" : "bg-slate-900 border border-slate-800 rounded-2xl p-6"}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-orange-400" />
          <h2 className={`font-semibold text-white ${compact ? "text-sm" : "text-lg"}`}>Panel Layout Editor</h2>
          {roofPoly && (
            <span className="text-[10px] px-2 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-full font-medium">
              OSM rooftop
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-orange-400 font-semibold">
            <Zap className="w-3.5 h-3.5" />{panels.length} panels · {capacity} kW
          </span>
          {roofAreaSqM && (
            <span className="flex items-center gap-1 text-slate-400">
              <Home className="w-3.5 h-3.5" />{Math.round(roofAreaSqM)} m²
            </span>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <button onClick={addPanel}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
        {selectedId && <>
          <button onClick={rotateSelected}
            className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
            ↻ Rotate
          </button>
          <button onClick={removeSelected}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
            <Minus className="w-3.5 h-3.5" /> Remove
          </button>
        </>}
        <button onClick={resetLayout}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
          <RotateCcw className="w-3 h-3" /> Reset to Roof
        </button>

        <div className="flex items-center gap-1 ml-1 border border-slate-700 rounded-lg overflow-hidden">
          <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 text-xs text-slate-400 tabular-nums">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <button onClick={saveLayout} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg transition-colors font-medium ml-auto">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Layout
        </button>
      </div>

      {/* Hint */}
      <div className="flex items-center gap-1.5 mb-2 text-[11px] text-slate-600">
        <Info className="w-3 h-3 shrink-0" />
        Click a panel to select · Drag to move · Blue outline = detected rooftop boundary
      </div>

      {/* Canvas */}
      <div className="overflow-auto rounded-xl border border-slate-700 bg-slate-950">
        {imgLoading && (
          <div className="flex items-center justify-center h-[240px]">
            <Loader2 className="w-5 h-5 text-orange-400 animate-spin mr-2" />
            <span className="text-slate-400 text-sm">Loading satellite imagery…</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{
            display: imgLoading ? "none" : "block",
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            cursor: dragging ? "grabbing" : selectedId ? "grab" : "default",
            width: "100%",
            maxWidth: CANVAS_W,
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4 text-[10px] text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-2.5 rounded-sm bg-blue-900 border border-blue-500/50 inline-block" />Panels (auto-placed)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-2.5 rounded-sm border border-blue-400/50 border-dashed inline-block" />OSM rooftop outline
        </span>
        <span className="flex items-center gap-1.5">
          <Sun className="w-3 h-3 text-orange-400" />Sun-facing orientation
        </span>
        <span className="ml-auto">{panels.length} panels · {capacity} kW</span>
      </div>
    </div>
  );
}
