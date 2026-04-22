/**
 * Phase 2 — Score a batch of unscored leads in a job.
 * Tries Google Solar API; falls back to coordinate-based estimate on failure.
 * Panel count derived from roof area (2m × 1m panels, 72% usable fraction).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";
import { getBuildingInsights, estimateSolarFromCoords, panelsFromArea } from "@/lib/google-solar";
import { calculateSolarFinancials } from "@/lib/proposal-calculator";
import { normaliseBatch } from "@/lib/roof-scorer";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const userId = await getDefaultUserId();
  const { jobId } = await params;

  const job = await db.scanJob.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const BATCH = 5;
  const unscored = await db.lead.findMany({
    where: { scanJobId: jobId, roofScore: null, lat: { not: null }, lng: { not: null } },
    take: BATCH,
    orderBy: { createdAt: "asc" },
  });

  const remaining = await db.lead.count({
    where: { scanJobId: jobId, roofScore: null },
  });

  if (unscored.length === 0) {
    await db.scanJob.update({ where: { id: jobId }, data: { status: "COMPLETED" } });
    return NextResponse.json({ scored: 0, remaining: 0, leads: [] });
  }

  const company = await db.company.findUnique({ where: { userId } });
  // Fallbacks are INR-denominated Indian market defaults
  const electricityRate  = company?.defaultElectricityRate  ?? 9.0;
  const panelWattage     = company?.defaultPanelWattage     ?? 400;
  const panelCostPerWatt = company?.defaultPanelCostPerWatt ?? 45.0;
  const incentivePercent = company?.defaultIncentivePercent ?? 30;

  const scoringInputs: Array<{
    id: string;
    roofAreaSqM: number | null;
    maxPanelCount: number | null;
    usableSunshineHoursPerYear: number | null;
    annualSavingsUsd: number | null;
  }> = [];

  const freshLeads: string[] = [];

  for (const lead of unscored) {
    try {
      // ── Try Google Solar API; fall back to estimate on any failure ─────────
      let solarData;
      try {
        solarData = await getBuildingInsights(lead.lat!, lead.lng!);
      } catch {
        // Fallback: estimate from lat/lng with default commercial roof area
        solarData = estimateSolarFromCoords(lead.lat!, lead.lng!);
      }

      // Panel count from roof area (no artificial 50/200 cap)
      const panelCount = solarData.maxPanelCount > 0
        ? solarData.maxPanelCount
        : panelsFromArea(solarData.roofAreaSqM);

      const financials = calculateSolarFinancials({
        panelCount, panelWattage,
        usableSunshineHoursPerYear: solarData.usableSunshineHoursPerYear,
        electricityRate, panelCostPerWatt, incentivePercent,
        carbonOffsetFactorKgPerMwh: solarData.carbonOffsetFactorKgPerMwh,
      });

      const analysisData = {
        roofAreaSqM:                solarData.roofAreaSqM,
        maxPanelCount:              solarData.maxPanelCount,
        usableSunshineHoursPerYear: solarData.usableSunshineHoursPerYear,
        carbonOffsetFactorKgPerMwh: solarData.carbonOffsetFactorKgPerMwh,
        panelCount, panelWattage,
        systemCapacityKw:     financials.systemCapacityKw,
        annualOutputKwh:      financials.annualOutputKwh,
        annualSavingsUsd:     financials.annualSavingsUsd,
        systemCostUsd:        financials.systemCostUsd,
        incentiveAmountUsd:   financials.incentiveAmountUsd,
        netCostUsd:           financials.netCostUsd,
        paybackYears:         financials.paybackYears,
        roiPercent:           financials.roiPercent,
        co2OffsetTonsPerYear: financials.co2OffsetTonsPerYear,
        rawSolarData:         solarData.rawData as never,
      };

      await db.solarAnalysis.upsert({
        where:  { leadId: lead.id },
        update: analysisData,
        create: { leadId: lead.id, ...analysisData },
      });

      await db.lead.update({
        where: { id: lead.id },
        data: {
          status: "ANALYZED",
          animationUrl: `/api/leads/${lead.id}/visual`,
        },
      });

      scoringInputs.push({
        id: lead.id,
        roofAreaSqM: solarData.roofAreaSqM,
        maxPanelCount: solarData.maxPanelCount,
        usableSunshineHoursPerYear: solarData.usableSunshineHoursPerYear,
        annualSavingsUsd: financials.annualSavingsUsd,
      });

      freshLeads.push(lead.id);
    } catch {
      // Complete failure — assign low priority score so lead is not stuck
      await db.lead.update({
        where: { id: lead.id },
        data: { roofScore: 0, urgencyScore: 0, solarScore: 0, roofScoreLabel: "Low Priority" },
      });
    }
  }

  if (scoringInputs.length > 0) {
    const scoreMap = normaliseBatch(scoringInputs);
    for (const [leadId, score] of scoreMap) {
      await db.lead.update({
        where: { id: leadId },
        data: {
          roofScore:      score.roofScore,
          urgencyScore:   score.urgencyScore,
          solarScore:     score.solarScore,
          roofScoreLabel: score.roofScoreLabel,
        },
      });
    }
  }

  const newRemaining = remaining - unscored.length;
  await db.scanJob.update({
    where: { id: jobId },
    data: {
      totalScored: { increment: scoringInputs.length },
      status: newRemaining <= 0 ? "COMPLETED" : "SCORING",
    },
  });

  const updatedLeads = await db.lead.findMany({
    where: { id: { in: freshLeads } },
    include: { solarAnalysis: true },
  });

  return NextResponse.json({
    scored: unscored.length,
    remaining: Math.max(0, newRemaining),
    leads: updatedLeads,
  });
}
