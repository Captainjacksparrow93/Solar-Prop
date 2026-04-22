import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Tracking pixel endpoint — called when email is opened or link clicked.
// Usage: embed <img src="/api/outreach/track?event=open&cl=CAMPAIGN_LEAD_ID"/>
// and wrap CTAs: /api/outreach/track?event=click&cl=ID&redirect=CALENDLY_URL

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const event = searchParams.get("event"); // "open" | "click"
  const clId = searchParams.get("cl");
  const redirect = searchParams.get("redirect");

  if (clId) {
    try {
      if (event === "open") {
        await db.campaignLead.updateMany({
          where: { id: clId, status: "SENT" },
          data: { status: "OPENED", openedAt: new Date() },
        });
        // Increment campaign open count
        const cl = await db.campaignLead.findUnique({ where: { id: clId } });
        if (cl) {
          await db.outreachCampaign.update({
            where: { id: cl.campaignId },
            data: { openCount: { increment: 1 } },
          });
        }
      } else if (event === "click") {
        await db.campaignLead.updateMany({
          where: { id: clId, status: { in: ["SENT", "OPENED"] } },
          data: { status: "CLICKED", clickedAt: new Date() },
        });
        const cl = await db.campaignLead.findUnique({ where: { id: clId } });
        if (cl) {
          await db.outreachCampaign.update({
            where: { id: cl.campaignId },
            data: { clickCount: { increment: 1 } },
          });
        }
      }
    } catch {
      // Silent — tracking should never break email flow
    }
  }

  if (redirect) {
    return NextResponse.redirect(redirect);
  }

  // Return 1x1 transparent GIF for open pixel
  const gif = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );
  return new NextResponse(gif, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
