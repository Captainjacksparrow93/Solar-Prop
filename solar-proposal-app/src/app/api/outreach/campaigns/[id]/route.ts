import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const campaign = await db.outreachCampaign.findUnique({
    where: { id },
    include: {
      leads: {
        include: {
          lead: { include: { solarAnalysis: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  return NextResponse.json({ campaign });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const campaign = await db.outreachCampaign.update({
    where: { id },
    data: {
      name: body.name,
      subject: body.subject,
      bodyTemplate: body.bodyTemplate,
      calendlyLink: body.calendlyLink,
      fromName: body.fromName,
      fromEmail: body.fromEmail,
      status: body.status,
    },
  });

  return NextResponse.json({ campaign });
}
