"use client";

import { useState } from "react";
import { toast } from "@/components/ui/Toaster";
import type { ProposalModel } from "@/generated/prisma/models/Proposal";

type ProposalWithDetails = ProposalModel & {
  lead: { businessName: string } | null;
  user: { name: string | null; email: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-700 border-slate-600 text-slate-300",
  SENT: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  VIEWED: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
  ACCEPTED: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  REJECTED: "bg-red-500/10 border-red-500/20 text-red-400",
};

interface Props {
  initialProposals: ProposalWithDetails[];
}

export function ProposalsAdminClient({ initialProposals }: Props) {
  const [proposals, setProposals] = useState(initialProposals);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = proposals.filter(
    (p) =>
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.lead?.businessName?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(filtered.map((p) => p.id)));
    else setSelected(new Set());
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} proposal(s)? This cannot be undone.`)) return;

    const ids = [...selected];
    const results = await Promise.all(ids.map((id) => fetch(`/api/proposals/${id}`, { method: "DELETE" })));
    const failed = results.findIndex((r) => !r.ok);
    if (failed !== -1) { toast(`Failed to delete proposal ${ids[failed]}`, "error"); return; }

    toast(`${ids.length} proposal(s) deleted`, "success");
    setProposals((prev) => prev.filter((p) => !selected.has(p.id)));
    setSelected(new Set());
  };

  const deleteOne = async (id: string) => {
    if (!confirm("Delete this proposal?")) return;
    const res = await fetch(`/api/proposals/${id}`, { method: "DELETE" });
    if (!res.ok) { toast("Failed to delete", "error"); return; }
    toast("Proposal deleted", "success");
    setProposals((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search proposals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none w-64"
        />
        {selected.size > 0 && (
          <button
            onClick={deleteSelected}
            className="px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/20 transition-colors"
          >
            Delete {selected.size} selected
          </button>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-4 py-3 text-left">
                <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={(e) => toggleAll(e.target.checked)} className="rounded border-slate-600" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Lead</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cost</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-slate-800/30 transition-colors group">
                <td className="px-4 py-3"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} className="rounded border-slate-600" /></td>
                <td className="px-4 py-3 text-sm text-white">{p.title}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{p.lead?.businessName || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{p.user?.name || p.user?.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[p.status] || "bg-slate-700 border-slate-600 text-slate-300"}`}>{p.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">{p.netCostUsd ? `$${Number(p.netCostUsd).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => deleteOne(p.id)} className="text-red-400 hover:text-red-300 text-sm opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="px-5 py-8 text-center text-slate-500 text-sm">No proposals found</p>}
      </div>
    </div>
  );
}
