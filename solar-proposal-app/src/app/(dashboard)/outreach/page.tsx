import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";
import { OutreachDashboard } from "@/components/outreach/OutreachDashboard";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const userId = await getDefaultUserId();
  const campaigns = await db.outreachCampaign.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true } } },
  });

  return <OutreachDashboard campaigns={campaigns} />;
}
