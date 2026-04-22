import { db } from "@/lib/db";
import { ProposalsAdminClient } from "@/components/admin/ProposalsAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminProposalsPage() {
  const proposals = await db.proposal.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      lead: { select: { businessName: true } },
      user: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Proposals</h1>
        <span className="text-sm text-slate-400">{proposals.length} total</span>
      </div>
      <ProposalsAdminClient initialProposals={proposals} />
    </div>
  );
}
