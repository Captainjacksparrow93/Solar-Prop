export interface SolarInputs {
  panelCount: number;
  panelWattage: number;             // W per panel
  usableSunshineHoursPerYear: number;
  electricityRate: number;          // $/kWh
  panelCostPerWatt: number;         // $ per watt installed
  incentivePercent: number;         // 0-100
  carbonOffsetFactorKgPerMwh?: number;
}

export interface SolarFinancials {
  systemCapacityKw: number;
  annualOutputKwh: number;
  annualSavingsUsd: number;
  systemCostUsd: number;
  incentiveAmountUsd: number;
  netCostUsd: number;
  paybackYears: number;
  roiPercent: number;           // 25-year ROI
  co2OffsetTonsPerYear: number;
  monthlyOutputKwh: number;
  monthlySavingsUsd: number;
}

export function calculateSolarFinancials(inputs: SolarInputs): SolarFinancials {
  const {
    panelCount,
    panelWattage,
    usableSunshineHoursPerYear,
    electricityRate,
    panelCostPerWatt,
    incentivePercent,
    carbonOffsetFactorKgPerMwh = 400,
  } = inputs;

  const systemCapacityKw = (panelCount * panelWattage) / 1000;

  // Annual output: capacity (kW) × sunshine hours × efficiency factor (0.8 for real-world)
  const annualOutputKwh = systemCapacityKw * usableSunshineHoursPerYear * 0.8;

  const annualSavingsUsd = annualOutputKwh * electricityRate;
  const monthlySavingsUsd = annualSavingsUsd / 12;
  const monthlyOutputKwh = annualOutputKwh / 12;

  const systemCostUsd = systemCapacityKw * 1000 * panelCostPerWatt;
  const incentiveAmountUsd = systemCostUsd * (incentivePercent / 100);
  const netCostUsd = systemCostUsd - incentiveAmountUsd;

  // Payback period in years
  const paybackYears = netCostUsd / annualSavingsUsd;

  // 25-year ROI
  const totalSavings25yr = annualSavingsUsd * 25;
  const roiPercent = ((totalSavings25yr - netCostUsd) / netCostUsd) * 100;

  // CO2 offset
  const co2OffsetTonsPerYear = (annualOutputKwh * carbonOffsetFactorKgPerMwh) / 1_000_000;

  return {
    systemCapacityKw,
    annualOutputKwh,
    annualSavingsUsd,
    systemCostUsd,
    incentiveAmountUsd,
    netCostUsd,
    paybackYears,
    roiPercent,
    co2OffsetTonsPerYear,
    monthlyOutputKwh,
    monthlySavingsUsd,
  };
}
