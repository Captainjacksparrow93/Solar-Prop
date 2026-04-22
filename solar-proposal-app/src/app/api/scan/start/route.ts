/**
 * Phase 1 — Fast building discovery only.
 * Geocodes address, queries Overpass for buildings, saves Leads.
 * Returns immediately with { jobId, totalFound }.
 * Scoring (Solar API + overlay generation) is done separately via /score.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";
import { scanByRadius, scanByPolygon, scanFromCsv } from "@/lib/area-scanner";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const userId = await getDefaultUserId();
  const body = await req.json();
  const { method, name, query, centerAddress, radiusMiles, polygon, csvText, maxResults = 40 } = body;

  if (!method) return NextResponse.json({ error: "method required" }, { status: 400 });
  if (!name)   return NextResponse.json({ error: "name required" }, { status: 400 });

  const job = await db.scanJob.create({
    data: { userId, name, method, query: query ?? null, centerAddress: centerAddress ?? null, radiusMiles: radiusMiles ?? null, status: "RUNNING" },
  });

  try {
    let places: Awaited<ReturnType<typeof scanByRadius>> = [];

    if (method === "RADIUS") {
      if (!query || !centerAddress) throw new Error("query and centerAddress required for RADIUS");
      places = await scanByRadius(query, centerAddress, radiusMiles ?? 5, maxResults);
    } else if (method === "POLYGON") {
      if (!query || !polygon) throw new Error("query and polygon required for POLYGON");
      places = await scanByPolygon(query, polygon, maxResults);
    } else if (method === "CSV") {
      if (!csvText) throw new Error("csvText required for CSV");
      places = await scanFromCsv(csvText, maxResults);
    } else {
      throw new Error(`Unknown method: ${method}`);
    }

    if (places.length === 0) {
      await db.scanJob.update({ where: { id: job.id }, data: { status: "COMPLETED", totalFound: 0, totalScored: 0 } });
      return NextResponse.json({ jobId: job.id, totalFound: 0 });
    }

    // Upsert leads
    await Promise.all(places.map(p =>
      db.lead.upsert({
        where: { placeId: p.placeId },
        update: { scanJobId: job.id },
        create: {
          userId,
          scanJobId: job.id,
          businessName: p.businessName,
          address: p.address,
          city: p.city,
          state: p.state,
          country: p.country,
          placeId: p.placeId,
          phone: p.phone,
          website: p.website,
          businessType: p.businessType,
          rating: p.rating,
          totalRatings: p.totalRatings,
          lat: p.lat,
          lng: p.lng,
          status: "NEW",
        },
      })
    ));

    await db.scanJob.update({
      where: { id: job.id },
      data: { totalFound: places.length, status: "SCORING" },
    });

    return NextResponse.json({ jobId: job.id, totalFound: places.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    await db.scanJob.update({ where: { id: job.id }, data: { status: "FAILED", error: message } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
