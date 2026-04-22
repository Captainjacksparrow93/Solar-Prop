import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getDefaultUserId();
  const campaigns = await db.outreachCampaign.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true } } },
  });
  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const userId = await getDefaultUserId();
  const body = await req.json();
  const { name, subject, bodyTemplate, calendlyLink, fromName, fromEmail, leadIds } = body;

  if (!name || !subject || !bodyTemplate) {
    return NextResponse.json({ error: "name, subject, bodyTemplate required" }, { status: 400 });
  }

  const campaign = await db.outreachCampaign.create({
    data: {
      userId,
      name,
      subject,
      bodyTemplate,
      calendlyLink: calendlyLink ?? null,
      fromName: fromName ?? null,
      fromEmail: fromEmail ?? null,
      leads: leadIds?.length
        ? { create: (leadIds as string[]).map((id: string) => ({ leadId: id })) }
        : undefined,
    },
    include: { _count: { select: { leads: true } } },
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
