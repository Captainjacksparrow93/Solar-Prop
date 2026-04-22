import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const leads = await db.lead.findMany({
    where: status ? { status: status as never } : {},
    include: { solarAnalysis: true, proposals: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(leads);
}

export async function DELETE(req: NextRequest) {
  const { ids } = await req.json();
  if (!Array.isArray(ids)) return NextResponse.json({ error: "ids array required" }, { status: 400 });

  await db.lead.deleteMany({
    where: { id: { in: ids } },
  });

  return NextResponse.json({ deleted: ids.length });
}
