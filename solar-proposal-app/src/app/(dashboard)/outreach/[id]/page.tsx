import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { CampaignDetail } from "@/components/outreach/CampaignDetail";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const campaign = await db.outreachCampaign.findUnique({
    where: { id },
    include: {
      leads: {
        include: { lead: { include: { solarAnalysis: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign) notFound();
  return <CampaignDetail campaign={campaign} />;
}
