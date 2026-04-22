"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { FileText, Eye, Trash2, Share2, Plus, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "@/components/ui/Toaster";

interface Proposal {
  id: string;
  title: string;
  status: string;
  annualSavingsUsd: number | null;
  netCostUsd: number | null;
  paybackYears: number | null;
  shareToken: string | null;
  createdAt: string | Date;
  lead: { businessName: string; city: string | null };
}

interface AnalyzedLead {
  id: string;
  businessName: string;
  city: string | null;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  DRAFT: <Clock className="w-3.5 h-3.5 text-slate-400" />,
  SENT: <Share2 className="w-3.5 h-3.5 text-blue-400" />,
  VIEWED: <Eye className="w-3.5 h-3.5 text-yellow-400" />,
  ACCEPTED: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
  REJECTED: <XCircle className="w-3.5 h-3.5 text-red-400" />,
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  SENT: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  VIEWED: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  ACCEPTED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function ProposalsList({
  proposals: initial,
  analyzedLeads,
}: {
  proposals: Proposal[];
  analyzedLeads: AnalyzedLead[];
}) {
  const [proposals, setProposals] = useState(initial);

  async function copyShareLink(token: string) {
    const url = `${window.location.origin}/p/${token}`;
    await navigator.clipboard.writeText(url);
    toast("Share link copied to clipboard!", "success");
  }

  async function deleteProposal(id: string) {
    const res = await fetch(`/api/proposals/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProposals((prev) => prev.filter((p) => p.id !== id));
      toast("Proposal deleted", "success");
    } else {
      toast("Failed to delete", "error");
    }
  }

  return (
    <div className="space-y-4">
      {/* Quick create from analyzed leads */}
      {analyzedLeads.length > 0 && proposals.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-white font-medium mb-3">
            You have {analyzedLeads.length} analyzed lead{analyzedLeads.length > 1 ? "s" : ""} ready for proposals:
          </p>
          <div className="flex flex-wrap gap-2">
            {analyzedLeads.map((l) => (
              <Link
                key={l.id}
                href={`/proposals/new?leadId=${l.id}`}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-orange-500/10 hover:border-orange-500/30 border border-slate-700 rounded-lg text-sm text-slate-300 hover:text-orange-400 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {l.businessName}
                {l.city ? `, ${l.city}` : ""}
              </Link>
            ))}
          </div>
        </div>
      )}

      {proposals.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No proposals yet.</p>
          <p className="text-slate-500 text-xs mt-1">
            Analyze a lead first, then create a proposal from its detail page.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Proposal</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Business</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Annual Savings</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Net Cost</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {proposals.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-white">{p.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <p className="text-sm text-slate-300">{p.lead.businessName}</p>
                    <p className="text-xs text-slate-500">{p.lead.city ?? ""}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${STATUS_COLORS[p.status] ?? ""}`}>
                      {STATUS_ICONS[p.status]}
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-sm text-emerald-400 font-medium hidden lg:table-cell">
                    {formatCurrency(p.annualSavingsUsd)}
                  </td>
                  <td className="px-5 py-4 text-right text-sm text-white hidden lg:table-cell">
                    {formatCurrency(p.netCostUsd)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/proposals/${p.id}`}
                        className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                        title="View proposal"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      {p.shareToken && (
                        <button
                          onClick={() => copyShareLink(p.shareToken!)}
                          className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-blue-400"
                          title="Copy share link"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteProposal(p.id)}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-slate-500 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
