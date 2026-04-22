import { db } from "@/lib/db";
import { LeadScraper } from "@/components/leads/LeadScraper";
import { LeadsTable } from "@/components/leads/LeadsTable";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await db.lead.findMany({
    include: { solarAnalysis: { select: { annualSavingsUsd: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Leads</h1>
        <p className="text-slate-400 text-sm mt-1">
          Scrape businesses from Google Maps and manage your solar prospects.
        </p>
      </div>
      <LeadScraper />
      <LeadsTable initialLeads={leads} />
    </div>
  );
}
