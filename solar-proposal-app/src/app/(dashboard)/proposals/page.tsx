import { db } from "@/lib/db";
import { ProposalsList } from "@/components/proposals/ProposalsList";
import Link from "next/link";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  const [proposals, leads] = await Promise.all([
    db.proposal.findMany({
      include: { lead: { select: { businessName: true, city: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.lead.findMany({
      where: { status: "ANALYZED" },
      select: { id: true, businessName: true, city: true },
      orderBy: { businessName: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Proposals</h1>
          <p className="text-slate-400 text-sm mt-1">Generate and manage solar proposals for your leads.</p>
        </div>
        <Link href="/proposals/new" className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl text-sm transition-colors">
          <Plus className="w-4 h-4" />
          New Proposal
        </Link>
      </div>

      <ProposalsList proposals={proposals} analyzedLeads={leads} />
    </div>
  );
}
