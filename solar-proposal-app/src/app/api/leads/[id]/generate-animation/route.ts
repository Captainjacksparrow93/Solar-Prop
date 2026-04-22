import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getDefaultUserId();
  const { id } = await params;

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (lead.userId !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  if (!lead.lat || !lead.lng) return NextResponse.json({ error: "Lead has no coordinates" }, { status: 400 });

  // The visual is served on-demand — just store the route path as the URL
  const animationUrl = `/api/leads/${id}/visual`;
  await db.lead.update({ where: { id }, data: { animationUrl } });

  return NextResponse.json({ animationUrl });
}
