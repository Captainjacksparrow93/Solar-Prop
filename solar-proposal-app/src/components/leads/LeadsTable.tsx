"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import {
  Star,
  ExternalLink,
  Phone,
  Zap,
  FileText,
  Trash2,
  Search,
} from "lucide-react";
import { toast } from "@/components/ui/Toaster";

interface Lead {
  id: string;
  businessName: string;
  address: string;
  city: string | null;
  businessType: string | null;
  rating: number | null;
  totalRatings: number | null;
  phone: string | null;
  website: string | null;
  status: string;
  solarAnalysis: { annualSavingsUsd: number | null } | null;
  createdAt: string | Date;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ANALYZING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  ANALYZED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PROPOSAL_SENT: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  WON: "bg-green-500/10 text-green-400 border-green-500/20",
  LOST: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export function LeadsTable({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const filtered = leads.filter(
    (l) =>
      l.businessName.toLowerCase().includes(filter.toLowerCase()) ||
      l.address.toLowerCase().includes(filter.toLowerCase()) ||
      l.city?.toLowerCase().includes(filter.toLowerCase())
  );

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (!selected.size) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => !selected.has(l.id)));
        setSelected(new Set());
        toast(`Deleted ${selected.size} lead(s)`, "success");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-800">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            placeholder="Filter leads..."
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>{leads.length} total</span>
          {selected.size > 0 && (
            <button
              onClick={deleteSelected}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg transition-colors text-xs font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete {selected.size}
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-sm">
          {leads.length === 0
            ? "No leads yet. Use the scraper above to find businesses."
            : "No leads match your filter."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="w-10 px-4 py-3"></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Business</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Rating</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden xl:table-cell">Est. Savings/yr</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      className="accent-orange-500 w-4 h-4"
                    />
                  </td>
                  <td className="px-4 py-3 min-w-[200px]">
                    <p className="text-sm font-medium text-white">{lead.businessName}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[240px]">
                      {lead.city ? `${lead.city} — ` : ""}{lead.address}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {lead.phone && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Phone className="w-3 h-3" /> {lead.phone}
                        </span>
                      )}
                      {lead.website && (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> website
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400 capitalize hidden md:table-cell">
                    {lead.businessType ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {lead.rating ? (
                      <span className="flex items-center gap-1 text-sm text-yellow-400">
                        <Star className="w-3.5 h-3.5 fill-yellow-400" />
                        {lead.rating.toFixed(1)}
                        <span className="text-slate-500 text-xs">({lead.totalRatings})</span>
                      </span>
                    ) : (
                      <span className="text-slate-600 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full border ${STATUS_COLORS[lead.status] ?? ""}`}>
                      {lead.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right hidden xl:table-cell">
                    <span className="text-sm text-emerald-400 font-medium">
                      {lead.solarAnalysis?.annualSavingsUsd
                        ? formatCurrency(lead.solarAnalysis.annualSavingsUsd)
                        : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-orange-400 hover:text-white hover:bg-orange-500 rounded-lg transition-colors"
                        title="Analyze solar"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Analyze
                      </Link>
                      <Link
                        href={`/proposals?leadId=${lead.id}`}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title="Create proposal"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Propose
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
