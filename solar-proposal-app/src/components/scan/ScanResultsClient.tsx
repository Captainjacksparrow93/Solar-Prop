"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, Loader2, Users, Sparkles, Send,
  CheckCircle, Building2,
} from "lucide-react";
import { toast } from "@/components/ui/Toaster";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface Lead {
  id: string;
  businessName: string;
  address: string;
  city: string | null;
  state: string | null;
  roofScore: number | null;
  roofScoreLabel: string | null;
  ownerName: string | null;
  animationUrl: string | null;
  solarAnalysis: {
    panelCount: number | null;
    annualSavingsUsd: number | null;
    systemCapacityKw: number | null;
    paybackYears: number | null;
  } | null;
}

interface ScanJob {
  id: string;
  name: string;
  method: string;
  status: string;
  totalFound: number;
  totalScored: number;
  createdAt: Date | string;
}

interface Props {
  job: ScanJob;
  leads: Lead[];
}

const LABEL_STYLE: Record<string, string> = {
  "High Priority": "text-red-400 bg-red-500/10 border border-red-500/20",
  "Medium Priority": "text-orange-400 bg-orange-500/10 border border-orange-500/20",
  "Low Priority": "text-slate-400 bg-slate-500/10 border border-slate-500/20",
};

export function ScanResultsClient({ job, leads: initialLeads }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enriching, setEnriching] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignName, setCampaignName] = useState(`Campaign — ${job.name}`);
  const [campaignSubject, setCampaignSubject] = useState("We mapped solar panels on {{businessName}}");
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  const toggleAll = () => {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map((l) => l.id)));
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectedLeads = leads.filter((l) => selected.has(l.id));
  const highCount = leads.filter((l) => l.roofScoreLabel === "High Priority").length;

  async function enrichOwners() {
    if (selected.size === 0) { toast("Select leads to enrich", "error"); return; }
    setEnriching(true);
    try {
      const res = await fetch("/api/leads/batch/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Enrichment failed", "error"); return; }
      toast(`Enriched ${data.enriched} / ${data.total} leads`, "success");
      // Refresh data
      const r = await fetch(`/api/scan/jobs/${job.id}`);
      const d = await r.json();
      setLeads(d.leads ?? leads);
    } catch { toast("Network error", "error"); }
    finally { setEnriching(false); }
  }

  async function generateAnimations() {
    if (selected.size === 0) { toast("Select leads first", "error"); return; }
    setAnimating(true);
    let done = 0;
    for (const id of selected) {
      try {
        await fetch(`/api/leads/${id}/generate-animation`, { method: "POST" });
        done++;
      } catch { /* skip */ }
    }
    toast(`Generated ${done} animations`, "success");
    const r = await fetch(`/api/scan/jobs/${job.id}`);
    const d = await r.json();
    setLeads(d.leads ?? leads);
    setAnimating(false);
  }

  async function createCampaign() {
    if (selected.size === 0) { toast("Select leads first", "error"); return; }
    setCreatingCampaign(true);
    try {
      const res = await fetch("/api/outreach/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          subject: campaignSubject,
          bodyTemplate: "default",
          leadIds: Array.from(selected),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Failed", "error"); return; }
      toast("Campaign created!", "success");
      setShowCampaignModal(false);
      window.location.href = `/outreach/${data.campaign.id}`;
    } catch { toast("Network error", "error"); }
    finally { setCreatingCampaign(false); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link href="/scan" className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-2 transition-colors">
            <ChevronLeft className="w-4 h-4" />Scan Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-white">{job.name}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {job.totalFound} buildings · {job.totalScored} scored · {highCount} high-priority
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={enrichOwners}
            disabled={enriching || selected.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-lg text-sm transition-colors"
          >
            {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            Enrich Owners ({selected.size})
          </button>
          <button
            onClick={generateAnimations}
            disabled={animating || selected.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-lg text-sm transition-colors"
          >
            {animating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate Visuals ({selected.size})
          </button>
          <button
            onClick={() => { if (selected.size === 0) { toast("Select leads first", "error"); return; } setShowCampaignModal(true); }}
            disabled={selected.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Send className="w-4 h-4" />
            Create Campaign ({selected.size})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left w-8">
                <input type="checkbox" checked={selected.size === leads.length && leads.length > 0} onChange={toggleAll}
                  className="accent-orange-500" />
              </th>
              <th className="px-4 py-3 text-left">Business</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Score</th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">Panels</th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">Savings/yr</th>
              <th className="px-4 py-3 text-left hidden xl:table-cell">Owner</th>
              <th className="px-4 py-3 text-left hidden xl:table-cell">Visual</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {leads.map((lead) => (
              <tr key={lead.id} className={`hover:bg-slate-800/20 transition-colors ${selected.has(lead.id) ? "bg-orange-500/5" : ""}`}>
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggle(lead.id)}
                    className="accent-orange-500" />
                </td>
                <td className="px-4 py-3">
                  <p className="text-white font-medium text-sm">{lead.businessName}</p>
                  <p className="text-xs text-slate-500">{lead.address}</p>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {lead.roofScoreLabel ? (
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-white">{Math.round(lead.roofScore ?? 0)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LABEL_STYLE[lead.roofScoreLabel] ?? ""}`}>
                        {lead.roofScoreLabel}
                      </span>
                    </div>
                  ) : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3 text-right hidden lg:table-cell text-slate-300">
                  {lead.solarAnalysis?.panelCount ?? "—"}
                </td>
                <td className="px-4 py-3 text-right hidden lg:table-cell text-emerald-400 font-medium">
                  {lead.solarAnalysis?.annualSavingsUsd
                    ? formatCurrency(lead.solarAnalysis.annualSavingsUsd)
                    : "—"}
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  {lead.ownerName ? (
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      <span className="text-slate-300 text-xs truncate max-w-28">{lead.ownerName}</span>
                    </div>
                  ) : <span className="text-slate-600 text-xs">Not enriched</span>}
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  {lead.animationUrl ? (
                    <a href={lead.animationUrl} target="_blank" rel="noreferrer"
                      className="text-xs text-orange-400 hover:text-orange-300 underline">View</a>
                  ) : <span className="text-slate-600 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/leads/${lead.id}`}
                    className="text-xs text-slate-400 hover:text-white transition-colors">
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {leads.length === 0 && (
          <div className="py-16 text-center">
            <Building2 className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500">No leads found in this scan</p>
          </div>
        )}
      </div>

      {/* Campaign modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Create Outreach Campaign</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Campaign Name</label>
                <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Email Subject</label>
                <input value={campaignSubject} onChange={(e) => setCampaignSubject(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500" />
                <p className="text-xs text-slate-600 mt-1">Use {"{{businessName}}"} for personalisation</p>
              </div>
              <p className="text-sm text-slate-400">{selected.size} leads will be added to this campaign.</p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCampaignModal(false)}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors">
                Cancel
              </button>
              <button onClick={createCampaign} disabled={creatingCampaign}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-medium rounded-lg text-sm transition-colors">
                {creatingCampaign ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
