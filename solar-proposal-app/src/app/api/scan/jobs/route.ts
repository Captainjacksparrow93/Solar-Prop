import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getDefaultUserId();

  const jobs = await db.scanJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { leads: true } },
    },
  });

  return NextResponse.json({ jobs });
}
