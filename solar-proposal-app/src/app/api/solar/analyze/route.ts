import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";
import { getBuildingInsights, estimateSolarFromCoords, panelsFromArea } from "@/lib/google-solar";
import { calculateSolarFinancials } from "@/lib/proposal-calculator";

export async function POST(req: NextRequest) {
  const userId = await getDefaultUserId();

  const {
    leadId,
    panelCount,
    panelWattage,
    electricityRate,
    panelCostPerWatt,
    incentivePercent,
    roofAreaSqM: requestedRoofArea,
  } = await req.json();

  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { solarAnalysis: true },
  });

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!lead.lat || !lead.lng) {
    return NextResponse.json({ error: "Lead has no coordinates" }, { status: 400 });
  }

  const company = await db.company.findUnique({ where: { userId } });

  const effectivePanelWattage     = panelWattage     ?? company?.defaultPanelWattage     ?? 400;
  const effectiveElectricityRate  = electricityRate  ?? company?.defaultElectricityRate  ?? 0.12;
  const effectivePanelCostPerWatt = panelCostPerWatt ?? company?.defaultPanelCostPerWatt ?? 2.5;
  const effectiveIncentivePercent = incentivePercent ?? company?.defaultIncentivePercent ?? 30;

  await db.lead.update({ where: { id: leadId }, data: { status: "ANALYZING" } });

  try {
    // ── Try Google Solar API; fall back to coordinate-based estimate on failure ──
    let solarData;
    let isEstimated = false;

    try {
      solarData = await getBuildingInsights(lead.lat, lead.lng);
    } catch (apiErr) {
      const msg = apiErr instanceof Error ? apiErr.message : "";
      // Fallback when API key is blocked, missing, or quota exceeded
      if (
        msg.includes("403") ||
        msg.includes("PERMISSION_DENIED") ||
        msg.includes("API_KEY") ||
        msg.includes("blocked") ||
        msg.includes("GOOGLE_SOLAR_API_KEY not configured")
      ) {
        // Use requested area, previously stored area, or 800 sq m default
        const fallbackArea =
          requestedRoofArea ??
          lead.solarAnalysis?.userInputRoofAreaSqM ??
          lead.solarAnalysis?.roofAreaSqM ??
          800;

        solarData = estimateSolarFromCoords(lead.lat, lead.lng, fallbackArea);
        isEstimated = true;
      } else {
        throw apiErr;
      }
    }

    // ── Panel count: user override > calculated from roof area > API max ───────
    // Never cap at the old 50-panel limit — commercial roofs can support 500+
    const maxPanels = solarData.maxPanelCount;
    const effectivePanelCount =
      panelCount != null
        ? Math.max(1, Math.min(panelCount, 5000))
        : maxPanels;

    const financials = calculateSolarFinancials({
      panelCount: effectivePanelCount,
      panelWattage: effectivePanelWattage,
      usableSunshineHoursPerYear: solarData.usableSunshineHoursPerYear,
      electricityRate: effectiveElectricityRate,
      panelCostPerWatt: effectivePanelCostPerWatt,
      incentivePercent: effectiveIncentivePercent,
      carbonOffsetFactorKgPerMwh: solarData.carbonOffsetFactorKgPerMwh,
    });

    const analysisData = {
      roofAreaSqM:                solarData.roofAreaSqM,
      maxPanelCount:              maxPanels,
      usableSunshineHoursPerYear: solarData.usableSunshineHoursPerYear,
      carbonOffsetFactorKgPerMwh: solarData.carbonOffsetFactorKgPerMwh,
      panelCount:                 effectivePanelCount,
      panelWattage:               effectivePanelWattage,
      systemCapacityKw:           financials.systemCapacityKw,
      annualOutputKwh:            financials.annualOutputKwh,
      annualSavingsUsd:           financials.annualSavingsUsd,
      systemCostUsd:              financials.systemCostUsd,
      incentiveAmountUsd:         financials.incentiveAmountUsd,
      netCostUsd:                 financials.netCostUsd,
      paybackYears:               financials.paybackYears,
      roiPercent:                 financials.roiPercent,
      co2OffsetTonsPerYear:       financials.co2OffsetTonsPerYear,
      rawSolarData:               solarData.rawData as never,
      // Persist the roof area the user provided (for re-analysis)
      userInputRoofAreaSqM:       requestedRoofArea ?? null,
    };

    const analysis = await db.solarAnalysis.upsert({
      where:  { leadId },
      update: analysisData,
      create: { leadId, ...analysisData },
    });

    await db.lead.update({ where: { id: leadId }, data: { status: "ANALYZED" } });

    return NextResponse.json({
      analysis,
      financials,
      solarData,
      isEstimated,
      ...(isEstimated && {
        warning:
          "Google Solar API unavailable — savings estimated from latitude & roof area. " +
          "Enter your actual roof area below for a more accurate calculation.",
      }),
    });
  } catch (err) {
    await db.lead.update({ where: { id: leadId }, data: { status: "NEW" } });
    console.error(err);
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
