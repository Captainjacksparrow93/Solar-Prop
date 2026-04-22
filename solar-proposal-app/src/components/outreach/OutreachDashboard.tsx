"use client";

import Link from "next/link";
import { Send, ChevronRight, Mail, MailOpen, MousePointer, Users, PlusCircle } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  subject: string;
  sentCount: number;
  openCount: number;
  clickCount: number;
  createdAt: Date | string;
  _count: { leads: number };
}

interface Props { campaigns: Campaign[] }

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  ACTIVE: "text-green-400 bg-green-500/10 border-green-500/20",
  PAUSED: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  COMPLETED: "text-blue-400 bg-blue-500/10 border-blue-500/20",
};

export function OutreachDashboard({ campaigns }: Props) {
  const totalSent = campaigns.reduce((s, c) => s + c.sentCount, 0);
  const totalOpens = campaigns.reduce((s, c) => s + c.openCount, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clickCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Send className="w-6 h-6 text-orange-400" />
            <h1 className="text-2xl font-bold text-white">Outreach</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Personalised solar proposals delivered to building owners automatically.
          </p>
        </div>
        <Link href="/scan" className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors">
          <PlusCircle className="w-4 h-4" />
          New Campaign via Scan
        </Link>
      </div>

      {/* Stats */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Emails Sent", value: totalSent, icon: Mail, color: "text-blue-400", bg: "bg-blue-500/10" },
            { label: "Opens", value: totalOpens, icon: MailOpen, color: "text-green-400", bg: "bg-green-500/10" },
            { label: "Clicks", value: totalClicks, icon: MousePointer, color: "text-orange-400", bg: "bg-orange-500/10" },
          ].map((s) => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-white">{s.value.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Campaign list */}
      {campaigns.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 text-center">
          <Send className="w-10 h-10 text-slate-700 mx-auto mb-4" />
          <p className="text-white font-semibold text-lg mb-2">No campaigns yet</p>
          <p className="text-slate-400 text-sm mb-6">
            Run a scan to discover leads, then create your first outreach campaign.
          </p>
          <Link href="/scan" className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl text-sm transition-colors">
            Start Scanning
          </Link>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="divide-y divide-slate-800">
            {campaigns.map((c) => {
              const openRate = c.sentCount > 0 ? Math.round((c.openCount / c.sentCount) * 100) : 0;
              return (
                <Link
                  key={c.id}
                  href={`/outreach/${c.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
                    <Send className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-white font-medium text-sm truncate">{c.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLE[c.status] ?? ""}`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{c.subject}</p>
                  </div>
                  <div className="hidden md:flex items-center gap-6 text-center shrink-0">
                    <div>
                      <p className="text-white font-bold text-sm">{c._count.leads}</p>
                      <p className="text-xs text-slate-500">leads</p>
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{c.sentCount}</p>
                      <p className="text-xs text-slate-500">sent</p>
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${openRate >= 30 ? "text-green-400" : "text-white"}`}>
                        {openRate}%
                      </p>
                      <p className="text-xs text-slate-500">open rate</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
