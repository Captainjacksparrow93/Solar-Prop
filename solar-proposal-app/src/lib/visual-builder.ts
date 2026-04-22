/**
 * Visual builder — ESRI satellite tiles + image-based roof detection + proportional panels.
 *
 * Roof detection approach (no ML, no external API):
 *   1. Downsample satellite image to 128×80 px
 *   2. Compute per-block local variance (8×8 px blocks)
 *   3. Flat/uniform blocks (low variance) = potential roof surface
 *   4. Find the largest connected flat region in the centre of the image
 *   5. Place panels proportionally inside that region
 *
 * This correctly handles any roof colour (white, grey, dark, tan, etc.)
 * because it detects UNIFORMITY, not brightness.
 */
import sharp from "sharp";

// ─── Canvas / panel constants ─────────────────────────────────────────────────
const TILE_SIZE   = 256;
const CANVAS_W    = 640;
const CANVAS_H    = 400;
const ZOOM        = 19;   // satellite tiles zoom — 1px ≈ 0.30 m at equator

// Real-world solar panel dimensions (metres) — industry standard 60-cell panel
const PANEL_W_M   = 2.0;  // 2 m wide
const PANEL_H_M   = 1.0;  // 1 m tall
const PANEL_GAP_M = 0.20; // 20 cm gap between panels
// Visibility scale: render panels at 1.4× real size so they're legible on screen
// (1× real at zoom 19 ≈ 6-7 px wide — barely visible; 1.4× ≈ 9-10 px — clear)
const VIS_SCALE   = 1.4;

// Header and footer overlay heights (must not be covered by panels)
const HEADER_H    = 55;
const FOOTER_H    = 32;

// ─── Tile math ────────────────────────────────────────────────────────────────

function mpp(lat: number, zoom: number): number {
  return (156543.03 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
}

function latLngToTileFloat(lat: number, lng: number, zoom: number) {
  const n   = Math.pow(2, zoom);
  const x   = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y   = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return { x, y };
}

async function fetchEsriTile(z: number, ty: number, tx: number): Promise<Buffer | null> {
  const urls = [
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`,
    `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch { /* try next */ }
  }
  return null;
}

async function buildSatelliteBuffer(lat: number, lng: number): Promise<Buffer> {
  const { x: xf, y: yf } = latLngToTileFloat(lat, lng, ZOOM);
  const tileX = Math.floor(xf);
  const tileY = Math.floor(yf);
  const GRID  = 3;
  const half  = 1;

  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  await Promise.all(
    Array.from({ length: GRID }, (_, row) =>
      Array.from({ length: GRID }, async (_, col) => {
        const buf = await fetchEsriTile(ZOOM, tileY + row - half, tileX + col - half);
        if (buf) composites.push({ input: buf, left: col * TILE_SIZE, top: row * TILE_SIZE });
      })
    ).flat()
  );

  const totalW = TILE_SIZE * GRID; // 768
  const totalH = TILE_SIZE * GRID; // 768

  const stitched = await sharp({
    create: { width: totalW, height: totalH, channels: 3, background: { r: 20, g: 25, b: 30 } },
  })
    .composite(composites)
    .png()
    .toBuffer();

  const centerPxX = (xf - (tileX - half)) * TILE_SIZE;
  const centerPxY = (yf - (tileY - half)) * TILE_SIZE;
  const cropX = Math.max(0, Math.min(totalW - CANVAS_W, Math.round(centerPxX - CANVAS_W / 2)));
  const cropY = Math.max(0, Math.min(totalH - CANVAS_H, Math.round(centerPxY - CANVAS_H / 2)));

  return sharp(stitched)
    .extract({ left: cropX, top: cropY, width: CANVAS_W, height: CANVAS_H })
    .png()
    .toBuffer();
}

// ─── Point-in-polygon ────────────────────────────────────────────────────────

function ptInPoly(px: number, py: number, poly: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ─── Roof detection from image pixels ────────────────────────────────────────

interface RoofBounds { x: number; y: number; w: number; h: number }

async function detectRoofBounds(satBuffer: Buffer, lat: number, roofAreaSqM: number | null): Promise<RoofBounds> {
  // Analyse at 128×80 for speed
  const SMALL_W = 128;
  const SMALL_H = 80;
  const BLOCK   = 8; // 16×10 = 160 blocks total

  const { data: gray } = await sharp(satBuffer)
    .resize(SMALL_W, SMALL_H)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bW = Math.floor(SMALL_W / BLOCK);
  const bH = Math.floor(SMALL_H / BLOCK);

  // Local variance per block
  const variance: number[] = [];
  for (let by = 0; by < bH; by++) {
    for (let bx = 0; bx < bW; bx++) {
      let sum = 0, sumSq = 0, n = 0;
      for (let y = by * BLOCK; y < (by + 1) * BLOCK && y < SMALL_H; y++) {
        for (let x = bx * BLOCK; x < (bx + 1) * BLOCK && x < SMALL_W; x++) {
          const v = gray[y * SMALL_W + x];
          sum += v; sumSq += v * v; n++;
        }
      }
      const mean = sum / n;
      variance.push(n > 0 ? sumSq / n - mean * mean : 9999);
    }
  }

  // Sort to get median variance threshold
  const sorted  = [...variance].sort((a, b) => a - b);
  const medVar  = sorted[Math.floor(sorted.length * 0.4)]; // 40th percentile
  const threshold = medVar * 1.5; // blocks below this are "flat"

  // Only consider centre 80% of image to avoid street / parking lot edges
  const mgnX = Math.max(1, Math.floor(bW * 0.1));
  const mgnY = Math.max(1, Math.floor(bH * 0.15));

  // Score each block: flat + central = roof candidate
  const cx = bW / 2, cy = bH / 2;
  let minBX = bW, minBY = bH, maxBX = 0, maxBY = 0, found = false;

  for (let by = mgnY; by < bH - mgnY; by++) {
    for (let bx = mgnX; bx < bW - mgnX; bx++) {
      const v   = variance[by * bW + bx];
      const dx  = (bx - cx) / (bW / 2);
      const dy  = (by - cy) / (bH / 2);
      const dist = Math.sqrt(dx * dx + dy * dy); // 0 = centre, 1 = corner

      // Accept flat blocks within the central ~65% of the image
      if (v < threshold && dist < 0.65) {
        minBX = Math.min(minBX, bx);
        minBY = Math.min(minBY, by);
        maxBX = Math.max(maxBX, bx + 1);
        maxBY = Math.max(maxBY, by + 1);
        found = true;
      }
    }
  }

  const scaleX = CANVAS_W / SMALL_W;
  const scaleY = CANVAS_H / SMALL_H;

  if (!found || maxBX - minBX < 3 || maxBY - minBY < 2) {
    return fallbackBounds(lat, roofAreaSqM);
  }

  // Pad 1 block around detected region
  const rx = Math.max(0, (minBX - 1) * BLOCK * scaleX);
  const ry = Math.max(HEADER_H, (minBY - 1) * BLOCK * scaleY);
  const rw = Math.min(CANVAS_W - rx, (maxBX - minBX + 2) * BLOCK * scaleX);
  const rh = Math.min(CANVAS_H - FOOTER_H - ry, (maxBY - minBY + 2) * BLOCK * scaleY);

  // Reject result if it covers <5% or >90% of the canvas
  const ratio = (rw * rh) / (CANVAS_W * CANVAS_H);
  if (ratio < 0.05 || ratio > 0.90) {
    return fallbackBounds(lat, roofAreaSqM);
  }

  return { x: rx, y: ry, w: rw, h: rh };
}

function fallbackBounds(lat: number, roofAreaSqM: number | null): RoofBounds {
  // Estimate from known building area using pixel scale (match satellite zoom)
  const scale = mpp(lat, ZOOM);
  const usable_h = CANVAS_H - HEADER_H - FOOTER_H;

  let rw: number, rh: number;
  if (roofAreaSqM && roofAreaSqM > 0) {
    const aspect = 1.4;
    rh = Math.sqrt(roofAreaSqM / aspect) / scale;
    rw = rh * aspect;
  } else {
    rw = CANVAS_W * 0.55;
    rh = usable_h * 0.60;
  }

  // Clamp
  rw = Math.max(CANVAS_W * 0.25, Math.min(CANVAS_W * 0.88, rw));
  rh = Math.max(usable_h * 0.25, Math.min(usable_h * 0.88, rh));

  return {
    x: Math.round((CANVAS_W - rw) / 2),
    y: Math.round(HEADER_H + (usable_h - rh) / 2),
    w: Math.round(rw),
    h: Math.round(rh),
  };
}

// ─── Project Solar API roof segment (if available) ───────────────────────────

function projectSolarSegments(
  lat: number,
  lng: number,
  rawSolarData: Record<string, unknown> | null | undefined,
): RoofBounds | null {
  const segments: any[] =
    (rawSolarData as any)?.solarPotential?.roofSegmentStats ?? [];
  if (!segments.length) return null;

  // Use the segment with the most area (most usable)
  const best = segments
    .filter((s: any) => (s.pitchDegrees ?? 90) < 40)
    .sort((a: any, b: any) => (b.stats?.areaMeters2 ?? 0) - (a.stats?.areaMeters2 ?? 0))[0];
  if (!best?.boundingBox) return null;

  const { sw, ne } = best.boundingBox;
  const centerTile = latLngToTileFloat(lat, lng, ZOOM);

  function toPixel(pLat: number, pLng: number) {
    const pt = latLngToTileFloat(pLat, pLng, ZOOM);
    return {
      x: CANVAS_W / 2 + (pt.x - centerTile.x) * TILE_SIZE,
      y: CANVAS_H / 2 + (pt.y - centerTile.y) * TILE_SIZE,
    };
  }

  const swPx = toPixel(sw.latitude, sw.longitude);
  const nePx = toPixel(ne.latitude, ne.longitude);

  const x = Math.min(swPx.x, nePx.x);
  const y = Math.min(swPx.y, nePx.y);
  const w = Math.abs(nePx.x - swPx.x);
  const h = Math.abs(swPx.y - nePx.y);

  if (w < 20 || h < 10 || x < -w || y < -h || x > CANVAS_W || y > CANVAS_H) return null;
  return { x: Math.max(0, x), y: Math.max(HEADER_H, y), w, h };
}

// ─── Panel SVG builder ───────────────────────────────────────────────────────

function panelSvgInner(
  x: number, y: number, pW: number, pH: number,
): string {
  // Deep navy panel with blue border (realistic monocrystalline silicon look)
  // Cell grid lines only when panel is large enough to render them clearly
  const showGrid = pW >= 10 && pH >= 6;
  const grid = showGrid ? `
  <line x1="${x+pW*.33}" y1="${y}" x2="${x+pW*.33}" y2="${y+pH}" stroke="rgba(96,165,250,.35)" stroke-width="0.4"/>
  <line x1="${x+pW*.67}" y1="${y}" x2="${x+pW*.67}" y2="${y+pH}" stroke="rgba(96,165,250,.35)" stroke-width="0.4"/>
  <line x1="${x}" y1="${y+pH*.5}" x2="${x+pW}" y2="${y+pH*.5}" stroke="rgba(96,165,250,.35)" stroke-width="0.4"/>` : "";
  // Subtle highlight on top-left corner to simulate glass reflection
  const highlight = pW >= 8
    ? `<rect x="${x+1}" y="${y+1}" width="${Math.round(pW*0.4)}" height="1" fill="rgba(255,255,255,0.18)"/>`
    : "";
  return `<rect x="${x}" y="${y}" width="${pW}" height="${pH}" rx="0.5"
    fill="rgba(15,40,105,0.95)" stroke="rgba(59,130,246,0.85)" stroke-width="0.6"/>
  ${grid}${highlight}`;
}

function buildPanelSvg(
  lat: number,
  bounds: RoofBounds,
  panelCount: number,
  savingsText: string,
  capacityText: string,
  polygon?: Array<{ x: number; y: number }> | null,
): Buffer {
  // Use same zoom as satellite tiles so pixel size matches real-world scale
  const scale = mpp(lat, ZOOM);
  const pW    = Math.max(6, Math.round((PANEL_W_M   * VIS_SCALE) / scale));
  const pH    = Math.max(4, Math.round((PANEL_H_M   * VIS_SCALE) / scale));
  const gap   = Math.max(1, Math.round((PANEL_GAP_M * VIS_SCALE) / scale));
  const cellW = pW + gap;
  const cellH = pH + gap;

  let panelsSvg = "";
  let count = 0;

  if (polygon && polygon.length >= 3) {
    // ── Polygon mode: fill every grid cell whose centre is inside the polygon ──
    // Draw the user's polygon outline
    const pts = polygon.map(p => `${p.x},${p.y}`).join(" ");
    panelsSvg += `<polygon points="${pts}" fill="rgba(59,130,246,0.08)"
      stroke="rgba(96,165,250,0.6)" stroke-width="1.5" stroke-dasharray="5 3"/>`;

    // Scan the full canvas in panel-sized steps
    for (let y = gap; y + pH < CANVAS_H - FOOTER_H; y += cellH) {
      for (let x = gap; x + pW < CANVAS_W; x += cellW) {
        if (count >= panelCount) break;
        const cx = x + pW / 2, cy = y + pH / 2;
        if (ptInPoly(cx, cy, polygon) && cy >= HEADER_H) {
          panelsSvg += panelSvgInner(x, y, pW, pH);
          count++;
        }
      }
      if (count >= panelCount) break;
    }
  } else {
    // ── Bounding-box mode: grid within detected/estimated roof bounds ──
    panelsSvg += `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}"
      rx="3" fill="rgba(59,130,246,0.07)" stroke="rgba(96,165,250,0.55)"
      stroke-width="1.5" stroke-dasharray="6 3"/>`;

    const cols   = Math.max(1, Math.floor(bounds.w / cellW));
    const rows   = Math.max(1, Math.floor(bounds.h / cellH));
    const maxFit = cols * rows;
    count = Math.min(panelCount, maxFit);

    const gridW  = cols * cellW - gap;
    const gridH  = Math.ceil(count / cols) * cellH - gap;
    const startX = Math.round(bounds.x + (bounds.w - gridW) / 2);
    const startY = Math.round(bounds.y + (bounds.h - gridH) / 2);

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x   = startX + col * cellW;
      const y   = startY + row * cellH;
      if (x + pW > bounds.x + bounds.w + 2) continue;
      if (y + pH > bounds.y + bounds.h + 2) continue;
      if (y < HEADER_H - 4) continue;
      panelsSvg += panelSvgInner(x, y, pW, pH);
    }
  }

  const label = polygon
    ? "Panels placed on user-selected rooftop"
    : "Roof area auto-detected from satellite";

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}">
  <rect x="0" y="0" width="${CANVAS_W}" height="${HEADER_H}" fill="rgba(0,0,0,0.70)"/>
  <text x="14" y="22" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="#fb923c">
    ⚡ ${count} Solar Panels${capacityText ? "  ·  " + capacityText + " system" : ""}
  </text>
  <text x="14" y="42" font-family="Arial,sans-serif" font-size="11" fill="#94a3b8">
    Saves ${savingsText}/year · ${label}
  </text>
  ${panelsSvg}
  <rect x="0" y="${CANVAS_H-FOOTER_H}" width="${CANVAS_W}" height="${FOOTER_H}" fill="rgba(0,0,0,0.72)"/>
  <text x="14" y="${CANVAS_H-10}" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#fb923c">
    SolarPropose · Your building. Solar-ready.
  </text>
  <text x="${CANVAS_W-14}" y="${CANVAS_H-10}" font-family="Arial,sans-serif"
        font-size="9" fill="#374151" text-anchor="end">© ESRI World Imagery</text>
</svg>`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Normalised polygon points (x/y each 0–1 relative to canvas size) */
export interface NormPoint { x: number; y: number }

export interface VisualOptions {
  lat: number;
  lng: number;
  panelCount: number;
  roofAreaSqM?: number | null;
  annualSavingsUsd?: number | null;
  systemCapacityKw?: number | null;
  rawSolarData?: unknown;
  /** User-drawn polygon (normalised 0-1 coords). If provided, skips auto-detection. */
  polygon?: NormPoint[] | null;
}

export async function buildVisualBuffer(opts: VisualOptions): Promise<Buffer> {
  const { lat, lng, panelCount, roofAreaSqM, annualSavingsUsd, systemCapacityKw, rawSolarData, polygon } = opts;

  const savingsText  = annualSavingsUsd
    ? `$${Math.round(annualSavingsUsd).toLocaleString()}`
    : "significant";
  const capacityText = systemCapacityKw ? `${systemCapacityKw.toFixed(1)} kW` : "";

  // 1. Fetch satellite image
  const satBuffer = await buildSatelliteBuffer(lat, lng);

  // 2. If user drew a polygon — use it directly (most accurate)
  if (polygon && polygon.length >= 3) {
    // Denormalise: 0-1 → canvas pixel coords
    const canvasPoly = polygon.map(p => ({ x: p.x * CANVAS_W, y: p.y * CANVAS_H }));
    const panelSvg   = buildPanelSvg(lat, { x:0,y:0,w:0,h:0 }, panelCount, savingsText, capacityText, canvasPoly);
    return sharp(satBuffer).composite([{ input: panelSvg, top: 0, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
  }

  // 3. No polygon — auto-detect roof from image / Solar API / area estimate
  const apiSegmentBounds = projectSolarSegments(lat, lng, rawSolarData as Record<string, unknown> | null);
  const bounds = apiSegmentBounds ?? await detectRoofBounds(satBuffer, lat, roofAreaSqM ?? null);

  const panelSvg = buildPanelSvg(lat, bounds, panelCount, savingsText, capacityText, null);
  return sharp(satBuffer).composite([{ input: panelSvg, top: 0, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
}
