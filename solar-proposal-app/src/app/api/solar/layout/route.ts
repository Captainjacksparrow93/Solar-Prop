import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { leadId, layout } = await req.json();

  const lead = await db.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.solarAnalysis.updateMany({
    where: { leadId },
    data: { panelLayout: layout, panelCount: layout.length },
  });

  return NextResponse.json({ success: true });
}
