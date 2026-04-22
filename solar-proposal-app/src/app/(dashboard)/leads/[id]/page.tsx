import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";
import { notFound } from "next/navigation";
import { LeadDetailClient } from "@/components/leads/LeadDetailClient";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getDefaultUserId();

  const [lead, company] = await Promise.all([
    db.lead.findUnique({
      where: { id },
      include: { solarAnalysis: true, proposals: { orderBy: { createdAt: "desc" } } },
    }),
    db.company.findUnique({ where: { userId } }),
  ]);

  if (!lead) notFound();

  return <LeadDetailClient lead={lead} company={company} />;
}
