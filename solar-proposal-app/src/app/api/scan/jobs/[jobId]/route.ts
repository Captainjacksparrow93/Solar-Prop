import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  const job = await db.scanJob.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const leads = await db.lead.findMany({
    where: { scanJobId: jobId },
    include: { solarAnalysis: true },
    orderBy: [{ roofScore: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ job, leads });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const userId = await getDefaultUserId();

  const job = await db.scanJob.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Nullify scanJobId on associated leads (keep leads, just detach from job)
  await db.lead.updateMany({
    where: { scanJobId: jobId },
    data:  { scanJobId: null },
  });

  await db.scanJob.delete({ where: { id: jobId } });

  return NextResponse.json({ ok: true });
}
