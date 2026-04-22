"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { ChevronLeft, Loader2, FileText, Zap, DollarSign, Battery, Leaf } from "lucide-react";
import Link from "next/link";
import { toast } from "@/components/ui/Toaster";

interface SolarAnalysis {
  panelCount: number | null;
  systemCapacityKw: number | null;
  annualSavingsUsd: number | null;
  netCostUsd: number | null;
  paybackYears: number | null;
  roiPercent: number | null;
  co2OffsetTonsPerYear: number | null;
  annualOutputKwh: number | null;
}

interface Lead {
  id: string;
  businessName: string;
  city: string | null;
  address: string;
  solarAnalysis: SolarAnalysis | null;
}

interface Company {
  name: string;
  primaryColor: string;
}

interface Props {
  leads: Lead[];
  preselectedLead: Lead | null;
  company: Company | null;
}

export function NewProposalClient({ leads, preselectedLead, company }: Props) {
  const router = useRouter();
  const [selectedLeadId, setSelectedLeadId] = useState(preselectedLead?.id ?? "");
  const [title, setTitle] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [validDays, setValidDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? preselectedLead;
  const analysis = selectedLead?.solarAnalysis;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLeadId) {
      toast("Please select a lead", "error");
      return;
    }
    if (!analysis) {
      toast("Selected lead has no solar analysis. Please analyze it first.", "error");
      return;
    }

    setSubmitting(true);
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedLeadId,
          title: title || `Solar Proposal — ${selectedLead?.businessName}`,
          customMessage,
          validUntil: validUntil.toISOString(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast(data.error || "Failed to create proposal", "error");
        return;
      }

      toast("Proposal created!", "success");
      router.push(`/proposals/${data.id}`);
    } catch {
      toast("Network error", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/proposals" className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Proposals
        </Link>
        <span className="text-slate-600">/</span>
        <span className="text-white font-medium">New Proposal</span>
      </div>

      <h1 className="text-2xl font-bold text-white">Create Solar Proposal</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-400" />
              Proposal Details
            </h2>

            {/* Lead selector */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Select Business *</label>
              {leads.length === 0 ? (
                <p className="text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 rounded-lg">
                  No analyzed leads found.{" "}
                  <Link href="/leads" className="underline">Analyze a lead first →</Link>
                </p>
              ) : (
                <select
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                >
                  <option value="">— Choose a lead —</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.businessName}{l.city ? ` — ${l.city}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Proposal title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                placeholder={selectedLead ? `Solar Proposal — ${selectedLead.businessName}` : "Solar Proposal"}
              />
            </div>

            {/* Custom message */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Custom message (optional)</label>
              <textarea
                rows={4}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 resize-none"
                placeholder="Add a personal note for the client..."
              />
            </div>

            {/* Validity */}
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Valid for (days)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={validDays}
                onChange={(e) => setValidDays(Number(e.target.value))}
                className="w-40 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedLeadId}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creating proposal...</>
            ) : (
              "Create & Preview Proposal"
            )}
          </button>
        </form>

        {/* Preview panel */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Financial Summary</h3>

            {analysis ? (
              <div className="space-y-3">
                {[
                  { label: "Annual Savings", value: formatCurrency(analysis.annualSavingsUsd), icon: DollarSign, color: "text-emerald-400" },
                  { label: "Net System Cost", value: formatCurrency(analysis.netCostUsd), icon: Zap, color: "text-blue-400" },
                  { label: "Payback Period", value: `${formatNumber(analysis.paybackYears)} years`, icon: Battery, color: "text-purple-400" },
                  { label: "25yr ROI", value: `${formatNumber(analysis.roiPercent)}%`, icon: DollarSign, color: "text-orange-400" },
                  { label: "CO₂ Offset", value: `${formatNumber(analysis.co2OffsetTonsPerYear)} tons/yr`, icon: Leaf, color: "text-green-400" },
                  { label: "System Size", value: `${formatNumber(analysis.systemCapacityKw)} kW`, icon: Zap, color: "text-yellow-400" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                      {item.label}
                    </div>
                    <span className="text-sm font-medium text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">
                {selectedLeadId
                  ? "No analysis found for this lead."
                  : "Select a lead to see the financial summary."}
              </p>
            )}
          </div>

          {company && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-2">Company Branding</h3>
              <p className="text-sm text-slate-400">{company.name}</p>
              <div className="flex items-center gap-2 mt-2">
                <div
                  className="w-5 h-5 rounded-full border border-slate-600"
                  style={{ background: company.primaryColor }}
                />
                <span className="text-xs text-slate-500">{company.primaryColor}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
