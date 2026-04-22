/**
 * Area Scanner — multi-source building discovery.
 *
 * Source priority:
 *   1. Google Places API (Text Search + Nearby Search) — most reliable, real business data
 *   2. OpenStreetMap Overpass API                      — free, good for dense industrial areas
 *   3. Nominatim search                                — lightweight fallback
 *
 * Google Places is tried first when GOOGLE_SOLAR_API_KEY is set (same key used for Solar API).
 * Overpass requires a User-Agent header to avoid 429 rate-limits.
 */

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

interface LatLng { lat: number; lng: number }

// ─── Nominatim geocoding ──────────────────────────────────────────────────────

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "SolarPropose/1.0 (solar-prop-one.vercel.app; contact@solarpropose.com)",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data[0]) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

// ─── Google Places — primary source ──────────────────────────────────────────

/**
 * Maps the free-text query hint to Google Places includedTypes for Nearby Search.
 */
function queryToGoogleTypes(queryHint: string): string[] {
  const map: Record<string, string[]> = {
    warehouse:              ["warehouse", "storage"],
    "manufacturing plant":  ["manufacturing_plant", "factory"],
    factory:                ["manufacturing_plant", "factory"],
    "industrial building":  ["warehouse", "manufacturing_plant"],
    "office building":      ["office"],
    "shopping mall":        ["shopping_mall"],
    supermarket:            ["supermarket", "grocery_store"],
    hotel:                  ["hotel"],
    hospital:               ["hospital"],
    school:                 ["school", "university", "college"],
    church:                 ["church", "place_of_worship"],
    "storage facility":     ["warehouse", "storage"],
    "distribution center":  ["warehouse"],
  };
  return map[queryHint.toLowerCase()] ?? [];
}

interface GoogleRawPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: Array<{ longText?: string; types?: string[] }>;
  location?: { latitude: number; longitude: number };
  internationalPhoneNumber?: string;
  websiteUri?: string;
  primaryTypeDisplayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
}

function parseGooglePlace(p: GoogleRawPlace): PlaceResult {
  const components = p.addressComponents ?? [];
  const get = (type: string) =>
    components.find((c) => c.types?.includes(type))?.longText ?? null;

  return {
    placeId:      p.id,
    businessName: p.displayName?.text ?? "Unknown",
    address:      p.formattedAddress ?? "",
    city:         get("locality") ?? get("postal_town") ?? get("administrative_area_level_2"),
    state:        get("administrative_area_level_1"),
    country:      get("country"),
    lat:          p.location?.latitude ?? 0,
    lng:          p.location?.longitude ?? 0,
    phone:        p.internationalPhoneNumber ?? null,
    website:      p.websiteUri ?? null,
    businessType: p.primaryTypeDisplayName?.text ?? null,
    rating:       p.rating ?? null,
    totalRatings: p.userRatingCount ?? null,
  };
}

const PLACES_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.addressComponents," +
  "places.location,places.internationalPhoneNumber,places.websiteUri," +
  "places.primaryTypeDisplayName,places.rating,places.userRatingCount";

/**
 * Google Places Nearby Search — returns commercial buildings near a point.
 * Paginates up to 3 pages (60 results) if needed.
 */
async function searchGoogleNearby(
  apiKey: string,
  queryHint: string,
  center: LatLng,
  radiusMeters: number,
  maxResults: number,
): Promise<PlaceResult[]> {
  const includedTypes = queryToGoogleTypes(queryHint);
  const results: PlaceResult[] = [];
  let pageToken: string | undefined;

  // If no specific type mapping, fall back to text search
  if (includedTypes.length === 0) {
    return searchGoogleText(apiKey, queryHint, center, radiusMeters, maxResults);
  }

  while (results.length < maxResults) {
    const body: Record<string, unknown> = {
      includedTypes,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius: Math.min(radiusMeters, 50000),
        },
      },
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": PLACES_FIELD_MASK + ",nextPageToken",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`Google Places Nearby: HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(`Google Places Nearby: ${data.error.message}`);

    const batch: PlaceResult[] = (data.places ?? []).map(parseGooglePlace);
    results.push(...batch);
    pageToken = data.nextPageToken;
    if (!pageToken || batch.length === 0) break;
  }

  return results.slice(0, maxResults);
}

/**
 * Google Places Text Search — used when no specific type mapping exists
 * or as a supplement. Returns up to 20 results per call.
 */
async function searchGoogleText(
  apiKey: string,
  queryHint: string,
  center: LatLng,
  radiusMeters: number,
  maxResults: number,
): Promise<PlaceResult[]> {
  const results: PlaceResult[] = [];
  let pageToken: string | undefined;

  while (results.length < maxResults) {
    const body: Record<string, unknown> = {
      textQuery: queryHint,
      maxResultCount: Math.min(20, maxResults - results.length),
      locationBias: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius: Math.min(radiusMeters, 50000),
        },
      },
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": PLACES_FIELD_MASK + ",nextPageToken",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`Google Places Text: HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(`Google Places Text: ${data.error.message}`);

    const batch: PlaceResult[] = (data.places ?? []).map(parseGooglePlace);
    results.push(...batch);
    pageToken = data.nextPageToken;
    if (!pageToken || batch.length === 0) break;
  }

  return results.slice(0, maxResults);
}

// ─── Overpass mirrors — queried in parallel, best result wins ─────────────────

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// All public Overpass instances require a meaningful User-Agent to avoid 429s
const OVERPASS_USER_AGENT =
  "SolarPropose/1.0 (solar-prop-one.vercel.app; contact@solarpropose.com)";

async function querySingleMirror(mirror: string, query: string): Promise<any[]> {
  try {
    const res = await fetch(mirror, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": OVERPASS_USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (text.trim().startsWith("<")) return [];
    const data = JSON.parse(text);
    return data.elements ?? [];
  } catch {
    return [];
  }
}

async function queryOverpass(query: string): Promise<any[]> {
  return new Promise((resolve) => {
    let settled = false;
    let pending = OVERPASS_MIRRORS.length;

    OVERPASS_MIRRORS.forEach((mirror) => {
      querySingleMirror(mirror, query).then((elements) => {
        pending--;
        if (!settled && elements.length > 0) {
          settled = true;
          resolve(elements);
        } else if (pending === 0 && !settled) {
          resolve([]);
        }
      });
    });
  });
}

// ─── Build Overpass query ─────────────────────────────────────────────────────

function buildQuery(center: LatLng, radiusMeters: number, maxResults: number, queryHint: string): string {
  const r   = Math.min(radiusMeters, 50000);
  const lat = center.lat;
  const lng = center.lng;

  const EXCL = "house|residential|apartments|detached|semidetached_house|terrace|bungalow|hut|shed|garage|garages|carport|cabin|dormitory|farm|allotment_house|static_caravan";

  const HINT_TAGS: Record<string, string> = {
    warehouse:            `["building"~"warehouse|industrial|storage"]`,
    "manufacturing plant":`["building"~"industrial|factory|manufacture"]`,
    factory:              `["building"~"factory|industrial|manufacture"]`,
    "industrial building":`["building"~"industrial|warehouse|factory"]`,
    "office building":    `["building"~"office|commercial"]`,
    "shopping mall":      `["building"~"retail|commercial"]["shop"~"mall|department_store"]`,
    supermarket:          `["shop"~"supermarket|grocery|hypermarket"]`,
    hotel:                `["tourism"="hotel"]`,
    hospital:             `["amenity"="hospital"]`,
    school:               `["amenity"~"school|college|university"]`,
    church:               `["amenity"="place_of_worship"]`,
    "storage facility":   `["building"~"warehouse|storage"]`,
    "distribution center":`["building"~"warehouse|industrial"]`,
  };

  const targetTag = HINT_TAGS[queryHint.toLowerCase()] ?? null;
  const around = `(around:${r},${lat},${lng})`;

  const targeted = targetTag
    ? `  way${targetTag}${around};\n  node${targetTag}${around};`
    : "";

  const broad = `
  way["building"]["building"!~"^(${EXCL})$"]${around};
  node["building"]["building"!~"^(${EXCL})$"]${around};
  way["amenity"]["amenity"!~"^(bench|waste_basket|recycling|bicycle_parking|drinking_water|telephone|post_box)$"]${around};
  node["amenity"]["amenity"!~"^(bench|waste_basket|recycling|bicycle_parking|drinking_water|telephone|post_box)$"]${around};
  way["shop"]${around};
  node["shop"]${around};
  way["office"]${around};
  node["office"]${around};`;

  return `[out:json][timeout:45];\n(\n${targeted}\n${broad}\n);\nout center body qt ${maxResults * 2};`;
}

// ─── Parse Overpass elements → PlaceResult ────────────────────────────────────

function parseElements(elements: any[]): PlaceResult[] {
  const seen = new Set<string>();
  const results: PlaceResult[] = [];

  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!lat || !lon) continue;

    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const tags = el.tags ?? {};

    const name =
      tags.name ??
      tags["name:en"] ??
      tags.operator ??
      tags.brand ??
      tags["addr:housename"] ??
      `Building ${String(el.id).slice(-6)}`;

    const street  = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
    const city    = tags["addr:city"] ?? tags["addr:suburb"] ?? null;
    const state   = tags["addr:state"] ?? null;
    const country = tags["addr:country"] ?? null;
    const address = [street, city, state].filter(Boolean).join(", ") ||
                    `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

    const buildingType =
      tags.building && tags.building !== "yes"
        ? tags.building
        : tags.amenity ?? tags.shop ?? tags.office ?? tags.tourism ?? "Commercial";

    results.push({
      placeId: `osm-${el.type}-${el.id}`,
      businessName: name,
      address, city, state, country,
      lat, lng: lon,
      phone: tags.phone ?? tags["contact:phone"] ?? null,
      website: tags.website ?? tags["contact:website"] ?? null,
      businessType: buildingType.charAt(0).toUpperCase() + buildingType.slice(1),
      rating: null,
      totalRatings: null,
    });
  }

  return results;
}

// ─── Nominatim search fallback ────────────────────────────────────────────────

async function searchNominatim(
  query: string,
  center: LatLng,
  radiusMiles: number,
  maxResults: number
): Promise<PlaceResult[]> {
  const deg  = (radiusMiles * 1609.34) / 111320;
  const bbox = [
    center.lng - deg, center.lat - deg,
    center.lng + deg, center.lat + deg,
  ].join(",");

  const url = `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query)}` +
    `&viewbox=${bbox}&bounded=1&format=json&limit=${maxResults}&addressdetails=1`;

  const res = await fetch(url, {
    headers: { "User-Agent": OVERPASS_USER_AGENT },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return [];

  const places: any[] = await res.json();
  const seen = new Set<string>();

  return places
    .filter(p => p.lat && p.lon)
    .map(p => {
      const key = `${parseFloat(p.lat).toFixed(4)},${parseFloat(p.lon).toFixed(4)}`;
      if (seen.has(key)) return null;
      seen.add(key);

      const addr  = p.address ?? {};
      const city  = addr.city ?? addr.town ?? addr.village ?? null;
      const state = addr.state ?? null;

      return {
        placeId: `nom-${p.place_id}`,
        businessName: p.display_name?.split(",")[0] ?? "Unknown",
        address: p.display_name ?? `${p.lat}, ${p.lon}`,
        city, state,
        country: addr.country ?? null,
        lat: parseFloat(p.lat),
        lng: parseFloat(p.lon),
        phone: null, website: null,
        businessType: p.type ?? p.class ?? "Commercial",
        rating: null, totalRatings: null,
      } as PlaceResult;
    })
    .filter(Boolean) as PlaceResult[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scanByRadius(
  query: string,
  centerAddress: string,
  radiusMiles: number,
  maxResults = 60
): Promise<PlaceResult[]> {
  const center = await geocodeAddress(centerAddress);
  if (!center) throw new Error(`Could not geocode: "${centerAddress}". Try a more specific city name or address.`);

  const radiusMeters = radiusMiles * 1609.34;
  const apiKey = process.env.GOOGLE_SOLAR_API_KEY;

  // ── 1. Google Places (primary — reliable, rich data) ─────────────────────
  if (apiKey) {
    try {
      const googleResults = await searchGoogleNearby(apiKey, query, center, radiusMeters, maxResults);
      if (googleResults.length >= 5) {
        console.log(`[scan] Google Places returned ${googleResults.length} results`);
        return googleResults;
      }
      // If nearby returned too few, try text search
      const textResults = await searchGoogleText(apiKey, query, center, radiusMeters, maxResults);
      if (textResults.length >= 3) {
        console.log(`[scan] Google Places Text returned ${textResults.length} results`);
        return textResults;
      }
    } catch (e) {
      console.warn(`[scan] Google Places failed (${(e as Error).message}), falling back to Overpass`);
    }
  }

  // ── 2. Overpass (fallback — OSM data, requires User-Agent) ───────────────
  const overpassQuery = buildQuery(center, radiusMeters, maxResults * 2, query);
  const elements = await queryOverpass(overpassQuery);
  let results = elements.length > 0 ? parseElements(elements).slice(0, maxResults) : [];
  console.log(`[scan] Overpass returned ${elements.length} elements → ${results.length} parsed`);

  // ── 3. Nominatim (last resort) ────────────────────────────────────────────
  if (results.length === 0) {
    results = await searchNominatim(query, center, radiusMiles, maxResults);
    console.log(`[scan] Nominatim returned ${results.length} results`);
  }

  if (results.length === 0) {
    throw new Error(
      `No buildings found in "${centerAddress}" within ${radiusMiles} miles. ` +
      `Try increasing the radius, selecting a different business type, or verifying the city name.`
    );
  }

  return results;
}

export async function scanByPolygon(
  query: string,
  polygon: LatLng[],
  maxResults = 100
): Promise<PlaceResult[]> {
  const lats = polygon.map(p => p.lat);
  const lngs = polygon.map(p => p.lng);
  const center: LatLng = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
  const latSpan = (Math.max(...lats) - Math.min(...lats)) * 111000;
  const lngSpan = (Math.max(...lngs) - Math.min(...lngs)) * 111000;
  const radiusMeters = Math.sqrt(latSpan ** 2 + lngSpan ** 2) / 2;
  const radiusMiles  = radiusMeters / 1609.34;

  const apiKey = process.env.GOOGLE_SOLAR_API_KEY;

  let candidates: PlaceResult[] = [];

  if (apiKey) {
    try {
      candidates = await searchGoogleNearby(apiKey, query, center, radiusMeters, maxResults * 2);
      if (candidates.length < 5) {
        candidates = await searchGoogleText(apiKey, query, center, radiusMeters, maxResults * 2);
      }
    } catch {
      /* fall through to Overpass */
    }
  }

  if (candidates.length === 0) {
    const overpassQuery = buildQuery(center, radiusMeters, maxResults * 2, query);
    const elements = await queryOverpass(overpassQuery);
    candidates = elements.length > 0 ? parseElements(elements) : [];
  }

  return candidates
    .filter(r => isInsidePolygon({ lat: r.lat, lng: r.lng }, polygon))
    .slice(0, maxResults);
}

export async function scanFromCsv(csvText: string, maxResults = 100): Promise<PlaceResult[]> {
  const lines = csvText.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  const results: PlaceResult[] = [];

  for (const line of lines.slice(0, maxResults)) {
    const parts   = line.split(",").map(s => s.trim());
    const address = parts.length >= 2 ? parts.slice(1).join(",").trim() : parts[0];
    const name    = parts.length >= 2 ? parts[0] : "Unknown";

    const coords = await geocodeAddress(address);
    if (!coords) continue;

    results.push({
      placeId: `csv-${Buffer.from(address).toString("base64").slice(0, 20)}`,
      businessName: name,
      address, city: null, state: null, country: null,
      lat: coords.lat, lng: coords.lng,
      phone: null, website: null, businessType: "Commercial",
      rating: null, totalRatings: null,
    });
  }
  return results;
}

function isInsidePolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  const { lat: px, lng: py } = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const { lat: xi, lng: yi } = polygon[i];
    const { lat: xj, lng: yj } = polygon[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
