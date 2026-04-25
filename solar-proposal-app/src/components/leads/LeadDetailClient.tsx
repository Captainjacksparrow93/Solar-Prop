"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MapPin, Phone, ExternalLink, Zap, Loader2,
  TrendingUp, Sun, Leaf, DollarSign, Battery,
  ChevronLeft, Settings2, Image as ImageIcon, AlertTriangle,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { toast } from "@/components/ui/Toaster";
import { SolarVisualEditor } from "@/components/solar/SolarVisualEditor";
import { ImageUploadCard } from "@/components/solar/ImageUploadCard";
import { ZoneSelector } from "@/components/solar/ZoneSelector";
import type { DetectedZone } from "@/app/api/solar/detect-zones/route";

interface Company {
  defaultElectricityRate: number;
  defaultPanelWattage: number;
  defaultPanelCostPerWatt: number;
  defaultIncentivePercent: number;
}

interface SolarAnalysis {
  roofAreaSqM: number | null;
  maxPanelCount: number | null;
  panelCount: number | null;
  panelWattage: number | null;
  systemCapacityKw: number | null;
  annualOutputKwh: number | null;
  annualSavingsUsd: number | null;
  systemCostUsd: number | null;
  incentiveAmountUsd: number | null;
  netCostUsd: number | null;
  paybackYears: number | null;
  roiPercent: number | null;
  co2OffsetTonsPerYear: number | null;
  usableSunshineHoursPerYear: number | null;
  panelLayout: unknown;
  uploadedImageUrl?: string | null;
  detectedZones?: unknown;
  userInputRoofAreaSqM?: number | null;
  selectedZones?: unknown;
}

interface Lead {
  id: string;
  businessName: string;
  address: string;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  businessType: string | null;
  rating: number | null;
  status: string;
  lat: number | null;
  lng: number | null;
  solarAnalysis: SolarAnalysis | null;
}

interface Props {
  lead: Lead;
  company: Company | null;
}

export function LeadDetailClient({ lead, company }: Props) {
  const [analysis, setAnalysis] = useState<SolarAnalysis | null>(lead.solarAnalysis);
  const [analyzing, setAnalyzing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isEstimated, setIsEstimated] = useState(false);
  const [estimatedWarning, setEstimatedWarning] = useState<string | null>(null);

  // Image analysis state
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [detectedZones, setDetectedZones] = useState<DetectedZone[]>([]);
  const [showZoneSelector, setShowZoneSelector] = useState(false);
  const [confirmedAreaSqM, setConfirmedAreaSqM] = useState<number | null>(null);

  // Editable parameters
  const [panelCount, setPanelCount] = useState(
    lead.solarAnalysis?.panelCount ?? null as number | null
  );
  const [roofAreaSqM, setRoofAreaSqM] = useState<number | "">(
    (lead.solarAnalysis?.userInputRoofAreaSqM ?? lead.solarAnalysis?.roofAreaSqM ?? "") as number | ""
  );
  const [panelWattage, setPanelWattage] = useState(
    company?.defaultPanelWattage ?? 400
  );
  const [electricityRate, setElectricityRate] = useState(
    company?.defaultElectricityRate ?? 9.0
  );
  const [panelCostPerWatt, setPanelCostPerWatt] = useState(
    company?.defaultPanelCostPerWatt ?? 45.0
  );
  const [incentivePercent, setIncentivePercent] = useState(
    company?.defaultIncentivePercent ?? 30
  );

  async function runAnalysis() {
    setAnalyzing(true);
    setIsEstimated(false);
    setEstimatedWarning(null);
    try {
      const res = await fetch("/api/solar/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          panelCount: panelCount || undefined,
          panelWattage,
          electricityRate,
          panelCostPerWatt,
          incentivePercent,
          roofAreaSqM: roofAreaSqM !== "" ? roofAreaSqM : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast(data.error || "Analysis failed", "error");
        return;
      }

      setAnalysis(data.analysis);
      // Sync panel count from result so UI reflects calculated value
      if (data.analysis?.panelCount) setPanelCount(data.analysis.panelCount);
      if (data.analysis?.roofAreaSqM && roofAreaSqM === "") setRoofAreaSqM(Math.round(data.analysis.roofAreaSqM));

      if (data.isEstimated) {
        setIsEstimated(true);
        setEstimatedWarning(data.warning ?? null);
        toast("Analysis complete (estimated — enter roof area for accuracy)", "success");
      } else {
        toast("Solar analysis complete!", "success");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleImageUploaded(url: string, shouldDetectZones: boolean) {
    setUploadedImageUrl(url);
    if (shouldDetectZones) {
      setShowZoneSelector(true);
    }
  }

  function handleZoneConfirm(selectedZones: DetectedZone[], newPanelCount: number, areaSqM: number) {
    setPanelCount(newPanelCount);
    setConfirmedAreaSqM(areaSqM);
    setDetectedZones(selectedZones);
    setShowZoneSelector(false);
    toast(`Updated panel count to ${newPanelCount} based on selected zones`, "success");
  }

  const statCards = analysis
    ? [
        {
          label: "Annual Savings",
          value: formatCurrency(analysis.annualSavingsUsd),
          sub: `${formatCurrency((analysis.annualSavingsUsd ?? 0) / 12)}/mo`,
          icon: DollarSign,
          color: "text-emerald-400",
          bg: "bg-emerald-500/10",
        },
        {
          label: "System Cost",
          value: formatCurrency(analysis.netCostUsd),
          sub: `After ${incentivePercent}% incentive`,
          icon: TrendingUp,
          color: "text-blue-400",
          bg: "bg-blue-500/10",
        },
        {
          label: "Payback Period",
          value: `${formatNumber(analysis.paybackYears)} yrs`,
          sub: `${formatNumber(analysis.roiPercent)}% 25yr ROI`,
          icon: Battery,
          color: "text-purple-400",
          bg: "bg-purple-500/10",
        },
        {
          label: "Annual Output",
          value: `${formatNumber(analysis.annualOutputKwh)} kWh`,
          sub: `${formatNumber(analysis.systemCapacityKw)} kW system`,
          icon: Zap,
          color: "text-yellow-400",
          bg: "bg-yellow-500/10",
        },
        {
          label: "CO₂ Offset",
          value: `${formatNumber(analysis.co2OffsetTonsPerYear)} tons`,
          sub: "per year",
          icon: Leaf,
          color: "text-green-400",
          bg: "bg-green-500/10",
        },
        {
          label: "Roof Area",
          value: `${formatNumber(analysis.roofAreaSqM)} m²`,
          sub: `Max ${analysis.maxPanelCount} panels`,
          icon: Sun,
          color: "text-orange-400",
          bg: "bg-orange-500/10",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/leads" className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Leads
        </Link>
        <span className="text-slate-600">/</span>
        <span className="text-white font-medium">{lead.businessName}</span>
      </div>

      {/* Lead info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">{lead.businessName}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {lead.address}
                {lead.city ? `, ${lead.city}` : ""}
                {lead.state ? `, ${lead.state}` : ""}
              </span>
              {lead.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {lead.phone}
                </span>
              )}
              {lead.website && (
                <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-orange-400 hover:text-orange-300">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Website
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
            >
              <Settings2 className="w-4 h-4" />
              Parameters
            </button>
            <button
              onClick={runAnalysis}
              disabled={analyzing || !lead.lat}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {analyzing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
              ) : (
                <><Zap className="w-4 h-4" /> {analysis ? "Re-analyze" : "Analyze Rooftop"}</>
              )}
            </button>
          </div>
        </div>

        {!lead.lat && (
          <p className="mt-3 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 rounded-lg">
            This lead has no coordinates. Solar analysis is unavailable.
          </p>
        )}

        {isEstimated && estimatedWarning && (
          <div className="mt-3 flex items-start gap-2 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-400" />
            <span>{estimatedWarning}</span>
          </div>
        )}

        {/* Parameter settings panel */}
        {showSettings && (
          <div className="mt-5 p-4 bg-slate-800/50 rounded-xl border border-slate-700 space-y-3">
            {/* Roof area row — most important for accuracy when Google Solar API unavailable */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Roof area (m²) <span className="text-slate-600">— improves accuracy</span>
                </label>
                <input type="number" min={50} max={100000} step={10}
                  value={roofAreaSqM}
                  placeholder="e.g. 1200"
                  onChange={(e) => setRoofAreaSqM(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Panel count override <span className="text-slate-600">— leave blank for auto</span>
                </label>
                <input type="number" min={1} max={5000}
                  value={panelCount ?? ""}
                  placeholder="auto from roof area"
                  onChange={(e) => setPanelCount(e.target.value === "" ? null : Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Panel wattage (W)</label>
                <input type="number" min={100} max={700} value={panelWattage}
                  onChange={(e) => setPanelWattage(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Electricity (₹/kWh)</label>
                <input type="number" min={1} max={50} step={0.5} value={electricityRate}
                  onChange={(e) => setElectricityRate(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Install cost (₹/W)</label>
                <input type="number" min={20} max={200} step={1} value={panelCostPerWatt}
                  onChange={(e) => setPanelCostPerWatt(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Incentive (%)</label>
                <input type="number" min={0} max={100} value={incentivePercent}
                  onChange={(e) => setIncentivePercent(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Analysis results */}
      {analysis && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {statCards.map((card) => (
              <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className={`w-8 h-8 ${card.bg} rounded-lg flex items-center justify-center mb-2`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <p className="text-lg font-bold text-white leading-tight">{card.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{card.label}</p>
                <p className="text-xs text-slate-600 mt-0.5">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* Image Analysis Section */}
          {lead.lat && lead.lng && (
            <div className="space-y-6">
              {!uploadedImageUrl ? (
                <ImageUploadCard
                  leadId={lead.id}
                  onImageUploaded={handleImageUploaded}
                />
              ) : showZoneSelector ? (
                <ZoneSelector
                  leadId={lead.id}
                  imageUrl={uploadedImageUrl}
                  zones={detectedZones}
                  totalAreaSqM={confirmedAreaSqM || 5000}
                  onConfirm={handleZoneConfirm}
                />
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
                  <ImageIcon className="w-5 h-5 text-green-400 shrink-0" />
                  <div>
                    <p className="text-white font-medium">Image loaded and analyzed</p>
                    <p className="text-sm text-slate-400">Panel count updated to {panelCount} based on zones</p>
                  </div>
                  <button
                    onClick={() => {
                      setUploadedImageUrl(null);
                      setDetectedZones([]);
                      setConfirmedAreaSqM(null);
                    }}
                    className="ml-auto px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                  >
                    Upload New Image
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Visual Editor */}
          {lead.lat && lead.lng && (
            <SolarVisualEditor
              leadId={lead.id}
              lat={lead.lat}
              lng={lead.lng}
              panelCount={analysis.panelCount ?? panelCount ?? 20}
              roofAreaSqM={analysis.roofAreaSqM}
              annualSavingsUsd={analysis.annualSavingsUsd}
              osmGeometry={(analysis.panelLayout as any)?.osmGeometry ?? null}
              initialLayout={analysis.panelLayout}
              uploadedImageUrl={uploadedImageUrl ?? undefined}
            />
          )}

          {/* Create Proposal CTA */}
          <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <p className="text-white font-semibold text-lg">Ready to create a proposal?</p>
              <p className="text-slate-400 text-sm mt-1">
                This business could save {formatCurrency(analysis.annualSavingsUsd ?? 0)} per year on electricity.
              </p>
            </div>
            <Link
              href={`/proposals/new?leadId=${lead.id}`}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors text-sm shrink-0"
            >
              <TrendingUp className="w-4 h-4" />
              Create Proposal
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
