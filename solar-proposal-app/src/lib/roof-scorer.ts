/**
 * Roof Scorer — computes a 0–100 priority score for each lead
 * after Google Solar API analysis. Higher = more urgent / higher potential.
 */

export interface RoofScoreInput {
  roofAreaSqM: number | null;
  maxPanelCount: number | null;
  usableSunshineHoursPerYear: number | null;
  annualSavingsUsd: number | null;
}

export interface RoofScoreResult {
  roofScore: number;      // 0–100 composite
  urgencyScore: number;   // 0–100 estimated urgency
  solarScore: number;     // 0–100 solar potential
  roofScoreLabel: "High Priority" | "Medium Priority" | "Low Priority";
}

/**
 * Score a single lead. Pass batchMax values so scores are relative to
 * the rest of the scan batch (normalised). Call normaliseBatch() instead
 * when you have the full batch.
 */
export function scoreLead(
  input: RoofScoreInput,
  batchMax: { panelCount: number; sunshineHours: number; roofArea: number; savings: number }
): RoofScoreResult {
  const panelCount = input.maxPanelCount ?? 0;
  const sunshineHours = input.usableSunshineHoursPerYear ?? 1400;
  const roofArea = input.roofAreaSqM ?? 0;
  const savings = input.annualSavingsUsd ?? 0;

  // Normalise each component to 0–100
  const normPanels = batchMax.panelCount > 0 ? (panelCount / batchMax.panelCount) * 100 : 0;
  const normSunshine = batchMax.sunshineHours > 0 ? (sunshineHours / batchMax.sunshineHours) * 100 : 0;
  const normArea = batchMax.roofArea > 0 ? (roofArea / batchMax.roofArea) * 100 : 0;
  const normSavings = batchMax.savings > 0 ? (savings / batchMax.savings) * 100 : 0;

  // Solar score: weighted combination
  const solarScore = Math.round(
    normPanels * 0.4 + normSunshine * 0.25 + normArea * 0.2 + normSavings * 0.15
  );

  // Urgency score: proxy from roof area size (larger commercial roofs = more urgent)
  // and panel count. Without actual building age data we use a heuristic.
  const urgencyScore = Math.round(Math.min(100, normArea * 0.6 + normPanels * 0.4));

  // Composite score
  const roofScore = Math.round(solarScore * 0.7 + urgencyScore * 0.3);

  const roofScoreLabel: RoofScoreResult["roofScoreLabel"] =
    roofScore >= 70 ? "High Priority" : roofScore >= 40 ? "Medium Priority" : "Low Priority";

  return {
    roofScore: Math.min(100, Math.max(0, roofScore)),
    urgencyScore: Math.min(100, Math.max(0, urgencyScore)),
    solarScore: Math.min(100, Math.max(0, solarScore)),
    roofScoreLabel,
  };
}

/**
 * Score an entire batch — normalises against the batch's own max values.
 */
export function normaliseBatch(
  inputs: (RoofScoreInput & { id: string })[]
): Map<string, RoofScoreResult> {
  const batchMax = {
    panelCount: Math.max(1, ...inputs.map((i) => i.maxPanelCount ?? 0)),
    sunshineHours: Math.max(1, ...inputs.map((i) => i.usableSunshineHoursPerYear ?? 0)),
    roofArea: Math.max(1, ...inputs.map((i) => i.roofAreaSqM ?? 0)),
    savings: Math.max(1, ...inputs.map((i) => i.annualSavingsUsd ?? 0)),
  };

  const out = new Map<string, RoofScoreResult>();
  for (const input of inputs) {
    out.set(input.id, scoreLead(input, batchMax));
  }
  return out;
}

export function scoreLabelColor(label: RoofScoreResult["roofScoreLabel"]): string {
  switch (label) {
    case "High Priority": return "text-red-400 bg-red-500/10 border-red-500/20";
    case "Medium Priority": return "text-orange-400 bg-orange-500/10 border-orange-500/20";
    default: return "text-slate-400 bg-slate-500/10 border-slate-500/20";
  }
}
