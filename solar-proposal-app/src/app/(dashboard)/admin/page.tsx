import { db } from "@/lib/db";
import { Users, FileText, Sun, TrendingUp } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [userCount, leadCount, proposalCount] = await Promise.all([
    db.user.count(),
    db.lead.count(),
    db.proposal.count(),
  ]);

  const recentUsers = await db.user.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { company: true },
  });

  const recentLeads = await db.lead.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });

  const recentProposals = await db.proposal.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { lead: { select: { businessName: true } }, user: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <Link
          href="/admin/users"
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Manage Users
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: userCount, icon: Users, color: "text-blue-400" },
          { label: "Total Leads", value: leadCount, icon: Sun, color: "text-emerald-400" },
          { label: "Total Proposals", value: proposalCount, icon: FileText, color: "text-purple-400" },
          { label: "Proposals/User", value: proposalCount && userCount ? (proposalCount / userCount).toFixed(1) : "0", icon: TrendingUp, color: "text-orange-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`${color} opacity-80`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{value}</p>
            <p className="text-sm text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent Users */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Recent Users</h2>
          <Link href="/admin/users" className="text-xs text-orange-400 hover:text-orange-300">View all →</Link>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800/50">
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Company</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {recentUsers.map((u) => (
              <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3 text-sm text-white">{u.name || "—"}</td>
                <td className="px-5 py-3 text-sm text-slate-400">{u.email}</td>
                <td className="px-5 py-3 text-sm text-slate-400">{u.company?.name || "—"}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full border ${u.role === "ADMIN" ? "bg-orange-500/10 border-orange-500/20 text-orange-400" : "bg-slate-700 border-slate-600 text-slate-300"}`}>
                    {u.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {recentUsers.length === 0 && <p className="px-5 py-8 text-center text-slate-500 text-sm">No users yet</p>}
      </div>

      {/* Recent Leads */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Recent Leads</h2>
          <Link href="/admin/leads" className="text-xs text-orange-400 hover:text-orange-300">View all →</Link>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800/50">
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Business</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Address</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Owner</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {recentLeads.map((l) => (
              <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3 text-sm text-white">{l.businessName}</td>
                <td className="px-5 py-3 text-sm text-slate-400">{l.address}</td>
                <td className="px-5 py-3 text-sm text-slate-400">{l.user?.name || l.user?.email}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full border ${l.status === "WON" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : l.status === "LOST" ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-blue-500/10 border-blue-500/20 text-blue-400"}`}>
                    {l.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {recentLeads.length === 0 && <p className="px-5 py-8 text-center text-slate-500 text-sm">No leads yet</p>}
      </div>

      {/* Recent Proposals */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Recent Proposals</h2>
          <Link href="/admin/proposals" className="text-xs text-orange-400 hover:text-orange-300">View all →</Link>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800/50">
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Title</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Lead</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Owner</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {recentProposals.map((p) => (
              <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3 text-sm text-white">{p.title}</td>
                <td className="px-5 py-3 text-sm text-slate-400">{p.lead?.businessName}</td>
                <td className="px-5 py-3 text-sm text-slate-400">{p.user?.name}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full border ${p.status === "ACCEPTED" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : p.status === "REJECTED" ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-blue-500/10 border-blue-500/20 text-blue-400"}`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {recentProposals.length === 0 && <p className="px-5 py-8 text-center text-slate-500 text-sm">No proposals yet</p>}
      </div>
    </div>
  );
}
