"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Radar, Loader2, ChevronLeft,
  Building2, Sun, DollarSign, AlertTriangle,
  CheckCircle, User, Mail, Clock,
  RefreshCw, Eye, Sparkles,
} from "lucide-react";
import { toast } from "@/components/ui/Toaster";
import { formatCurrency } from "@/lib/utils";
import { VisualModal } from "@/components/solar/VisualModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanLead {
  id: string;
  businessName: string;
  address: string;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  roofScore: number | null;
  roofScoreLabel: string | null;
  urgencyScore: number | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  animationUrl: string | null;
  businessType: string | null;
  createdAt: string;
  solarAnalysis: {
    roofAreaSqM: number | null;
    panelCount: number | null;
    annualSavingsUsd: number | null;
    systemCapacityKw: number | null;
    netCostUsd: number | null;
    paybackYears: number | null;
    roiPercent: number | null;
    usableSunshineHoursPerYear: number | null;
  } | null;
}

interface ActivityItem {
  id: string;
  type: "found" | "scored" | "high_priority" | "owner" | "email" | "itc";
  leadId: string;
  title: string;
  detail: string;
  time: Date;
}

interface Props {
  jobId: string;
  jobName: string;
  jobStatus: string;
  initialLeads: ScanLead[];
}

type Tab = "activity" | "prospects" | "itc";

// ─── Activity type config ─────────────────────────────────────────────────────

const ACTIVITY_CONFIG = {
  found:         { icon: Building2,    border: "border-l-blue-500",   bg: "bg-blue-500/10",   text: "text-blue-400" },
  scored:        { icon: Sun,          border: "border-l-orange-500", bg: "bg-orange-500/10", text: "text-orange-400" },
  high_priority: { icon: AlertTriangle,border: "border-l-red-500",    bg: "bg-red-500/10",    text: "text-red-400" },
  owner:         { icon: User,         border: "border-l-purple-500", bg: "bg-purple-500/10", text: "text-purple-400" },
  email:         { icon: Mail,         border: "border-l-green-500",  bg: "bg-green-500/10",  text: "text-green-400" },
  itc:           { icon: DollarSign,   border: "border-l-yellow-500", bg: "bg-yellow-500/10", text: "text-yellow-400" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildActivityItems(leads: ScanLead[]): ActivityItem[] {
  const items: ActivityItem[] = [];
  leads.forEach((lead, i) => {
    const base = new Date(lead.createdAt);
    const offset = (ms: number) => new Date(base.getTime() + ms);

    items.push({
      id: `found-${lead.id}`,
      type: "found",
      leadId: lead.id,
      title: `Roof captured — ${lead.businessName}`,
      detail: `${lead.address}${lead.city ? `, ${lead.city}` : ""}`,
      time: offset(0),
    });

    if (lead.solarAnalysis) {
      const area = lead.solarAnalysis.roofAreaSqM;
      const savings = lead.solarAnalysis.annualSavingsUsd;
      items.push({
        id: `scored-${lead.id}`,
        type: lead.roofScoreLabel === "High Priority" ? "high_priority" : "scored",
        leadId: lead.id,
        title: lead.roofScoreLabel === "High Priority"
          ? `High-priority target — score ${Math.round(lead.roofScore ?? 0)}`
          : `Roof analysed — score ${Math.round(lead.roofScore ?? 0)}`,
        detail: `${area ? `${Math.round(area).toLocaleString()} sqm roof` : "Roof data available"} · ${savings ? `${formatCurrency(savings)}/yr potential` : "Savings calculated"}`,
        time: offset(800),
      });

      if (lead.solarAnalysis.netCostUsd && lead.solarAnalysis.netCostUsd > 100000) {
        const itc = lead.solarAnalysis.netCostUsd * 0.3;
        items.push({
          id: `itc-${lead.id}`,
          type: "itc",
          leadId: lead.id,
          title: "ITC stack calculated",
          detail: `${formatCurrency(itc)} federal credit locked · ${formatCurrency(lead.solarAnalysis.annualSavingsUsd ?? 0)}/yr savings`,
          time: offset(1200),
        });
      }
    }

    if (lead.ownerName) {
      items.push({
        id: `owner-${lead.id}`,
        type: "owner",
        leadId: lead.id,
        title: `Owner identified — ${lead.ownerName}`,
        detail: lead.ownerEmail ? `${lead.ownerEmail} · ready for outreach` : "Contact data enriched",
        time: offset(2000),
      });
    }

    if (lead.ownerEmail) {
      items.push({
        id: `email-${lead.id}`,
        type: "email",
        leadId: lead.id,
        title: "Email verified",
        detail: `${lead.ownerEmail} · deliverable`,
        time: offset(2500),
      });
    }
  });

  return items.sort((a, b) => b.time.getTime() - a.time.getTime());
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LiveActivityDashboard({ jobId, jobName, jobStatus, initialLeads }: Props) {
  const [leads, setLeads] = useState<ScanLead[]>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<ScanLead | null>(initialLeads[0] ?? null);
  const [tab, setTab] = useState<Tab>("activity");
  const [isLive, setIsLive] = useState(jobStatus === "RUNNING" || jobStatus === "SCORING");
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [enriching, setEnriching] = useState<string | null>(null);
  const [animating, setAnimating] = useState<string | null>(null);
  const [modal, setModal] = useState<{ leadId: string; leadName: string; url: string | null; generate: boolean } | null>(null);

  const activityItems = buildActivityItems(leads);
  const highPriority = leads.filter(l => l.roofScoreLabel === "High Priority");
  const itcLeads = leads.filter(l => (l.solarAnalysis?.netCostUsd ?? 0) > 100000);

  const [scoring, setScoring] = useState(false);
  const [progress, setProgress] = useState({ scored: 0, total: initialLeads.length });
  const [previewError, setPreviewError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/scan/jobs/${jobId}`);
      const d = await r.json();
      if (d.leads) {
        setLeads(d.leads);
        setProgress(p => ({ ...p, total: d.leads.length }));
        if (!selectedLead && d.leads.length > 0) setSelectedLead(d.leads[0]);
      }
      setLastRefresh(new Date());
      if (d.job?.status === "COMPLETED" || d.job?.status === "FAILED") setIsLive(false);
    } catch { /* silent */ }
  }, [jobId, selectedLead]);

  // Drive Phase 2 scoring automatically — call /score until remaining === 0
  const runScoring = useCallback(async () => {
    if (scoring) return;
    setScoring(true);
    try {
      let remaining = 1;
      while (remaining > 0) {
        const r = await fetch(`/api/scan/jobs/${jobId}/score`, { method: "POST" });
        const d = await r.json();
        if (!r.ok) break;
        remaining = d.remaining ?? 0;

        // Merge newly scored leads into state immediately
        if (d.leads?.length > 0) {
          setLeads(prev => {
            const map = new Map(prev.map(l => [l.id, l]));
            d.leads.forEach((l: ScanLead) => map.set(l.id, l));
            const updated = Array.from(map.values()).sort((a, b) => (b.roofScore ?? 0) - (a.roofScore ?? 0));
            if (!selectedLead) setSelectedLead(updated[0] ?? null);
            return updated;
          });
          setProgress(p => ({ scored: p.scored + d.leads.length, total: p.total }));
          setLastRefresh(new Date());
        }
        if (remaining === 0) { setIsLive(false); break; }
      }
    } catch { /* silent */ }
    finally { setScoring(false); }
  }, [jobId, scoring, selectedLead]);

  // Start scoring as soon as the page loads if job is in SCORING state
  useEffect(() => {
    if (jobStatus === "SCORING" || jobStatus === "RUNNING") {
      runScoring();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fallback polling in case scoring is running in another tab
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [isLive, refresh]);

  async function enrichOwner(leadId: string) {
    setEnriching(leadId);
    try {
      const r = await fetch("/api/leads/batch/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [leadId] }),
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error || "Enrichment failed", "error"); return; }
      toast("Owner data enriched!", "success");
      await refresh();
      const updated = leads.find(l => l.id === leadId);
      if (updated) setSelectedLead({ ...updated });
    } catch { toast("Network error", "error"); }
    finally { setEnriching(null); }
  }

  async function generateAnimation(leadId: string) {
    setAnimating(leadId);
    try {
      const r = await fetch(`/api/leads/${leadId}/generate-animation`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) { toast(d.error || "Failed", "error"); return; }
      toast("Visual generated!", "success");
      setPreviewError(false);
      await refresh();
    } catch { toast("Network error", "error"); }
    finally { setAnimating(null); }
  }

  // Visual URL: satellite image composited with per-building customised panels
  const previewImageUrl = selectedLead?.lat && selectedLead?.lng
    ? (selectedLead.animationUrl ?? `/api/leads/${selectedLead.id}/visual`)
    : null;

  // Reset error state whenever the selected lead changes
  useEffect(() => { setPreviewError(false); }, [selectedLead?.id]);

  const displayLeads = tab === "itc" ? itcLeads : tab === "prospects" ? highPriority : leads;

  return (
    <div className="flex flex-col h-[calc(100vh-88px)] overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/scan" className="text-slate-500 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <span className="text-xs text-slate-500 font-mono">SolarPropose</span>
          <span className="text-slate-700">/</span>
          <span className="text-xs text-slate-400 font-mono">Scan</span>
          <span className="text-slate-700">/</span>
          <span className="text-xs text-white font-mono truncate max-w-40">{jobName}</span>
        </div>
        <div className="flex items-center gap-3">
          {(isLive || scoring) && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                LIVE
              </div>
              {scoring && progress.total > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((progress.scored / progress.total) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {progress.scored}/{progress.total} scored
                  </span>
                </div>
              )}
            </div>
          )}
          {!isLive && !scoring && (
            <span className="text-xs text-slate-600 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              Complete
            </span>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-0 px-4 bg-slate-900 border-b border-slate-800 shrink-0">
        {([
          { id: "activity", label: "Activity", count: activityItems.length },
          { id: "prospects", label: "Prospects", count: leads.length },
          { id: "itc", label: "ITC Priority", count: itcLeads.length },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === t.id
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              tab === t.id ? "bg-orange-500/20 text-orange-400" : "bg-slate-800 text-slate-500"
            }`}>{t.count}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 py-2">
          <span className="text-[10px] text-slate-600">
            {leads.length} buildings · {highPriority.length} high-priority
          </span>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Activity feed / Prospects ── */}
        <div className="w-80 shrink-0 border-r border-slate-800 overflow-y-auto bg-slate-950">
          <div className="px-3 py-2 text-[10px] text-slate-600 uppercase tracking-widest font-medium border-b border-slate-800 flex items-center justify-between">
            <span>{tab === "activity" ? "ACTIVITY" : tab === "itc" ? "ITC PRIORITY" : "PROSPECTS"}</span>
            <span className="text-slate-700">{new Date(lastRefresh).toLocaleTimeString()}</span>
          </div>

          {tab === "activity" ? (
            <div className="divide-y divide-slate-800/50">
              {activityItems.length === 0 && (
                <div className="py-12 text-center text-slate-600 text-sm">
                  {isLive ? "Scanning..." : "No activity yet"}
                </div>
              )}
              {activityItems.map(item => {
                const cfg = ACTIVITY_CONFIG[item.type];
                const Icon = cfg.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      const lead = leads.find(l => l.id === item.leadId);
                      if (lead) setSelectedLead(lead);
                    }}
                    className={`w-full text-left px-3 py-3 border-l-2 ${cfg.border} hover:bg-slate-800/30 transition-colors ${
                      selectedLead?.id === item.leadId ? "bg-slate-800/40" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-6 h-6 rounded ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className={`w-3.5 h-3.5 ${cfg.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white leading-tight truncate">{item.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-tight line-clamp-2">{item.detail}</p>
                      </div>
                      <span className="text-[10px] text-slate-700 shrink-0 mt-0.5">{timeAgo(item.time)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {displayLeads.map(lead => (
                <button
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={`w-full text-left px-3 py-3 hover:bg-slate-800/30 transition-colors ${
                    selectedLead?.id === lead.id ? "bg-slate-800/40 border-l-2 border-l-orange-500" : "border-l-2 border-l-transparent"
                  }`}
                >
                  <p className="text-xs font-medium text-white truncate">{lead.businessName}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{lead.address}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {lead.roofScoreLabel && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        lead.roofScoreLabel === "High Priority" ? "bg-red-500/20 text-red-400" :
                        lead.roofScoreLabel === "Medium Priority" ? "bg-orange-500/20 text-orange-400" :
                        "bg-slate-700 text-slate-400"
                      }`}>{lead.roofScoreLabel}</span>
                    )}
                    {lead.solarAnalysis?.annualSavingsUsd && (
                      <span className="text-[10px] text-emerald-400 font-medium">
                        {formatCurrency(lead.solarAnalysis.annualSavingsUsd)}/yr
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Building detail ── */}
        {selectedLead ? (
          <div className="flex-1 overflow-y-auto bg-slate-950">
            {/* Satellite / visual image — click to open full popup */}
            <div
              className="relative h-56 bg-slate-900 overflow-hidden cursor-pointer group"
              onClick={() => setModal({
                leadId: selectedLead.id,
                leadName: selectedLead.businessName,
                url: selectedLead.animationUrl ?? null,
                generate: false,
              })}
            >
              {!previewError && previewImageUrl ? (
                <img
                  key={selectedLead.id}
                  src={previewImageUrl}
                  alt="Building with solar panels"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={() => setPreviewError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Building2 className="w-12 h-12 text-slate-700" />
                </div>
              )}
              {/* Expand hint */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="bg-black/60 rounded-full p-2">
                  <Eye className="w-5 h-5 text-white" />
                </div>
              </div>

              {/* Address overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <p className="text-white font-bold text-sm">{selectedLead.businessName}</p>
                <p className="text-slate-300 text-xs">{selectedLead.address}{selectedLead.city ? `, ${selectedLead.city}` : ""}</p>
              </div>

              {/* Score badge */}
              {selectedLead.roofScoreLabel && (
                <div className={`absolute top-3 right-3 px-2 py-1 rounded text-[11px] font-bold ${
                  selectedLead.roofScoreLabel === "High Priority" ? "bg-red-500 text-white" :
                  selectedLead.roofScoreLabel === "Medium Priority" ? "bg-orange-500 text-white" :
                  "bg-slate-700 text-slate-300"
                }`}>
                  {selectedLead.roofScoreLabel}
                </div>
              )}
            </div>

            <div className="p-4 space-y-4">
              {/* Building meta */}
              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                {selectedLead.businessType && <span>📦 {selectedLead.businessType}</span>}
                {selectedLead.solarAnalysis?.usableSunshineHoursPerYear && (
                  <span>☀️ {Math.round(selectedLead.solarAnalysis.usableSunshineHoursPerYear)} hr/yr</span>
                )}
                {selectedLead.solarAnalysis?.systemCapacityKw && (
                  <span>⚡ {selectedLead.solarAnalysis.systemCapacityKw.toFixed(1)} kW system</span>
                )}
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: "ROOF SQFT",
                    value: selectedLead.solarAnalysis?.roofAreaSqM
                      ? `${Math.round(selectedLead.solarAnalysis.roofAreaSqM * 10.764).toLocaleString()}`
                      : "—",
                    sub: "sq ft",
                    color: "text-white",
                  },
                  {
                    label: "25-YR SAVINGS",
                    value: selectedLead.solarAnalysis?.annualSavingsUsd
                      ? formatCurrency(selectedLead.solarAnalysis.annualSavingsUsd * 25 * 0.85)
                      : "—",
                    sub: "estimated",
                    color: "text-emerald-400",
                  },
                  {
                    label: "FEDERAL ITC",
                    value: selectedLead.solarAnalysis?.netCostUsd
                      ? formatCurrency(selectedLead.solarAnalysis.netCostUsd * 0.3)
                      : "—",
                    sub: "30% credit",
                    color: "text-orange-400",
                  },
                ].map(m => (
                  <div key={m.label} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                    <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">{m.label}</p>
                    <p className={`text-base font-bold ${m.color} leading-tight`}>{m.value}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{m.sub}</p>
                  </div>
                ))}
              </div>

              {/* Pain signal */}
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Pain Signal</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedLead.roofScoreLabel === "High Priority"
                    ? `High solar potential commercial property. ${selectedLead.solarAnalysis?.roofAreaSqM ? `${Math.round(selectedLead.solarAnalysis.roofAreaSqM).toLocaleString()} sqm roof` : "Large commercial roof"} — ideal candidate for immediate solar deployment.`
                    : `Commercial building with viable solar potential. ${selectedLead.solarAnalysis?.panelCount ?? "—"} panels estimated, ${selectedLead.solarAnalysis?.paybackYears ? `${Math.round(selectedLead.solarAnalysis.paybackYears)}-year payback` : "strong ROI"}.`
                  }
                </p>
                {selectedLead.businessType && (
                  <p className="text-[11px] text-slate-600 mt-1">{selectedLead.businessType}</p>
                )}
              </div>

              {/* Owner info */}
              {selectedLead.ownerName || selectedLead.ownerEmail ? (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Owner</span>
                    <span className="ml-auto text-[10px] text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Verified
                    </span>
                  </div>
                  {selectedLead.ownerName && (
                    <p className="text-sm font-semibold text-white">{selectedLead.ownerName}</p>
                  )}
                  {selectedLead.ownerEmail && (
                    <p className="text-xs text-slate-400 mt-0.5">{selectedLead.ownerEmail}</p>
                  )}
                  {selectedLead.ownerPhone && (
                    <p className="text-xs text-slate-400">{selectedLead.ownerPhone}</p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => enrichOwner(selectedLead.id)}
                  disabled={enriching === selectedLead.id}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {enriching === selectedLead.id
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up owner...</>
                    : <><User className="w-3.5 h-3.5" /> Find Building Owner</>
                  }
                </button>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setModal({
                    leadId: selectedLead.id,
                    leadName: selectedLead.businessName,
                    url: selectedLead.animationUrl ?? null,
                    generate: !selectedLead.animationUrl,
                  })}
                  className="flex items-center justify-center gap-1.5 py-2 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-400 text-xs font-medium rounded-lg transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {selectedLead.animationUrl ? "View Visual" : "Generate Visual"}
                </button>
                <Link
                  href={`/leads/${selectedLead.id}`}
                  className="flex items-center justify-center gap-1.5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Full Profile
                </Link>
              </div>

              {/* Payback / ROI strip */}
              {selectedLead.solarAnalysis?.paybackYears && (
                <div className="flex items-center gap-3 text-xs py-2 border-t border-slate-800">
                  <span className="text-slate-500">Payback</span>
                  <span className="text-white font-semibold">{Math.round(selectedLead.solarAnalysis.paybackYears)} yrs</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-slate-500">25-yr ROI</span>
                  <span className="text-emerald-400 font-semibold">
                    {selectedLead.solarAnalysis.roiPercent ? `${Math.round(selectedLead.solarAnalysis.roiPercent)}%` : "—"}
                  </span>
                  <span className="text-slate-700">·</span>
                  <span className="text-slate-500">Panels</span>
                  <span className="text-white font-semibold">{selectedLead.solarAnalysis.panelCount ?? "—"}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-700">
            <div className="text-center">
              <Radar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a building to see details</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Visual Modal ── */}
      {modal && (
        <VisualModal
          leadId={modal.leadId}
          leadName={modal.leadName}
          lat={leads.find(l => l.id === modal.leadId)?.lat}
          lng={leads.find(l => l.id === modal.leadId)?.lng}
          panelCount={leads.find(l => l.id === modal.leadId)?.solarAnalysis?.panelCount ?? 20}
          existingUrl={modal.url}
          triggerGenerate={modal.generate}
          onClose={() => { setModal(null); refresh(); }}
        />
      )}
    </div>
  );
}
