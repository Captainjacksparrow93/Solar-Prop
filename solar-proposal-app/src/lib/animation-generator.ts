/**
 * Animation generator — returns the on-demand visual URL for a lead.
 * Images are served by /api/leads/[id]/visual (no Blob storage needed).
 */

export interface GenerateOptions {
  lat?: number | null;
  lng?: number | null;
  satelliteImageUrl?: string;
  panelCount: number;
  annualSavingsUsd?: number | null;
  systemCapacityKw?: number | null;
  leadId: string;
}

/**
 * Returns the URL path for the lead's visual.
 * The actual image is generated on-demand by /api/leads/[id]/visual.
 * No Blob storage, no API keys, no tokens required.
 */
export async function generatePanelComposite(opts: GenerateOptions): Promise<string> {
  // Just return the on-demand route — image is built when requested
  return `/api/leads/${opts.leadId}/visual`;
}
