import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";
import { buildOutreachEmail, sendOutreachEmail } from "@/lib/resend-email";

export const maxDuration = 300;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getDefaultUserId();
  const { id } = await params;

  const campaign = await db.outreachCampaign.findUnique({
    where: { id },
    include: {
      leads: {
        where: { status: "QUEUED" },
        include: { lead: { include: { solarAnalysis: true } } },
      },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const company = await db.company.findUnique({ where: { userId } });
  const resendApiKey = company?.resendApiKey ?? process.env.RESEND_API_KEY;
  const fromEmail = campaign.fromEmail ?? company?.fromEmail ?? process.env.RESEND_FROM_EMAIL ?? "";
  const fromName = campaign.fromName ?? company?.fromName ?? company?.name ?? "SolarPropose";
  const calendlyLink = campaign.calendlyLink ?? company?.calendlyLink ?? "#";

  if (!resendApiKey) {
    return NextResponse.json({ error: "Resend API key not configured. Add it in Settings." }, { status: 400 });
  }
  if (!fromEmail) {
    return NextResponse.json({ error: "From email not configured." }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://solar-prop-one.vercel.app";

  let sent = 0;
  let failed = 0;

  for (const cl of campaign.leads) {
    const lead = cl.lead;
    const analysis = lead.solarAnalysis;
    const toEmail = lead.ownerEmail ?? lead.website; // best available contact

    if (!toEmail) {
      failed++;
      continue;
    }

    try {
      // Use on-demand visual URL (no Blob storage needed)
      const animationUrl = lead.animationUrl ?? (lead.lat ? `/api/leads/${lead.id}/visual` : null);
      if (!lead.animationUrl && animationUrl) {
        await db.lead.update({ where: { id: lead.id }, data: { animationUrl } });
      }

      const previewUrl = `${appUrl}/preview/${lead.id}`;
      const html = buildOutreachEmail({
        businessName: lead.businessName,
        ownerName: lead.ownerName,
        address: lead.address,
        annualSavingsUsd: analysis?.annualSavingsUsd ?? null,
        panelCount: analysis?.panelCount ?? null,
        paybackYears: analysis?.paybackYears ?? null,
        roiPercent: analysis?.roiPercent ?? null,
        systemCapacityKw: analysis?.systemCapacityKw ?? null,
        animationUrl,
        calendlyLink,
        previewPageUrl: previewUrl,
        companyName: company?.name ?? "SolarPropose",
        fromName,
      });

      const result = await sendOutreachEmail({
        apiKey: resendApiKey,
        to: toEmail,
        subject: campaign.subject.replace("{{businessName}}", lead.businessName),
        html,
        fromName,
        fromEmail,
      });

      await db.campaignLead.update({
        where: { id: cl.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          resendId: result.id,
          animationUrl: animationUrl ?? undefined,
        },
      });

      sent++;
    } catch (err) {
      console.error(`Failed to send to lead ${lead.id}:`, err);
      await db.campaignLead.update({
        where: { id: cl.id },
        data: { status: "BOUNCED" },
      });
      failed++;
    }
  }

  await db.outreachCampaign.update({
    where: { id },
    data: {
      sentCount: { increment: sent },
      status: sent > 0 ? "ACTIVE" : undefined,
    },
  });

  return NextResponse.json({ sent, failed, total: campaign.leads.length });
}
