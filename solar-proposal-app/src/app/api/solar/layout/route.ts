import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { leadId, layout, osmGeometry } = await req.json();

  if (!leadId || !Array.isArray(layout)) {
    return NextResponse.json({ error: "leadId and layout array required" }, { status: 400 });
  }

  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch existing panelLayout so we can preserve any osmGeometry that was
  // stored during scanning — the canvas editor only sends { layout, osmGeometry }
  // and we don't want to lose the polygon when saving panel positions.
  const existing = await db.solarAnalysis.findUnique({
    where: { leadId },
    select: { panelLayout: true },
  });
  const existingLayout = (existing?.panelLayout ?? {}) as Record<string, unknown>;
  const preservedOsm = osmGeometry ?? existingLayout.osmGeometry ?? null;

  await db.solarAnalysis.upsert({
    where:  { leadId },
    create: {
      leadId,
      panelLayout: { panels: layout, osmGeometry: preservedOsm } as never,
      panelCount:  layout.length,
    },
    update: {
      panelLayout: { panels: layout, osmGeometry: preservedOsm } as never,
      panelCount:  layout.length,
    },
  });

  return NextResponse.json({ success: true, panelCount: layout.length });
}
