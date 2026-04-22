import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";
import { NewProposalClient } from "@/components/proposals/NewProposalClient";

export const dynamic = "force-dynamic";

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const { leadId } = await searchParams;
  const userId = await getDefaultUserId();

  const [leads, company] = await Promise.all([
    db.lead.findMany({
      where: { status: "ANALYZED" },
      include: { solarAnalysis: true },
      orderBy: { businessName: "asc" },
    }),
    db.company.findUnique({ where: { userId } }),
  ]);

  const preselectedLead = leadId ? (leads.find((l) => l.id === leadId) ?? null) : null;

  return (
    <NewProposalClient
      leads={leads}
      preselectedLead={preselectedLead}
      company={company}
    />
  );
}
