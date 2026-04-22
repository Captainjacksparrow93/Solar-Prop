export interface PlaceResult {
  placeId: string;
  businessName: string;
  address: string;
  city: string | null;
  state: string | null;
  country: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  businessType: string | null;
  rating: number | null;
  totalRatings: number | null;
}

/**
 * Text-search businesses via Google Places API (New).
 * https://developers.google.com/maps/documentation/places/web-service/text-search
 */
export async function searchBusinesses(
  query: string,
  location: string,
  maxResults = 20
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_SOLAR_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_SOLAR_API_KEY not configured");

  const textQuery = `${query} in ${location}`;

  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location,places.internationalPhoneNumber,places.websiteUri,places.primaryTypeDisplayName,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({ textQuery, maxResultCount: Math.min(maxResults, 20) }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Places API error: ${err}`);
  }

  const data = await res.json();
  const places = data.places ?? [];

  return places.map((p: GooglePlace) => {
    const components = p.addressComponents ?? [];
    const city = getComponent(components, "locality") ?? getComponent(components, "postal_town");
    const state = getComponent(components, "administrative_area_level_1");
    const country = getComponent(components, "country");

    return {
      placeId: p.id,
      businessName: p.displayName?.text ?? "Unknown",
      address: p.formattedAddress ?? "",
      city,
      state,
      country,
      lat: p.location?.latitude ?? 0,
      lng: p.location?.longitude ?? 0,
      phone: p.internationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
      businessType: p.primaryTypeDisplayName?.text ?? null,
      rating: p.rating ?? null,
      totalRatings: p.userRatingCount ?? null,
    };
  });
}

function getComponent(
  components: AddressComponent[],
  type: string
): string | null {
  return components.find((c) => c.types?.includes(type))?.longText ?? null;
}

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  location?: { latitude: number; longitude: number };
  internationalPhoneNumber?: string;
  websiteUri?: string;
  primaryTypeDisplayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
}

interface AddressComponent {
  longText?: string;
  types?: string[];
}
