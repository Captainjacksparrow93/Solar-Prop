import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { LiveActivityDashboard } from "@/components/scan/LiveActivityDashboard";

export const dynamic = "force-dynamic";

export default async function ScanJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  const job = await db.scanJob.findUnique({ where: { id: jobId } });
  if (!job) notFound();

  const leads = await db.lead.findMany({
    where: { scanJobId: jobId },
    include: { solarAnalysis: true },
    orderBy: [{ roofScore: "desc" }, { createdAt: "asc" }],
  });

  return (
    <LiveActivityDashboard
      jobId={job.id}
      jobName={job.name}
      jobStatus={job.status}
      initialLeads={leads as any}
    />
  );
}
