import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  const lead = await db.lead.findUnique({
    where: { id },
    include: { solarAnalysis: true, proposals: true },
  });

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();

  const lead = await db.lead.updateMany({
    where: { id },
    data: body,
  });

  if (!lead.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  await db.lead.deleteMany({ where: { id } });
  return NextResponse.json({ success: true });
}
