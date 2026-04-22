import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
