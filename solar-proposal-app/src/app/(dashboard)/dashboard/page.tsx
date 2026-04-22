import { db } from "@/lib/db";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Users, FileText, TrendingUp, Zap, ArrowRight, Sun } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getStats() {
  const [leads, proposals, analyses] = await Promise.all([
    db.lead.count(),
    db.proposal.count(),
    db.solarAnalysis.findMany({
      select: { annualSavingsUsd: true, systemCapacityKw: true },
    }),
  ]);

  const totalSavings = analyses.reduce(
    (sum: number, a: { annualSavingsUsd: number | null }) => sum + (a.annualSavingsUsd ?? 0),
    0
  );
  const totalCapacity = analyses.reduce(
    (sum: number, a: { systemCapacityKw: number | null }) => sum + (a.systemCapacityKw ?? 0),
    0
  );

  return { leads, proposals, totalSavings, totalCapacity };
}

async function getRecentLeads() {
  return db.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { solarAnalysis: { select: { annualSavingsUsd: true } } },
  });
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ANALYZING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  ANALYZED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PROPOSAL_SENT: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  WON: "bg-green-500/10 text-green-400 border-green-500/20",
  LOST: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export default async function DashboardPage() {
  const [stats, recentLeads] = await Promise.all([
    getStats(),
    getRecentLeads(),
  ]);

  const statCards = [
    { label: "Total Leads", value: String(stats.leads), icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Proposals Generated", value: String(stats.proposals), icon: FileText, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Total Annual Savings", value: formatCurrency(stats.totalSavings), icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Total Solar Capacity", value: `${formatNumber(stats.totalCapacity)} kW`, icon: Zap, color: "text-orange-400", bg: "bg-orange-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Here&apos;s your solar pipeline at a glance.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center mb-3`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{card.value}</p>
            <p className="text-slate-400 text-sm mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/leads" className="group bg-slate-900 border border-slate-800 hover:border-orange-500/40 rounded-2xl p-5 transition-colors flex items-center justify-between">
          <div>
            <p className="text-white font-semibold">Scrape New Leads</p>
            <p className="text-slate-400 text-sm mt-1">Search businesses by area on Google Maps</p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-orange-400 transition-colors" />
        </Link>
        <Link href="/proposals" className="group bg-slate-900 border border-slate-800 hover:border-orange-500/40 rounded-2xl p-5 transition-colors flex items-center justify-between">
          <div>
            <p className="text-white font-semibold">View Proposals</p>
            <p className="text-slate-400 text-sm mt-1">Manage and track your sent proposals</p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-orange-400 transition-colors" />
        </Link>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Leads</h2>
          <Link href="/leads" className="text-orange-400 hover:text-orange-300 text-sm font-medium">View all →</Link>
        </div>

        {recentLeads.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <Sun className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No leads yet. Start by scraping businesses from Google Maps.</p>
            <Link href="/leads" className="mt-4 inline-flex px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors">
              Scrape leads
            </Link>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Business</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">City</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Annual Savings</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recentLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-white">{lead.businessName}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{lead.address}</p>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-400 hidden md:table-cell">{lead.city ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full border ${STATUS_COLORS[lead.status] ?? ""}`}>
                        {lead.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm text-emerald-400 font-medium hidden lg:table-cell">
                      {lead.solarAnalysis?.annualSavingsUsd ? formatCurrency(lead.solarAnalysis.annualSavingsUsd) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/leads/${lead.id}`} className="text-xs text-orange-400 hover:text-orange-300 font-medium">View →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
