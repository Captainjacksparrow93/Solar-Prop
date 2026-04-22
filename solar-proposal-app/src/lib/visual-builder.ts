/**
 * Visual builder — ESRI satellite tiles + per-building roof detection + accurate panel overlay.
 *
 * Per-building customisation pipeline:
 *   1. Fetch 3×3 grid of ESRI satellite tiles centred on building coords
 *   2. BFS flood-fill from image centre to find the actual roof colour boundary
 *   3. Convert flood-fill pixel count → real sq-m area (unique per building)
 *   4. Calculate panel count from real area: 2m×1m panels, 72% usable fraction
 *   5. Render panels proportionally inside the detected roof boundary
 *
 * Result: every building gets a different image — different roof size, shape,
 * panel count, and savings overlay.
 */
import sharp from "sharp";

// ─── Canvas / display constants ───────────────────────────────────────────────
const TILE_SIZE = 256;
const CANVAS_W  = 640;
const CANVAS_H  = 400;
const ZOOM      = 19;   // ESRI tiles zoom — ~0.30 m/px at equator

// Panel real-world dimensions (metres, standard 60-cell monocrystalline)
const PANEL_W_M   = 2.0;
const PANEL_H_M   = 1.0;
const PANEL_GAP_M = 0.20;
// Render at 1.4× real size for screen legibility
const VIS_SCALE   = 1.4;

// Header / footer overlay heights
const HEADER_H = 55;
const FOOTER_H = 32;

// ─── Geo maths ────────────────────────────────────────────────────────────────

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

// ─── ESRI tile fetcher ────────────────────────────────────────────────────────

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

  const totalW = TILE_SIZE * GRID;
  const totalH = TILE_SIZE * GRID;

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

// ─── Roof detection — BFS flood-fill from image centre ───────────────────────
//
// Each satellite image is centred on the building's lat/lng. We BFS from the
// centre pixel expanding to neighbours with similar colour. The result:
//   • bounds  — the pixel bounding box of the roof on the canvas
//   • estimatedAreaSqM — the roof area in real sq-m from pixel count
//
// estimatedAreaSqM is the key: it is UNIQUE per building because it comes
// from the actual pixels, not a fixed 800 sqm default.

interface RoofBounds { x: number; y: number; w: number; h: number }
interface DetectResult { bounds: RoofBounds; estimatedAreaSqM: number | null }

async function detectRoof(
  satBuffer: Buffer,
  lat: number,
  hintAreaSqM: number | null,
): Promise<DetectResult> {
  // Analysis at 320×200 (2× downscale from 640×400 canvas)
  const AW = 320, AH = 200;

  const { data: pixels } = await sharp(satBuffer)
    .resize(AW, AH)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  function getRgb(x: number, y: number): [number, number, number] {
    const i = (y * AW + x) * 3;
    return [pixels[i], pixels[i + 1], pixels[i + 2]];
  }

  function rgbDist(a: [number, number, number], b: [number, number, number]): number {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
  }

  // Sample 5×5 patch around centre for robust reference colour
  const cx = Math.floor(AW / 2);
  const cy = Math.floor(AH / 2);
  let rS = 0, gS = 0, bS = 0, n = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const [r, g, b] = getRgb(Math.max(0, Math.min(AW - 1, cx + dx)),
                                Math.max(0, Math.min(AH - 1, cy + dy)));
      rS += r; gS += g; bS += b; n++;
    }
  }
  const ref: [number, number, number] = [rS / n, gS / n, bS / n];

  function floodFill(tol: number) {
    const visited = new Uint8Array(AW * AH);
    const q = new Int32Array(AW * AH);
    let qHead = 0, qTail = 0;

    const startIdx = cy * AW + cx;
    visited[startIdx] = 1;
    q[qTail++] = startIdx;

    let minX = cx, maxX = cx, minY = cy, maxY = cy;
    const DX = [-1, 1, 0, 0];
    const DY = [0, 0, -1, 1];

    while (qHead < qTail) {
      const idx = q[qHead++];
      const px  = idx % AW;
      const py  = (idx - px) / AW;

      if (px < minX) minX = px; else if (px > maxX) maxX = px;
      if (py < minY) minY = py; else if (py > maxY) maxY = py;

      for (let d = 0; d < 4; d++) {
        const nx = px + DX[d];
        const ny = py + DY[d];
        if (nx < 0 || nx >= AW || ny < 0 || ny >= AH) continue;
        const ni = ny * AW + nx;
        if (visited[ni]) continue;
        if (rgbDist(ref, getRgb(nx, ny)) <= tol) {
          visited[ni] = 1;
          q[qTail++] = ni;
        }
      }
    }
    return { minX, minY, maxX, maxY, count: qTail };
  }

  const scaleX = CANVAS_W / AW;
  const scaleY = CANVAS_H / AH;
  // Each analysis pixel covers this many real-world metres (2× canvas scale)
  const analysisMpp = mpp(lat, ZOOM) * (CANVAS_W / AW);

  for (const tol of [22, 38, 55]) {
    const { minX, minY, maxX, maxY, count } = floodFill(tol);
    const dw = maxX - minX;
    const dh = maxY - minY;

    if (dw < 8 || dh < 5) continue;

    const ratio = (dw * dh) / (AW * AH);
    if (ratio > 0.78) continue;

    const rcx = (minX + maxX) / 2;
    const rcy = (minY + maxY) / 2;
    if (Math.abs(rcx - cx) > AW * 0.35 || Math.abs(rcy - cy) > AH * 0.35) continue;

    const aspect = dw / Math.max(dh, 1);
    if (aspect > 8 || aspect < 0.12) continue;

    const rx = Math.max(0,            (minX - 1) * scaleX);
    const ry = Math.max(HEADER_H,     (minY - 1) * scaleY);
    const rw = Math.min(CANVAS_W - rx,(dw + 2)   * scaleX);
    const rh = Math.min(CANVAS_H - FOOTER_H - ry, (dh + 2) * scaleY);

    if (rw < 30 || rh < 20) continue;

    // Pixel count → real sq-m area (unique per building)
    const estimatedAreaSqM = Math.round(count * analysisMpp * analysisMpp);

    return {
      bounds: { x: Math.round(rx), y: Math.round(ry), w: Math.round(rw), h: Math.round(rh) },
      estimatedAreaSqM,
    };
  }

  // Flood-fill failed — use hint area or generic centred rectangle
  return { bounds: fallbackBounds(lat, hintAreaSqM), estimatedAreaSqM: null };
}

function fallbackBounds(lat: number, roofAreaSqM: number | null): RoofBounds {
  const scale    = mpp(lat, ZOOM);
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

  rw = Math.max(CANVAS_W * 0.20, Math.min(CANVAS_W * 0.88, rw));
  rh = Math.max(usable_h * 0.20, Math.min(usable_h * 0.88, rh));

  return {
    x: Math.round((CANVAS_W - rw) / 2),
    y: Math.round(HEADER_H + (usable_h - rh) / 2),
    w: Math.round(rw),
    h: Math.round(rh),
  };
}

// ─── Panel count from area ────────────────────────────────────────────────────

/** 2m×1m panel, 72% usable roof fraction, 15% spacing → 2.3 sqm effective per panel */
function panelsFromArea(areaSqM: number): number {
  return Math.max(4, Math.floor((areaSqM * 0.72) / 2.3));
}

// ─── Solar API roof segment projection ───────────────────────────────────────

function projectSolarSegments(
  lat: number,
  lng: number,
  rawSolarData: Record<string, unknown> | null | undefined,
): RoofBounds | null {
  const segments: any[] = (rawSolarData as any)?.solarPotential?.roofSegmentStats ?? [];
  if (!segments.length) return null;

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

// ─── Panel SVG ────────────────────────────────────────────────────────────────

function panelSvgInner(x: number, y: number, pW: number, pH: number): string {
  const showGrid = pW >= 10 && pH >= 6;
  const grid = showGrid
    ? `<line x1="${x + pW * 0.33}" y1="${y}" x2="${x + pW * 0.33}" y2="${y + pH}" stroke="rgba(96,165,250,.35)" stroke-width="0.4"/>
       <line x1="${x + pW * 0.67}" y1="${y}" x2="${x + pW * 0.67}" y2="${y + pH}" stroke="rgba(96,165,250,.35)" stroke-width="0.4"/>
       <line x1="${x}" y1="${y + pH * 0.5}" x2="${x + pW}" y2="${y + pH * 0.5}" stroke="rgba(96,165,250,.35)" stroke-width="0.4"/>`
    : "";
  const highlight = pW >= 8
    ? `<rect x="${x + 1}" y="${y + 1}" width="${Math.round(pW * 0.4)}" height="1" fill="rgba(255,255,255,0.18)"/>`
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
  const scale = mpp(lat, ZOOM);
  const pW    = Math.max(6, Math.round((PANEL_W_M   * VIS_SCALE) / scale));
  const pH    = Math.max(4, Math.round((PANEL_H_M   * VIS_SCALE) / scale));
  const gap   = Math.max(1, Math.round((PANEL_GAP_M * VIS_SCALE) / scale));
  const cellW = pW + gap;
  const cellH = pH + gap;

  let panelsSvg = "";
  let count = 0;

  if (polygon && polygon.length >= 3) {
    const pts = polygon.map(p => `${p.x},${p.y}`).join(" ");
    panelsSvg += `<polygon points="${pts}" fill="rgba(59,130,246,0.08)"
      stroke="rgba(96,165,250,0.6)" stroke-width="1.5" stroke-dasharray="5 3"/>`;

    for (let y = gap; y + pH < CANVAS_H - FOOTER_H; y += cellH) {
      for (let x = gap; x + pW < CANVAS_W; x += cellW) {
        if (count >= panelCount) break;
        const pcx = x + pW / 2, pcy = y + pH / 2;
        if (ptInPoly(pcx, pcy, polygon) && pcy >= HEADER_H) {
          panelsSvg += panelSvgInner(x, y, pW, pH);
          count++;
        }
      }
      if (count >= panelCount) break;
    }
  } else {
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
    ? "Panels on user-drawn rooftop"
    : "Rooftop auto-detected from satellite";

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}">
  <rect x="0" y="0" width="${CANVAS_W}" height="${HEADER_H}" fill="rgba(0,0,0,0.70)"/>
  <text x="14" y="22" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="#fb923c">
    ⚡ ${count} Solar Panels${capacityText ? "  ·  " + capacityText + " system" : ""}
  </text>
  <text x="14" y="42" font-family="Arial,sans-serif" font-size="11" fill="#94a3b8">
    Saves ${savingsText}/yr · ${label}
  </text>
  ${panelsSvg}
  <rect x="0" y="${CANVAS_H - FOOTER_H}" width="${CANVAS_W}" height="${FOOTER_H}" fill="rgba(0,0,0,0.72)"/>
  <text x="14" y="${CANVAS_H - 10}" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#fb923c">
    SolarPropose · Your building. Solar-ready.
  </text>
  <text x="${CANVAS_W - 14}" y="${CANVAS_H - 10}" font-family="Arial,sans-serif"
        font-size="9" fill="#374151" text-anchor="end">© ESRI World Imagery</text>
</svg>`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface NormPoint { x: number; y: number }

export interface VisualOptions {
  lat: number;
  lng: number;
  panelCount: number;        // stored value from DB — may be overridden by image analysis
  roofAreaSqM?: number | null;
  annualSavingsUsd?: number | null;
  systemCapacityKw?: number | null;
  rawSolarData?: unknown;
  polygon?: NormPoint[] | null;
}

export async function buildVisualBuffer(opts: VisualOptions): Promise<Buffer> {
  const { lat, lng, roofAreaSqM, annualSavingsUsd, systemCapacityKw, rawSolarData, polygon } = opts;

  const savingsText  = annualSavingsUsd
    ? `₹${Math.round(annualSavingsUsd).toLocaleString("en-IN")}`
    : "significant";

  // 1. Fetch satellite image
  const satBuffer = await buildSatelliteBuffer(lat, lng);

  // 2. User-drawn polygon — most accurate, skip all detection
  if (polygon && polygon.length >= 3) {
    const canvasPoly = polygon.map(p => ({ x: p.x * CANVAS_W, y: p.y * CANVAS_H }));
    // Count panels that fit in polygon at real scale
    const scale = mpp(lat, ZOOM);
    const pW  = Math.max(6, Math.round((PANEL_W_M * VIS_SCALE) / scale));
    const pH  = Math.max(4, Math.round((PANEL_H_M * VIS_SCALE) / scale));
    const gap = Math.max(1, Math.round((PANEL_GAP_M * VIS_SCALE) / scale));
    let polyPanels = 0;
    for (let y = gap; y + pH < CANVAS_H - FOOTER_H; y += pH + gap) {
      for (let x = gap; x + pW < CANVAS_W; x += pW + gap) {
        if (ptInPoly(x + pW / 2, y + pH / 2, canvasPoly)) polyPanels++;
      }
    }
    const capacityText = polyPanels > 0
      ? `${((polyPanels * 400) / 1000).toFixed(1)} kW`
      : (systemCapacityKw ? `${systemCapacityKw.toFixed(1)} kW` : "");
    const panelSvg = buildPanelSvg(lat, { x: 0, y: 0, w: 0, h: 0 }, polyPanels, savingsText, capacityText, canvasPoly);
    return sharp(satBuffer).composite([{ input: panelSvg, top: 0, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
  }

  // 3. Try Solar API segment bounds (most precise when available)
  const apiSegmentBounds = projectSolarSegments(lat, lng, rawSolarData as Record<string, unknown> | null);

  // 4. Run per-building roof detection from satellite pixels
  const { bounds: detectedBounds, estimatedAreaSqM } = await detectRoof(satBuffer, lat, roofAreaSqM ?? null);

  // Pick best bounds
  const bounds = apiSegmentBounds ?? detectedBounds;

  // 5. Panel count: prefer image-derived area → stored DB value
  //    Image-derived is unique per building; DB value may be the generic 800sqm default
  const effectiveArea = estimatedAreaSqM ?? roofAreaSqM;
  const effectivePanelCount = effectiveArea != null
    ? panelsFromArea(effectiveArea)
    : opts.panelCount;

  const capacityText = systemCapacityKw
    ? `${((effectivePanelCount * 400) / 1000).toFixed(1)} kW`
    : "";

  const panelSvg = buildPanelSvg(lat, bounds, effectivePanelCount, savingsText, capacityText, null);
  return sharp(satBuffer).composite([{ input: panelSvg, top: 0, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
}

/** Exported for score route — same formula as panelsFromArea in google-solar.ts */
export { panelsFromArea };
