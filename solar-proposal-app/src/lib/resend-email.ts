/**
 * Resend email client + HTML template builder for outreach campaigns.
 */

import { Resend } from "resend";

export function getResendClient(apiKey: string): Resend {
  return new Resend(apiKey);
}

interface EmailData {
  businessName: string;
  ownerName: string | null;
  address: string;
  annualSavingsUsd: number | null;
  panelCount: number | null;
  paybackYears: number | null;
  roiPercent: number | null;
  systemCapacityKw: number | null;
  animationUrl: string | null;
  calendlyLink: string;
  previewPageUrl: string;
  companyName: string;
  fromName: string;
}

export function buildOutreachEmail(data: EmailData): string {
  const {
    businessName,
    ownerName,
    address,
    annualSavingsUsd,
    panelCount,
    paybackYears,
    roiPercent,
    systemCapacityKw,
    animationUrl,
    calendlyLink,
    previewPageUrl,
    companyName,
    fromName,
  } = data;

  const greeting = ownerName ? `Hi ${ownerName.split(" ")[0]},` : "Hello,";
  const savingsFormatted = annualSavingsUsd
    ? `₹${Math.round(annualSavingsUsd).toLocaleString("en-IN")}`
    : "significant savings";
  const capacityText = systemCapacityKw ? `${systemCapacityKw.toFixed(1)} kW ` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your Roof, Solar-Powered</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#f97316,#ea580c);padding:32px 40px;">
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);text-transform:uppercase;letter-spacing:1px;">${companyName}</p>
            <h1 style="margin:8px 0 0;font-size:26px;color:#ffffff;line-height:1.3;">
              We mapped solar panels<br/>on <strong>${businessName}</strong>
            </h1>
          </td>
        </tr>

        <!-- Animation image -->
        ${
          animationUrl
            ? `<tr><td style="padding:0;">
                <a href="${previewPageUrl}" style="display:block;">
                  <img src="${animationUrl}" alt="Solar panels on ${businessName}" width="600"
                       style="display:block;width:100%;border:0;"/>
                </a>
              </td></tr>`
            : ""
        }

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="font-size:16px;color:#334155;line-height:1.6;margin:0 0 20px;">
              ${greeting}
            </p>
            <p style="font-size:16px;color:#334155;line-height:1.6;margin:0 0 24px;">
              We analysed the rooftop at <strong>${address}</strong> and found a strong opportunity
              to cut electricity costs significantly with solar.
            </p>

            <!-- Stats grid -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td width="50%" style="padding:16px;background:#fff7ed;border-radius:8px;text-align:center;">
                  <p style="margin:0;font-size:28px;font-weight:bold;color:#f97316;">${savingsFormatted}</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Annual savings</p>
                </td>
                <td width="4px"></td>
                <td width="50%" style="padding:16px;background:#f0fdf4;border-radius:8px;text-align:center;">
                  <p style="margin:0;font-size:28px;font-weight:bold;color:#22c55e;">${panelCount ?? "—"}</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Solar panels</p>
                </td>
              </tr>
              <tr><td height="8" colspan="3"></td></tr>
              <tr>
                <td style="padding:16px;background:#f8fafc;border-radius:8px;text-align:center;">
                  <p style="margin:0;font-size:22px;font-weight:bold;color:#3b82f6;">${capacityText}system</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#64748b;">System capacity</p>
                </td>
                <td width="4px"></td>
                <td style="padding:16px;background:#f8fafc;border-radius:8px;text-align:center;">
                  <p style="margin:0;font-size:22px;font-weight:bold;color:#8b5cf6;">${paybackYears ? `${Math.round(paybackYears)} yrs` : "—"}</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Payback period</p>
                </td>
              </tr>
            </table>

            <p style="font-size:15px;color:#64748b;line-height:1.6;margin:0 0 28px;">
              This is a no-obligation analysis. We'd love to walk you through the full numbers
              and answer any questions in a quick 15-minute call.
            </p>

            <!-- CTA buttons -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="border-radius:8px;background:#f97316;">
                  <a href="${calendlyLink}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">
                    📅 Book a Free 15-Min Call
                  </a>
                </td>
              </tr>
            </table>
            <p style="text-align:center;margin:0 0 8px;">
              <a href="${previewPageUrl}" style="font-size:13px;color:#f97316;text-decoration:none;">
                🎬 Watch panels appear on your roof →
              </a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              Sent by ${fromName} · ${companyName}<br/>
              <a href="{{unsubscribe_url}}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendOutreachEmail(opts: {
  apiKey: string;
  to: string;
  subject: string;
  html: string;
  fromName: string;
  fromEmail: string;
}): Promise<{ id: string }> {
  const client = getResendClient(opts.apiKey);
  const result = await client.emails.send({
    from: `${opts.fromName} <${opts.fromEmail}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });

  if (result.error) throw new Error(result.error.message);
  return { id: result.data!.id };
}
