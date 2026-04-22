import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildVisualBuffer } from "@/lib/visual-builder";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);

  // Optional user-drawn polygon (JSON array of {x,y} normalised 0-1)
  const polygonParam = searchParams.get("polygon");
  let polygon: Array<{ x: number; y: number }> | null = null;
  if (polygonParam) {
    try { polygon = JSON.parse(decodeURIComponent(polygonParam)); } catch { /* ignore */ }
  }

  const lead = await db.lead.findUnique({
    where: { id },
    include: { solarAnalysis: true },
  });

  if (!lead || !lead.lat || !lead.lng) {
    return new NextResponse("Lead not found or has no coordinates", { status: 404 });
  }

  try {
    const buffer = await buildVisualBuffer({
      lat: lead.lat,
      lng: lead.lng,
      panelCount: lead.solarAnalysis?.panelCount ?? 20,
      roofAreaSqM: lead.solarAnalysis?.roofAreaSqM ?? null,
      annualSavingsUsd: lead.solarAnalysis?.annualSavingsUsd ?? null,
      systemCapacityKw: lead.solarAnalysis?.systemCapacityKw ?? null,
      rawSolarData: lead.solarAnalysis?.rawSolarData ?? null,
      polygon,
    });

    // Cache for 1 hour (not 24h) so re-analyzed buildings get fresh visuals quickly.
    // Polygon requests are never cached — every polygon is unique.
    const cacheHeader = polygon
      ? "no-store"
      : "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

    return new NextResponse(buffer.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": cacheHeader,
      },
    });
  } catch (err) {
    console.error("Visual generation error:", err);
    return new NextResponse("Failed to generate visual", { status: 500 });
  }
}
