/**
 * Satellite image proxy — stitches ESRI World Imagery tiles into a single image.
 * No API key required. Returns a 640×360 JPEG centred on the given coordinates.
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
  // Try ESRI World Imagery (primary), fall back to OSM if it fails
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
  // Return grey tile as fallback
  return await sharp({
    create: { width: TILE_SIZE, height: TILE_SIZE, channels: 3, background: { r: 40, g: 40, b: 40 } },
  }).jpeg().toBuffer();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat  = parseFloat(searchParams.get("lat")  ?? "0");
  const lng  = parseFloat(searchParams.get("lng")  ?? "0");
  const zoom = parseInt(searchParams.get("zoom") ?? "19", 10);

  if (!lat || !lng) {
    return new NextResponse("lat and lng required", { status: 400 });
  }

  try {
    const { x: xf, y: yf } = latLngToTileFloat(lat, lng, Math.min(zoom, 20));
    const tileX = Math.floor(xf);
    const tileY = Math.floor(yf);

    // Fetch a 3×3 grid of tiles centred on the building
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

    const totalW = TILE_SIZE * GRID; // 768
    const totalH = TILE_SIZE * GRID; // 768

    // Stitch tiles
    const stitched = await sharp({
      create: { width: totalW, height: totalH, channels: 3, background: { r: 30, g: 30, b: 30 } },
    })
      .composite(tileBuffers)
      .png()
      .toBuffer();

    // Crop 640×360 centred on the exact pixel of the lat/lng
    const centerPxX = (xf - (tileX - half)) * TILE_SIZE;
    const centerPxY = (yf - (tileY - half)) * TILE_SIZE;
    const cropW = 640, cropH = 360;
    const cropX = Math.max(0, Math.min(totalW - cropW, Math.round(centerPxX - cropW / 2)));
    const cropY = Math.max(0, Math.min(totalH - cropH, Math.round(centerPxY - cropH / 2)));

    const final = await sharp(stitched)
      .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
      .jpeg({ quality: 88 })
      .toBuffer();

    return new NextResponse(final.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (err) {
    console.error("Satellite image error:", err);
    return new NextResponse("Failed to generate satellite image", { status: 500 });
  }
}
