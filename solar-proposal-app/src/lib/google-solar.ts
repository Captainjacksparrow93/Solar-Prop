/**
 * Google Solar API — Building Insights
 * https://developers.google.com/maps/documentation/solar/reference/rest/v1/buildingInsights/findClosest
 *
 * Falls back to a coordinate-based estimate when the API is unavailable.
 */

export interface SolarBuildingInsights {
  roofAreaSqM: number;
  maxPanelCount: number;
  usableSunshineHoursPerYear: number;
  carbonOffsetFactorKgPerMwh: number;
  center: { lat: number; lng: number };
  roofSegments: RoofSegment[];
  rawData: unknown;
  /** true when values were estimated locally (no Google Solar API) */
  isEstimated?: boolean;
}

export interface RoofSegment {
  pitchDegrees: number;
  azimuthDegrees: number;
  areaSqM: number;
  center: { lat: number; lng: number };
  solarPotential?: {
    maxSunshineHoursPerYear: number;
    panelCapacityWatts: number;
    panelCount: number;
  };
}

export async function getBuildingInsights(
  lat: number,
  lng: number
): Promise<SolarBuildingInsights> {
  const apiKey = process.env.GOOGLE_SOLAR_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_SOLAR_API_KEY not configured");

  const url = new URL("https://solar.googleapis.com/v1/buildingInsights:findClosest");
  url.searchParams.set("location.latitude", lat.toString());
  url.searchParams.set("location.longitude", lng.toString());
  url.searchParams.set("requiredQuality", "LOW");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Solar API error: ${err}`);
  }

  const data = await res.json();
  return parseBuildingInsights(data);
}

function parseBuildingInsights(data: GoogleSolarResponse): SolarBuildingInsights {
  const sp = data.solarPotential;

  const roofSegments: RoofSegment[] = (sp?.roofSegmentStats ?? []).map(
    (seg: RoofSegmentStat) => ({
      pitchDegrees: seg.pitchDegrees ?? 0,
      azimuthDegrees: seg.azimuthDegrees ?? 0,
      areaSqM: seg.stats?.areaMeters2 ?? 0,
      center: {
        lat: seg.center?.latitude ?? 0,
        lng: seg.center?.longitude ?? 0,
      },
    })
  );

  // Use the best panel configuration available
  const bestConfig = sp?.solarPanelConfigs?.[sp.solarPanelConfigs.length - 1];

  return {
    roofAreaSqM: sp?.wholeRoofStats?.areaMeters2 ?? 0,
    maxPanelCount: sp?.maxArrayPanelsCount ?? bestConfig?.panelsCount ?? 0,
    usableSunshineHoursPerYear: sp?.maxSunshineHoursPerYear ?? 1600,
    carbonOffsetFactorKgPerMwh: sp?.carbonOffsetFactorKgPerMwh ?? 400,
    center: {
      lat: data.center?.latitude ?? 0,
      lng: data.center?.longitude ?? 0,
    },
    roofSegments,
    rawData: data,
  };
}

// ─── Coordinate-based solar estimate (fallback when API unavailable) ──────────

/**
 * Estimates sunshine hours from absolute latitude.
 * Based on typical global horizontal irradiance data.
 */
function estimateSunshineHours(lat: number): number {
  const absLat = Math.abs(lat);
  if (absLat < 10)  return 2400; // Tropical
  if (absLat < 20)  return 2200;
  if (absLat < 30)  return 2000;
  if (absLat < 35)  return 1900;
  if (absLat < 40)  return 1800;
  if (absLat < 45)  return 1650;
  if (absLat < 50)  return 1500;
  if (absLat < 55)  return 1250;
  if (absLat < 60)  return 1000;
  return 800;
}

/**
 * Estimates max panel count from roof area.
 * Uses 2m × 1m panels, 72% usable roof fraction (accounting for HVAC, edges).
 * Panel spacing: 15% gap → effective area per panel = 2.0 × 1.0 × 1.15 = 2.3 sq m
 */
export function panelsFromArea(roofAreaSqM: number): number {
  const usable = roofAreaSqM * 0.72;
  return Math.max(1, Math.floor(usable / 2.3));
}

/**
 * Estimates solar potential purely from lat/lng.
 * Used when Google Solar API is blocked or unavailable.
 */
export function estimateSolarFromCoords(
  lat: number,
  lng: number,
  roofAreaSqM = 800, // conservative default for commercial building
): SolarBuildingInsights {
  const sunshineHours = estimateSunshineHours(lat);
  const maxPanelCount = panelsFromArea(roofAreaSqM);

  return {
    roofAreaSqM,
    maxPanelCount,
    usableSunshineHoursPerYear: sunshineHours,
    carbonOffsetFactorKgPerMwh: 400,
    center: { lat, lng },
    roofSegments: [],
    rawData: null,
    isEstimated: true,
  };
}

// ─── Google Solar API ─────────────────────────────────────────────────────────

// Google Solar API response types
interface GoogleSolarResponse {
  center?: { latitude: number; longitude: number };
  solarPotential?: {
    maxArrayPanelsCount?: number;
    maxSunshineHoursPerYear?: number;
    carbonOffsetFactorKgPerMwh?: number;
    wholeRoofStats?: { areaMeters2: number };
    roofSegmentStats?: RoofSegmentStat[];
    solarPanelConfigs?: { panelsCount: number; yearlyEnergyDcKwh: number }[];
  };
}

interface RoofSegmentStat {
  pitchDegrees?: number;
  azimuthDegrees?: number;
  stats?: { areaMeters2: number };
  center?: { latitude: number; longitude: number };
}
