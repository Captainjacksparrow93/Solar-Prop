"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  MousePointer, Trash2, CheckCircle, ZoomIn, ZoomOut,
  RotateCcw, Loader2, Info,
} from "lucide-react";

interface Point { x: number; y: number }   // canvas pixel coords (before zoom)

interface Props {
  leadId: string;
  satelliteUrl: string;         // /api/satellite?lat=…&lng=…
  panelCount: number;           // from Solar API or default
  onConfirm: (polygonNorm: Point[], panelCount: number) => void;  // normalised 0-1 coords
  onCancel: () => void;
}

// Real panel dimensions in pixels at zoom-0 canvas coords (640×400)
const PANEL_W = 28;
const PANEL_H = 17;
const PANEL_GAP = 3;

function ptInPolygon(px: number, py: number, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function countPanels(poly: Point[], canvasW: number, canvasH: number): number {
  if (poly.length < 3) return 0;
  let count = 0;
  for (let y = PANEL_GAP; y + PANEL_H < canvasH; y += PANEL_H + PANEL_GAP) {
    for (let x = PANEL_GAP; x + PANEL_W < canvasW; x += PANEL_W + PANEL_GAP) {
      const cx = x + PANEL_W / 2, cy = y + PANEL_H / 2;
      if (ptInPolygon(cx, cy, poly)) count++;
    }
  }
  return count;
}

export function RoofDrawingTool({ leadId, satelliteUrl, panelCount, onConfirm, onCancel }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bgImgRef   = useRef<HTMLImageElement | null>(null);

  const [points, setPoints] = useState<Point[]>([]);
  const [closed, setClosed]   = useState(false);
  const [zoom, setZoom]       = useState(1);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hoverPt, setHoverPt] = useState<Point | null>(null);
  const [fitCount, setFitCount] = useState(0);

  const CW = 640, CH = 400;

  // Load satellite image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => { bgImgRef.current = img; setImgLoaded(true); };
    img.onerror = () => setImgLoaded(true); // draw dark fallback
    img.src     = satelliteUrl;
  }, [satelliteUrl]);

  // Redraw canvas whenever state changes
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, CW, CH);

    // Background
    if (bgImgRef.current) {
      ctx.drawImage(bgImgRef.current, 0, 0, CW, CH);
    } else {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, CW, CH);
    }

    if (points.length === 0 && !hoverPt) return;

    const allPts = closed ? points : (hoverPt ? [...points, hoverPt] : points);

    // If polygon closed — draw panel fill
    if (closed && points.length >= 3) {
      for (let y = PANEL_GAP; y + PANEL_H < CH; y += PANEL_H + PANEL_GAP) {
        for (let x = PANEL_GAP; x + PANEL_W < CW; x += PANEL_W + PANEL_GAP) {
          const cx = x + PANEL_W / 2, cy = y + PANEL_H / 2;
          if (ptInPolygon(cx, cy, points)) {
            ctx.fillStyle   = "rgba(23,51,121,0.90)";
            ctx.strokeStyle = "#3b82f6";
            ctx.lineWidth   = 1;
            ctx.beginPath();
            ctx.roundRect(x, y, PANEL_W, PANEL_H, 1);
            ctx.fill(); ctx.stroke();
            // cell lines
            ctx.strokeStyle = "rgba(96,165,250,0.4)";
            ctx.lineWidth   = 0.5;
            [[x + PANEL_W/3, y, x + PANEL_W/3, y + PANEL_H],
             [x + PANEL_W*2/3, y, x + PANEL_W*2/3, y + PANEL_H],
             [x, y + PANEL_H/2, x + PANEL_W, y + PANEL_H/2]].forEach(([x1,y1,x2,y2]) => {
              ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
            });
          }
        }
      }
    }

    // Polygon outline + fill
    if (allPts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(allPts[0].x, allPts[0].y);
      allPts.forEach(p => ctx.lineTo(p.x, p.y));
      if (closed) ctx.closePath();

      ctx.fillStyle   = closed ? "rgba(59,130,246,0.10)" : "rgba(249,115,22,0.12)";
      ctx.strokeStyle = closed ? "#3b82f6" : "#f97316";
      ctx.lineWidth   = 2;
      if (closed) ctx.fill();
      ctx.stroke();
    }

    // Vertex dots
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, i === 0 ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle   = i === 0 ? "#f97316" : "#3b82f6";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth   = 1.5;
      ctx.fill(); ctx.stroke();
    });

    // Hover crosshair hint
    if (!closed && hoverPt) {
      ctx.strokeStyle = "rgba(249,115,22,0.7)";
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(hoverPt.x - 8, hoverPt.y); ctx.lineTo(hoverPt.x + 8, hoverPt.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hoverPt.x, hoverPt.y - 8); ctx.lineTo(hoverPt.x, hoverPt.y + 8); ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [points, closed, hoverPt, imgLoaded]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    if (closed) setFitCount(countPanels(points, CW, CH));
  }, [closed, points]);

  // Convert mouse event to canvas coords (accounting for zoom/scale)
  function getCanvasPoint(e: React.MouseEvent<HTMLCanvasElement>): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CW / rect.width),
      y: (e.clientY - rect.top)  * (CH / rect.height),
    };
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (closed) return;
    setHoverPt(getCanvasPoint(e));
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (closed) return;
    const pt = getCanvasPoint(e);

    // Close polygon if clicking near first point
    if (points.length >= 3) {
      const first = points[0];
      const dist  = Math.hypot(pt.x - first.x, pt.y - first.y);
      if (dist < 14) { setClosed(true); setHoverPt(null); return; }
    }

    setPoints(prev => [...prev, pt]);
  }

  function reset() {
    setPoints([]); setClosed(false); setHoverPt(null); setFitCount(0);
  }

  function confirm() {
    if (!closed || points.length < 3) return;
    const norm = points.map(p => ({ x: p.x / CW, y: p.y / CH }));
    const actualCount = Math.min(panelCount, fitCount);
    onConfirm(norm, actualCount || panelCount);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/60 rounded-lg px-3 py-2">
          <Info className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          {!closed
            ? points.length === 0
              ? "Click on the rooftop to start drawing its outline"
              : points.length < 3
              ? `${3 - points.length} more point${3 - points.length > 1 ? "s" : ""} needed — click near the ● to close`
              : "Continue clicking — or click the orange ● to close the polygon"
            : `${fitCount} panels fit · Click Confirm to generate visual`
          }
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setZoom(z => Math.min(3, z + 0.25))}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="overflow-auto rounded-xl border border-slate-700 bg-slate-950 relative">
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={CW} height={CH}
          style={{
            display: "block",
            width:  "100%",
            maxWidth: CW,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            cursor: closed ? "default" : "crosshair",
          }}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverPt(null)}
        />
      </div>

      {/* Stats + action buttons */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <p className="text-lg font-bold text-white">{closed ? fitCount : "—"}</p>
            <p className="text-xs text-slate-500">Panels fit</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-orange-400">{points.length}</p>
            <p className="text-xs text-slate-500">Points drawn</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!closed || points.length < 3}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Generate Visual with {fitCount || panelCount} Panels
          </button>
        </div>
      </div>
    </div>
  );
}
