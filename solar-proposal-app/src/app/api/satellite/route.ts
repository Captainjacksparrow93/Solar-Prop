/**
 * Satellite image proxy.
 * Priority: 1) Google Maps Static API (sharp global coverage, needs GOOGLE_SOLAR_API_KEY)
 *           2) ESRI World Imagery tiles (no key, limited coverage at zoom 19)
 *           3) ESRI at zoom 18 fallback
 * Returns a 640×400 JPEG centred on the given coordinates.
 *
 * Usage: GET /api/satellite?lat=19.076&lng=72.877&zoom=19
 */
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

const TILE_SIZE = 256;

function latLngToTileFloat(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

async function fetchTile(z: number, y: number, x: number): Promise<Buffer> {
  const urls = [
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch { /* try next */ }
  }
  return await sharp({
    create: { width: TILE_SIZE, height: TILE_SIZE, channels: 3, background: { r: 40, g: 40, b: 40 } },
  }).jpeg().toBuffer();
}

async function stitchEsriTiles(lat: number, lng: number, zoom: number): Promise<Buffer> {
  const { x: xf, y: yf } = latLngToTileFloat(lat, lng, zoom);
  const tileX = Math.floor(xf);
  const tileY = Math.floor(yf);
  const GRID = 3;
  const half = Math.floor(GRID / 2);

  const tileBuffers: Array<{ input: Buffer; left: number; top: number }> = [];
  await Promise.all(
    Array.from({ length: GRID }, (_, row) =>
      Array.from({ length: GRID }, async (_, col) => {
        const tx = tileX + col - half;
        const ty = tileY + row - half;
        const buf = await fetchTile(zoom, ty, tx);
        tileBuffers.push({ input: buf, left: col * TILE_SIZE, top: row * TILE_SIZE });
      })
    ).flat()
  );

  const totalW = TILE_SIZE * GRID;
  const totalH = TILE_SIZE * GRID;
  const stitched = await sharp({
    create: { width: totalW, height: totalH, channels: 3, background: { r: 30, g: 30, b: 30 } },
  }).composite(tileBuffers).png().toBuffer();

  const centerPxX = (xf - (tileX - half)) * TILE_SIZE;
  const centerPxY = (yf - (tileY - half)) * TILE_SIZE;
  const cropW = 640, cropH = 400;
  const cropX = Math.max(0, Math.min(totalW - cropW, Math.round(centerPxX - cropW / 2)));
  const cropY = Math.max(0, Math.min(totalH - cropH, Math.round(centerPxY - cropH / 2)));

  return sharp(stitched)
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .jpeg({ quality: 88 })
    .toBuffer();
}

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat  = parseFloat(searchParams.get("lat")  ?? "0");
  const lng  = parseFloat(searchParams.get("lng")  ?? "0");
  const zoom = parseInt(searchParams.get("zoom") ?? "19", 10);

  if (!lat || !lng) {
    return new NextResponse("lat and lng required", { status: 400 });
  }

  try {
    const effectiveZoom = Math.min(zoom, 19);

    // ── 1. Google Maps Static API — best global coverage ────────────────────
    const apiKey = process.env.GOOGLE_SOLAR_API_KEY;
    if (apiKey) {
      try {
        const googleUrl =
          `https://maps.googleapis.com/maps/api/staticmap` +
          `?center=${lat},${lng}&zoom=${effectiveZoom}&size=640x400&maptype=satellite&key=${apiKey}`;
        const res = await fetch(googleUrl, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          return new NextResponse(buf.buffer as ArrayBuffer, {
            headers: {
              "Content-Type": "image/jpeg",
              "Cache-Control": "public, max-age=86400, s-maxage=86400",
            },
          });
        }
      } catch { /* fall through to ESRI */ }
    }

    // ── 2. ESRI World Imagery — try zoom 19 then 18 ─────────────────────────
    for (const z of [effectiveZoom, Math.max(17, effectiveZoom - 1)]) {
      try {
        const final = await stitchEsriTiles(lat, lng, z);
        return new NextResponse(final.buffer as ArrayBuffer, {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
          },
        });
      } catch { /* try lower zoom */ }
    }

    return new NextResponse("Failed to generate satellite image", { status: 500 });
  } catch (err) {
    console.error("Satellite image error:", err);
    return new NextResponse("Failed to generate satellite image", { status: 500 });
  }
}

