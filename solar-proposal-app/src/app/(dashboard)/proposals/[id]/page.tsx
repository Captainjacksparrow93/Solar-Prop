import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { ProposalView } from "@/components/proposals/ProposalView";

export const dynamic = "force-dynamic";

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const proposal = await db.proposal.findUnique({
    where: { id },
    include: {
      lead: { include: { solarAnalysis: true } },
      user: { include: { company: true } },
    },
  });

  if (!proposal) notFound();

  return <ProposalView proposal={proposal} editable />;
}
