import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  const proposal = await db.proposal.findUnique({
    where: { id },
    include: {
      lead: { include: { solarAnalysis: true } },
      user: { include: { company: true } },
    },
  });

  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(proposal);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();

  const result = await db.proposal.updateMany({
    where: { id },
    data: body,
  });

  if (!result.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  await db.proposal.deleteMany({ where: { id } });
  return NextResponse.json({ success: true });
}
