import { NextRequest, NextResponse } from "next/server";
import { searchBusinesses } from "@/lib/google-places";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";

export async function POST(req: NextRequest) {
  const { query, location, maxResults = 20 } = await req.json();

  if (!query || !location) {
    return NextResponse.json({ error: "query and location are required" }, { status: 400 });
  }

  try {
    const userId = await getDefaultUserId();
    const places = await searchBusinesses(query, location, maxResults);

    const results = await Promise.all(
      places.map(async (place) => {
        return db.lead.upsert({
          where: { placeId: place.placeId },
          update: {},
          create: {
            businessName: place.businessName,
            address: place.address,
            city: place.city,
            state: place.state,
            country: place.country,
            placeId: place.placeId,
            phone: place.phone,
            website: place.website,
            businessType: place.businessType,
            rating: place.rating,
            totalRatings: place.totalRatings,
            lat: place.lat,
            lng: place.lng,
            userId,
          },
        });
      })
    );

    return NextResponse.json({ count: results.length, leads: results });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Failed to scrape";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
