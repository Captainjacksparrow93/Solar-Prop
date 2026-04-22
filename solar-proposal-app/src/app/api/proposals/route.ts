import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";
import crypto from "crypto";

export async function GET() {
  const proposals = await db.proposal.findMany({
    include: { lead: { select: { businessName: true, city: true, address: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(proposals);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { leadId, title, customMessage, validUntil } = body;

  if (!leadId || !title) {
    return NextResponse.json({ error: "leadId and title required" }, { status: 400 });
  }

  const userId = await getDefaultUserId();

  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { solarAnalysis: true },
  });

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const analysis = lead.solarAnalysis;
  const shareToken = crypto.randomBytes(16).toString("hex");

  const proposal = await db.proposal.create({
    data: {
      leadId,
      userId,
      title,
      customMessage,
      validUntil: validUntil ? new Date(validUntil) : null,
      shareToken,
      panelCount: analysis?.panelCount,
      systemCapacityKw: analysis?.systemCapacityKw,
      annualOutputKwh: analysis?.annualOutputKwh,
      annualSavingsUsd: analysis?.annualSavingsUsd,
      systemCostUsd: analysis?.systemCostUsd,
      incentiveAmountUsd: analysis?.incentiveAmountUsd,
      netCostUsd: analysis?.netCostUsd,
      paybackYears: analysis?.paybackYears,
      roiPercent: analysis?.roiPercent,
      co2OffsetTonsPerYear: analysis?.co2OffsetTonsPerYear,
      panelWattage: analysis?.panelWattage,
    },
  });

  await db.lead.update({ where: { id: leadId }, data: { status: "PROPOSAL_SENT" } });

  return NextResponse.json(proposal, { status: 201 });
}
