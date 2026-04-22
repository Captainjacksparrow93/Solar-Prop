import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";
import { ScanDashboard } from "@/components/scan/ScanDashboard";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const userId = await getDefaultUserId();
  const jobs = await db.scanJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true } } },
    take: 20,
  });

  return <ScanDashboard initialJobs={jobs} />;
}
