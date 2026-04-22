import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";
import { lookupOwner } from "@/lib/attom";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const userId = await getDefaultUserId();
  const { leadIds } = await req.json();

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: "leadIds array required" }, { status: 400 });
  }

  const company = await db.company.findUnique({ where: { userId } });
  const attomApiKey = company?.attomApiKey ?? process.env.ATTOM_API_KEY;

  if (!attomApiKey) {
    return NextResponse.json({ error: "ATTOM API key not configured. Add it in Settings." }, { status: 400 });
  }

  const leads = await db.lead.findMany({ where: { id: { in: leadIds }, userId } });

  let enriched = 0;
  let failed = 0;

  for (const lead of leads) {
    try {
      const ownerInfo = await lookupOwner(lead.address, lead.city, lead.state, attomApiKey);
      if (ownerInfo) {
        await db.lead.update({
          where: { id: lead.id },
          data: {
            ownerName: ownerInfo.ownerName,
            ownerEmail: ownerInfo.ownerEmail,
            ownerPhone: ownerInfo.ownerPhone,
            ownerAddress: ownerInfo.ownerAddress,
            ownerLookupAt: new Date(),
          },
        });
        enriched++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ enriched, failed, total: leads.length });
}
