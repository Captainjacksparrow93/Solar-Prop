"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Download, Loader2, AlertCircle, Sun, PenLine, ArrowLeft } from "lucide-react";
import { RoofDrawingTool } from "./RoofDrawingTool";

interface Props {
  leadId: string;
  leadName: string;
  lat?: number | null;
  lng?: number | null;
  panelCount?: number;
  existingUrl?: string | null;
  onClose: () => void;
  triggerGenerate?: boolean;
}

type Screen = "view" | "draw";

export function VisualModal({
  leadId, leadName, lat, lng, panelCount = 20,
  existingUrl, onClose, triggerGenerate,
}: Props) {
  const [screen, setScreen] = useState<Screen>("view");
  const [imageUrl, setImageUrl] = useState<string | null>(existingUrl ?? null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const res  = await fetch(`/api/leads/${leadId}/generate-animation`, { method: "POST" });
      const data = await res.json();
      if (res.ok) { setImageUrl(data.animationUrl); setImageLoaded(false); setImageError(false); }
    } catch { /* silent */ }
    finally { setGenerating(false); }
  }, [leadId]);

  // Load default visual on mount if no existing URL
  useEffect(() => {
    if (!imageUrl && !triggerGenerate) {
      setImageUrl(`/api/leads/${leadId}/visual`);
    } else if (triggerGenerate && !imageUrl) {
      generate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called by RoofDrawingTool when user confirms their polygon
  function handlePolygonConfirmed(polygonNorm: Array<{ x: number; y: number }>, count: number) {
    const polyStr = encodeURIComponent(JSON.stringify(polygonNorm));
    const url = `/api/leads/${leadId}/visual?polygon=${polyStr}&t=${Date.now()}`;
    setImageUrl(url);
    setImageLoaded(false);
    setImageError(false);
    setScreen("view");
  }

  function handleDownload() {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl.startsWith("/") ? imageUrl : imageUrl;
    a.download = `solar-${leadName.replace(/\s+/g, "-").toLowerCase()}.jpg`;
    a.click();
  }

  const satelliteUrl = lat && lng ? `/api/satellite?lat=${lat}&lng=${lng}&zoom=19` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

      <div
        className={`relative bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl ${screen === "draw" ? "w-full max-w-4xl" : "w-full max-w-3xl"}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            {screen === "draw" && (
              <button onClick={() => setScreen("view")} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors mr-1">
                <ArrowLeft className="w-4 h-4 text-slate-400" />
              </button>
            )}
            <div className="w-7 h-7 bg-orange-500/15 rounded-lg flex items-center justify-center">
              <Sun className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{leadName}</p>
              <p className="text-slate-500 text-xs">
                {screen === "draw" ? "Draw rooftop outline — panels will fill your selection" : "Solar Panel Visualisation"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {screen === "view" && imageLoaded && (
              <>
                {satelliteUrl && (
                  <button onClick={() => setScreen("draw")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-400 rounded-lg transition-colors font-medium">
                    <PenLine className="w-3.5 h-3.5" />
                    Draw Rooftop
                  </button>
                )}
                <button onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          {screen === "draw" && satelliteUrl ? (
            <RoofDrawingTool
              leadId={leadId}
              satelliteUrl={satelliteUrl}
              panelCount={panelCount}
              onConfirm={handlePolygonConfirmed}
              onCancel={() => setScreen("view")}
            />
          ) : (
            <div className="relative bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center" style={{ minHeight: 360 }}>
              {/* Loading state */}
              {(generating || (!imageLoaded && !imageError && imageUrl)) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-slate-950">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-2 border-slate-800 flex items-center justify-center">
                      <Sun className="w-8 h-8 text-orange-400/30" />
                    </div>
                    <Loader2 className="absolute inset-0 w-16 h-16 text-orange-400 animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-medium text-sm">
                      {generating ? "Generating visual…" : "Building satellite composite…"}
                    </p>
                    <p className="text-slate-500 text-xs mt-1">Fetching imagery · Detecting roof · Placing panels</p>
                  </div>
                </div>
              )}

              {/* Error */}
              {imageError && (
                <div className="flex flex-col items-center gap-3 py-12">
                  <AlertCircle className="w-10 h-10 text-red-400" />
                  <p className="text-slate-300 font-medium">Failed to load visual</p>
                  <button
                    onClick={() => { setImageError(false); setImageLoaded(false); setImageUrl(`/api/leads/${leadId}/visual?t=${Date.now()}`); }}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors">
                    Try Again
                  </button>
                </div>
              )}

              {imageUrl && !imageError && (
                <img src={imageUrl} alt={`Solar visual for ${leadName}`}
                  className={`w-full h-auto object-contain transition-opacity duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                  style={{ maxHeight: "68vh" }}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => { setImageLoaded(false); setImageError(true); }}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {screen === "view" && imageLoaded && (
          <div className="px-5 py-2.5 border-t border-slate-800 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm bg-blue-700 inline-block" />Panels (to scale)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm border border-blue-400/50 inline-block" />Roof outline
            </span>
            <span className="ml-auto">© ESRI World Imagery</span>
          </div>
        )}
      </div>
    </div>
  );
}
