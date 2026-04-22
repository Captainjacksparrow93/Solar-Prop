"use client";

import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  Sun, Zap, DollarSign, Leaf, TrendingUp, Battery,
  Share2, ChevronLeft, Printer, MapPin, Phone, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { toast } from "@/components/ui/Toaster";

interface Company {
  name: string;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
  phone: string | null;
  website: string | null;
}

interface Proposal {
  id: string;
  title: string;
  status: string;
  customMessage: string | null;
  validUntil: Date | null;
  shareToken: string | null;
  panelCount: number | null;
  systemCapacityKw: number | null;
  annualOutputKwh: number | null;
  annualSavingsUsd: number | null;
  systemCostUsd: number | null;
  incentiveAmountUsd: number | null;
  netCostUsd: number | null;
  paybackYears: number | null;
  roiPercent: number | null;
  co2OffsetTonsPerYear: number | null;
  createdAt: Date;
  lead: {
    businessName: string;
    address: string;
    city: string | null;
    state: string | null;
    phone: string | null;
    website: string | null;
    solarAnalysis: {
      satelliteImageUrl: string | null;
      panelLayout: unknown;
    } | null;
  };
  user: {
    name: string | null;
    email: string;
    company: Company | null;
  };
}

interface Props {
  proposal: Proposal;
  editable?: boolean;
}

export function ProposalView({ proposal, editable = false }: Props) {
  const company = proposal.user.company;
  const primary = company?.primaryColor ?? "#f97316";
  const lead = proposal.lead;

  function copyShareLink() {
    if (!proposal.shareToken) return;
    const url = `${window.location.origin}/p/${proposal.shareToken}`;
    navigator.clipboard.writeText(url);
    toast("Share link copied!", "success");
  }

  const metrics = [
    {
      label: "Annual Energy Savings",
      value: formatCurrency(proposal.annualSavingsUsd),
      sub: `${formatCurrency((proposal.annualSavingsUsd ?? 0) / 12)}/month`,
      icon: DollarSign,
      highlight: true,
    },
    {
      label: "System Capacity",
      value: `${formatNumber(proposal.systemCapacityKw)} kW`,
      sub: `${proposal.panelCount} panels × ${formatNumber(proposal.systemCapacityKw && proposal.panelCount ? (proposal.systemCapacityKw * 1000) / proposal.panelCount : 0, 0)}W`,
      icon: Zap,
    },
    {
      label: "Annual Output",
      value: `${formatNumber(proposal.annualOutputKwh)} kWh`,
      sub: "AC production estimate",
      icon: Sun,
    },
    {
      label: "Payback Period",
      value: `${formatNumber(proposal.paybackYears)} years`,
      sub: `${formatNumber(proposal.roiPercent)}% ROI over 25 years`,
      icon: Battery,
    },
    {
      label: "Total System Cost",
      value: formatCurrency(proposal.systemCostUsd),
      sub: `Net after incentives: ${formatCurrency(proposal.netCostUsd)}`,
      icon: TrendingUp,
    },
    {
      label: "CO₂ Offset",
      value: `${formatNumber(proposal.co2OffsetTonsPerYear)} tons/yr`,
      sub: "Equivalent to planting trees",
      icon: Leaf,
    },
  ];

  const savings25yr = (proposal.annualSavingsUsd ?? 0) * 25;
  const chartYears = [5, 10, 15, 20, 25];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Controls (only in dashboard) */}
      {editable && (
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link href="/proposals" className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Proposals
          </Link>
          <div className="flex items-center gap-2">
            {proposal.shareToken && (
              <button
                onClick={copyShareLink}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Copy share link
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print / Export PDF
            </button>
          </div>
        </div>
      )}

      {/* Proposal document */}
      <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="px-10 py-8 text-white" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sun className="w-7 h-7 text-white/80" />
                <span className="text-xl font-bold">{company?.name ?? "Solar Company"}</span>
              </div>
              <h1 className="text-3xl font-bold mt-4">{proposal.title}</h1>
              <p className="text-white/70 mt-1 text-sm">
                Prepared on {new Date(proposal.createdAt).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric"
                })}
                {proposal.validUntil && (
                  <> · Valid until {new Date(proposal.validUntil).toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric"
                  })}</>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="px-10 py-8 space-y-8">

          {/* Business info */}
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Prepared for</p>
              <h2 className="text-2xl font-bold text-gray-900">{lead.businessName}</h2>
              <div className="flex flex-col gap-1 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {lead.address}{lead.city ? `, ${lead.city}` : ""}{lead.state ? `, ${lead.state}` : ""}
                </span>
                {lead.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    {lead.phone}
                  </span>
                )}
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-orange-500 hover:text-orange-600">
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    {lead.website}
                  </a>
                )}
              </div>
            </div>

            {/* 25yr savings callout */}
            <div className="rounded-2xl p-5 text-white shrink-0" style={{ background: primary }}>
              <p className="text-sm text-white/70 font-medium">25-year total savings</p>
              <p className="text-4xl font-bold mt-1">{formatCurrency(savings25yr)}</p>
              <p className="text-white/60 text-xs mt-1">Based on current electricity rates</p>
            </div>
          </div>

          {/* Custom message */}
          {proposal.customMessage && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
              <p className="text-sm text-gray-600 leading-relaxed">{proposal.customMessage}</p>
            </div>
          )}

          {/* Key metrics grid */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">System Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {metrics.map((m) => (
                <div
                  key={m.label}
                  className={`rounded-2xl p-4 ${m.highlight ? "text-white" : "bg-gray-50 border border-gray-100"}`}
                  style={m.highlight ? { background: primary } : {}}
                >
                  <m.icon className={`w-5 h-5 mb-2 ${m.highlight ? "text-white/70" : "text-gray-400"}`} />
                  <p className={`text-xl font-bold ${m.highlight ? "text-white" : "text-gray-900"}`}>{m.value}</p>
                  <p className={`text-xs font-medium mt-0.5 ${m.highlight ? "text-white/80" : "text-gray-500"}`}>{m.label}</p>
                  <p className={`text-xs mt-0.5 ${m.highlight ? "text-white/60" : "text-gray-400"}`}>{m.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Savings projection bar */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Cumulative Savings Projection</h3>
            <div className="bg-gray-50 rounded-2xl p-5">
              <div className="space-y-3">
                {chartYears.map((yr) => {
                  const savings = (proposal.annualSavingsUsd ?? 0) * yr;
                  const pct = (savings / savings25yr) * 100;
                  return (
                    <div key={yr} className="flex items-center gap-4">
                      <span className="text-sm text-gray-500 w-16 shrink-0">Year {yr}</span>
                      <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                          style={{ width: `${pct}%`, background: primary }}
                        >
                          {pct > 25 && (
                            <span className="text-xs font-semibold text-white">{formatCurrency(savings)}</span>
                          )}
                        </div>
                      </div>
                      {pct <= 25 && (
                        <span className="text-sm font-semibold text-gray-700 w-24 shrink-0">{formatCurrency(savings)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Financial breakdown */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Investment Breakdown</h3>
            <div className="rounded-2xl border border-gray-200 overflow-hidden">
              {[
                { label: "Gross system cost", value: formatCurrency(proposal.systemCostUsd), mono: false },
                { label: "Federal/state incentives", value: `− ${formatCurrency(proposal.incentiveAmountUsd)}`, mono: false, green: true },
                { label: "Net investment", value: formatCurrency(proposal.netCostUsd), bold: true },
                { label: "Annual savings", value: formatCurrency(proposal.annualSavingsUsd), green: true },
                { label: "Simple payback", value: `${formatNumber(proposal.paybackYears)} years`, bold: false },
                { label: "25-year ROI", value: `${formatNumber(proposal.roiPercent)}%`, green: true, bold: true },
              ].map((row, i) => (
                <div key={i} className={`flex items-center justify-between px-5 py-3.5 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"} ${row.bold ? "border-t border-gray-200" : ""}`}>
                  <span className={`text-sm ${row.bold ? "font-semibold text-gray-900" : "text-gray-600"}`}>{row.label}</span>
                  <span className={`text-sm font-semibold ${row.green ? "text-emerald-600" : "text-gray-900"}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Environmental impact */}
          <div className="rounded-2xl p-6 bg-emerald-50 border border-emerald-100">
            <h3 className="text-lg font-bold text-emerald-900 mb-3 flex items-center gap-2">
              <Leaf className="w-5 h-5" />
              Environmental Impact
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatNumber(proposal.co2OffsetTonsPerYear)}t
                </p>
                <p className="text-xs text-emerald-600 mt-1">CO₂ offset / year</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatNumber((proposal.co2OffsetTonsPerYear ?? 0) * 25)}t
                </p>
                <p className="text-xs text-emerald-600 mt-1">CO₂ offset over 25 years</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatNumber((proposal.co2OffsetTonsPerYear ?? 0) * 25 * 1000 / 21.77)}
                </p>
                <p className="text-xs text-emerald-600 mt-1">Trees equivalent</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 pt-6 flex items-start justify-between gap-4 text-xs text-gray-400 flex-wrap">
            <div>
              <p className="font-semibold text-gray-600">{company?.name ?? "Solar Company"}</p>
              {company?.phone && <p>{company.phone}</p>}
              {company?.website && <p>{company.website}</p>}
              <p className="mt-1 max-w-xs">
                This proposal is an estimate based on satellite analysis and regional solar data.
                Actual savings may vary based on consumption patterns and utility rates.
              </p>
            </div>
            <div className="text-right">
              <p>Ref: {proposal.id.slice(0, 8).toUpperCase()}</p>
              {proposal.validUntil && (
                <p>Expires: {new Date(proposal.validUntil).toLocaleDateString()}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
