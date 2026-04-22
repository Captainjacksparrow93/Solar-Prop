import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { ProposalView } from "@/components/proposals/ProposalView";

export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const proposal = await db.proposal.findUnique({
    where: { shareToken: token },
    include: {
      lead: { include: { solarAnalysis: true } },
      user: { include: { company: true } },
    },
  });

  if (!proposal) notFound();

  // Mark as viewed
  if (proposal.status === "SENT") {
    await db.proposal.update({
      where: { id: proposal.id },
      data: { status: "VIEWED" },
    });
  }

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <ProposalView proposal={proposal} editable={false} />
      <p className="text-center text-xs text-gray-400 mt-6">
        Powered by SolarPropose
      </p>
    </div>
  );
}
