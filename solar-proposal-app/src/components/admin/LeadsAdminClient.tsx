"use client";

import { useState } from "react";
import { toast } from "@/components/ui/Toaster";
import type { LeadModel } from "@/generated/prisma/models/Lead";

type LeadWithOwner = LeadModel & { user: { name: string | null; email: string } | null };

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  ANALYZING: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
  ANALYZED: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  PROPOSAL_SENT: "bg-purple-500/10 border-purple-500/20 text-purple-400",
  WON: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  LOST: "bg-red-500/10 border-red-500/20 text-red-400",
};

interface Props {
  initialLeads: LeadWithOwner[];
}

export function LeadsAdminClient({ initialLeads }: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = leads.filter((l) => {
    const matchesSearch =
      !search ||
      l.businessName.toLowerCase().includes(search.toLowerCase()) ||
      l.address.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(filtered.map((l) => l.id)));
    else setSelected(new Set());
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} lead(s)? This cannot be undone.`)) return;

    const res = await fetch("/api/leads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });

    if (!res.ok) { toast("Failed to delete leads", "error"); return; }
    toast(`${selected.size} lead(s) deleted`, "success");
    setLeads((prev) => prev.filter((l) => !selected.has(l.id)));
    setSelected(new Set());
  };

  const deleteOne = async (id: string) => {
    if (!confirm("Delete this lead?")) return;
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (!res.ok) { toast("Failed to delete", "error"); return; }
    toast("Lead deleted", "success");
    setLeads((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="NEW">NEW</option>
          <option value="ANALYZING">ANALYZING</option>
          <option value="ANALYZED">ANALYZED</option>
          <option value="PROPOSAL_SENT">PROPOSAL_SENT</option>
          <option value="WON">WON</option>
          <option value="LOST">LOST</option>
        </select>
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
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Business</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Address</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filtered.map((l) => (
              <tr key={l.id} className="hover:bg-slate-800/30 transition-colors group">
                <td className="px-4 py-3"><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleOne(l.id)} className="rounded border-slate-600" /></td>
                <td className="px-4 py-3 text-sm text-white">{l.businessName}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{l.address}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{l.user?.name || l.user?.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[l.status] || "bg-slate-700 border-slate-600 text-slate-300"}`}>{l.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => deleteOne(l.id)} className="text-red-400 hover:text-red-300 text-sm opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="px-5 py-8 text-center text-slate-500 text-sm">No leads found</p>}
      </div>
    </div>
  );
}
