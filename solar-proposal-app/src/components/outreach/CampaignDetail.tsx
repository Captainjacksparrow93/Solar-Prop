"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, Send, Loader2, Mail, MailOpen,
  MousePointer, Calendar, CheckCircle, XCircle, Clock,
} from "lucide-react";
import { toast } from "@/components/ui/Toaster";
import { formatCurrency } from "@/lib/utils";

interface Lead {
  id: string;
  businessName: string;
  address: string;
  ownerName: string | null;
  ownerEmail: string | null;
  animationUrl: string | null;
  solarAnalysis: { annualSavingsUsd: number | null; panelCount: number | null } | null;
}

interface CampaignLead {
  id: string;
  status: string;
  sentAt: Date | string | null;
  openedAt: Date | string | null;
  clickedAt: Date | string | null;
  bookedAt: Date | string | null;
  lead: Lead;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  subject: string;
  sentCount: number;
  openCount: number;
  clickCount: number;
  calendlyLink: string | null;
  fromEmail: string | null;
  fromName: string | null;
  leads: CampaignLead[];
}

interface Props { campaign: Campaign }

const STATUS_ICON: Record<string, React.ReactNode> = {
  QUEUED: <Clock className="w-4 h-4 text-slate-500" />,
  SENT: <Mail className="w-4 h-4 text-blue-400" />,
  OPENED: <MailOpen className="w-4 h-4 text-green-400" />,
  CLICKED: <MousePointer className="w-4 h-4 text-orange-400" />,
  BOOKED: <Calendar className="w-4 h-4 text-purple-400" />,
  BOUNCED: <XCircle className="w-4 h-4 text-red-400" />,
};

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  SENT: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  OPENED: "text-green-400 bg-green-500/10 border-green-500/20",
  CLICKED: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  BOOKED: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  BOUNCED: "text-red-400 bg-red-500/10 border-red-500/20",
};

export function CampaignDetail({ campaign: initial }: Props) {
  const [campaign, setCampaign] = useState(initial);
  const [sending, setSending] = useState(false);

  const queuedCount = campaign.leads.filter((l) => l.status === "QUEUED").length;
  const openRate = campaign.sentCount > 0
    ? Math.round((campaign.openCount / campaign.sentCount) * 100)
    : 0;
  const clickRate = campaign.sentCount > 0
    ? Math.round((campaign.clickCount / campaign.sentCount) * 100)
    : 0;

  async function sendCampaign() {
    setSending(true);
    try {
      const res = await fetch(`/api/outreach/campaigns/${campaign.id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Send failed", "error"); return; }
      toast(`Sent ${data.sent} emails!`, "success");
      const r = await fetch(`/api/outreach/campaigns/${campaign.id}`);
      const d = await r.json();
      if (d.campaign) setCampaign(d.campaign);
    } catch { toast("Network error", "error"); }
    finally { setSending(false); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link href="/outreach" className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-2 transition-colors">
            <ChevronLeft className="w-4 h-4" />Outreach
          </Link>
          <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
          <p className="text-slate-400 text-sm mt-1 truncate max-w-xl">Subject: {campaign.subject}</p>
        </div>
        <button
          onClick={sendCampaign}
          disabled={sending || queuedCount === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-colors"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Sending..." : `Send to ${queuedCount} queued`}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Leads", value: campaign.leads.length, icon: CheckCircle, color: "text-slate-400" },
          { label: "Emails Sent", value: campaign.sentCount, icon: Mail, color: "text-blue-400" },
          { label: "Open Rate", value: `${openRate}%`, icon: MailOpen, color: "text-green-400" },
          { label: "Click Rate", value: `${clickRate}%`, icon: MousePointer, color: "text-orange-400" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Leads table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-white">Leads in Campaign</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Business</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Owner</th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">Savings/yr</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-left hidden xl:table-cell">Visual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {campaign.leads.map((cl) => (
              <tr key={cl.id} className="hover:bg-slate-800/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-white font-medium text-sm">{cl.lead.businessName}</p>
                  <p className="text-xs text-slate-500">{cl.lead.address}</p>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {cl.lead.ownerName
                    ? <p className="text-slate-300 text-xs">{cl.lead.ownerName}</p>
                    : <p className="text-slate-600 text-xs">Unknown</p>}
                  {cl.lead.ownerEmail && (
                    <p className="text-slate-500 text-xs truncate max-w-36">{cl.lead.ownerEmail}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right hidden lg:table-cell text-emerald-400 font-medium">
                  {cl.lead.solarAnalysis?.annualSavingsUsd
                    ? formatCurrency(cl.lead.solarAnalysis.annualSavingsUsd)
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1.5">
                    {STATUS_ICON[cl.status]}
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_LABEL[cl.status] ?? ""}`}>
                      {cl.status}
                    </span>
                  </div>
                  {cl.sentAt && (
                    <p className="text-xs text-slate-600 text-center mt-0.5">
                      {new Date(cl.sentAt as string).toLocaleDateString()}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  {cl.lead.animationUrl ? (
                    <a href={cl.lead.animationUrl} target="_blank" rel="noreferrer"
                      className="text-xs text-orange-400 hover:text-orange-300 underline">View</a>
                  ) : <span className="text-slate-600 text-xs">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
