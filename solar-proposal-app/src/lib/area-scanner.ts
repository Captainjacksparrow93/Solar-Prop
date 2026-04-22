/**
 * Area Scanner — OpenStreetMap Overpass API.
 * Searches for commercial/industrial buildings using broad tags so it
 * works in cities where buildings are only tagged `building=yes`.
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
    headers: { "User-Agent": "SolarPropose/1.0 (solar-prop-one.vercel.app)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data[0]) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

// ─── Overpass mirrors — queried in parallel, best result wins ─────────────────
//
// Sequential probing meant a slow/overloaded mirror consumed 30 s before the
// next was tried. On Vercel functions this frequently exhausted the 60 s budget.
// Parallel probing returns as soon as ANY mirror delivers useful data.

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter", // extra mirror
];

async function querySingleMirror(mirror: string, query: string, timeoutMs: number): Promise<any[]> {
  try {
    const res = await fetch(mirror, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (text.trim().startsWith("<")) return []; // HTML error page
    const data = JSON.parse(text);
    return data.elements ?? [];
  } catch {
    return [];
  }
}

async function queryOverpass(query: string): Promise<any[]> {
  // Race all mirrors simultaneously; return the first response with ≥1 element.
  // If multiple mirrors answer, the fastest one wins.
  return new Promise((resolve) => {
    let settled = false;
    let pending = OVERPASS_MIRRORS.length;

    OVERPASS_MIRRORS.forEach((mirror) => {
      querySingleMirror(mirror, query, 45000).then((elements) => {
        pending--;
        if (!settled && elements.length > 0) {
          settled = true;
          resolve(elements);
        } else if (pending === 0 && !settled) {
          // All mirrors returned empty — resolve with empty array
          resolve([]);
        }
      });
    });
  });
}

// ─── Build Overpass query ─────────────────────────────────────────────────────

/**
 * Builds a query that finds commercial / industrial buildings regardless of
 * how they are tagged in OSM.  Works in cities that only use `building=yes`.
 *
 * Strategy:
 *   1. Any building that is NOT residential/agricultural
 *   2. Named amenities (hospital, hotel, school, etc.)
 *   3. Named shops / offices
 *
 * The residential exclusion list covers the most common residential tags so
 * we don't return individual houses in dense neighbourhoods.
 */
function buildQuery(center: LatLng, radiusMeters: number, maxResults: number, queryHint: string): string {
  const r    = Math.min(radiusMeters, 50000);
  const lat  = center.lat;
  const lng  = center.lng;

  // Residential tags to exclude
  const EXCL = "house|residential|apartments|detached|semidetached_house|terrace|bungalow|hut|shed|garage|garages|carport|cabin|dormitory|farm|allotment_house|static_caravan";

  // Map hint to targeted Overpass tags (tried first, faster)
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

  // Primary targeted query (if we have a specific tag for this type)
  const targeted = targetTag
    ? `  way${targetTag}${around};\n  node${targetTag}${around};`
    : "";

  // Broad non-residential building query — catches `building=yes` which is
  // the dominant tag in most of Asia, Africa, and Latin America
  const broad = `
  way["building"]["building"!~"^(${EXCL})$"]${around};
  node["building"]["building"!~"^(${EXCL})$"]${around};
  way["amenity"]["amenity"!~"^(bench|waste_basket|recycling|bicycle_parking|drinking_water|telephone|post_box)$"]${around};
  node["amenity"]["amenity"!~"^(bench|waste_basket|recycling|bicycle_parking|drinking_water|telephone|post_box)$"]${around};
  way["shop"]${around};
  node["shop"]${around};
  way["office"]${around};
  node["office"]${around};`;

  // Use out center body (not just qt) so way elements include full tag set.
  // Double maxResults in query to give dedup room; parseElements slices to actual limit.
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

    // Deduplicate by rounded position
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

// ─── Public API ───────────────────────────────────────────────────────────────

// ─── Nominatim search fallback (when Overpass is down) ───────────────────────

async function searchNominatim(
  query: string,
  center: LatLng,
  radiusMiles: number,
  maxResults: number
): Promise<PlaceResult[]> {
  const deg  = (radiusMiles * 1609.34) / 111320; // approx degrees per metre
  const bbox = [
    center.lng - deg, center.lat - deg,
    center.lng + deg, center.lat + deg,
  ].join(",");

  const url  = `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query)}` +
    `&viewbox=${bbox}&bounded=1&format=json&limit=${maxResults}&addressdetails=1`;

  const res  = await fetch(url, {
    headers: { "User-Agent": "SolarPropose/1.0 (solar-prop-one.vercel.app)" },
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

export async function scanByRadius(
  query: string,
  centerAddress: string,
  radiusMiles: number,
  maxResults = 60
): Promise<PlaceResult[]> {
  const center = await geocodeAddress(centerAddress);
  if (!center) throw new Error(`Could not geocode: "${centerAddress}". Try a more specific city name or address.`);

  const radiusMeters = radiusMiles * 1609.34;

  // Try Overpass first (comprehensive OSM building data)
  const overpassQuery = buildQuery(center, radiusMeters, maxResults * 2, query);
  let elements = await queryOverpass(overpassQuery);
  let results  = elements.length > 0 ? parseElements(elements).slice(0, maxResults) : [];

  // Fallback to Nominatim search if Overpass returned nothing
  if (results.length === 0) {
    results = await searchNominatim(query, center, radiusMiles, maxResults);
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

  const overpassQuery = buildQuery(center, radiusMeters, maxResults * 2, query);
  const elements = await queryOverpass(overpassQuery);
  return parseElements(elements)
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
