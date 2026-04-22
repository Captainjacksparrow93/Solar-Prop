import { db } from "@/lib/db";
import { LeadsAdminClient } from "@/components/admin/LeadsAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  const leads = await db.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Leads</h1>
        <span className="text-sm text-slate-400">{leads.length} total</span>
      </div>
      <LeadsAdminClient initialLeads={leads} />
    </div>
  );
}
