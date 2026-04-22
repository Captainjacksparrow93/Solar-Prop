import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";

export interface DetectedZone {
  id: string;
  label: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  estimatedAreaSqM: number;
  usable: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getDefaultUserId();
    const { imageUrl, leadId } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
    }

    if (!leadId) {
      return NextResponse.json({ error: "leadId required" }, { status: 400 });
    }

    // Verify lead exists and belongs to user
    const lead = await db.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Call Google Cloud Vision API
    const apiKey = process.env.GOOGLE_SOLAR_API_KEY || process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Cloud API key not configured" },
        { status: 500 }
      );
    }

    const visionRequest = {
      requests: [
        {
          image: {
            source: {
              imageUri: imageUrl,
            },
          },
          features: [
            { type: "OBJECT_LOCALIZATION" },
            { type: "LABEL_DETECTION", maxResults: 10 },
            { type: "IMAGE_PROPERTIES" },
          ],
        },
      ],
    };

    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(visionRequest),
      }
    );

    if (!visionResponse.ok) {
      const errorData = await visionResponse.json();
      console.error("Google Vision API error:", errorData);
      return NextResponse.json(
        { error: "Vision API call failed" },
        { status: 500 }
      );
    }

    const visionData = await visionResponse.json();
    const annotations = visionData.responses?.[0];

    // Parse detected zones from Vision API response
    const zones = parseZones(annotations);

    // Save to database
    await db.solarAnalysis.upsert({
      where: { leadId },
      update: {
        detectedZones: zones as any,
      },
      create: {
        leadId,
        detectedZones: zones as any,
      },
    });

    return NextResponse.json({ zones });
  } catch (error) {
    console.error("Zone detection error:", error);
    const message = error instanceof Error ? error.message : "Detection failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseZones(annotations: any): DetectedZone[] {
  const zones: DetectedZone[] = [];

  // Try to extract zones from object localization
  if (annotations?.localizedObjectAnnotations) {
    const roofLabels = [
      "roof",
      "building",
      "structure",
      "terrace",
      "solar panel",
    ];

    annotations.localizedObjectAnnotations.forEach(
      (obj: any, index: number) => {
        const label = obj.name?.toLowerCase() || `Zone ${index + 1}`;
        const isRoof = roofLabels.some(
          (l) => label.includes(l) || obj.name?.toLowerCase().includes(l)
        );

        if (isRoof || index < 3) {
          // Include top roof-like objects
          const bbox = obj.boundingPoly?.normalizedVertices;
          if (bbox && bbox.length >= 4) {
            const xs = bbox.map((v: any) => v.x || 0);
            const ys = bbox.map((v: any) => v.y || 0);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const maxX = Math.max(...xs);
            const maxY = Math.max(...ys);

            zones.push({
              id: `zone-${index}`,
              label: label.charAt(0).toUpperCase() + label.slice(1),
              boundingBox: {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
              },
              estimatedAreaSqM: 100, // Placeholder, will be refined with user input
              usable: !label.includes("shaded") && !label.includes("pitched"),
            });
          }
        }
      }
    );
  }

  // If no zones detected, create a default zone covering the center of the image
  if (zones.length === 0) {
    zones.push({
      id: "zone-default",
      label: "Detected Roof Area",
      boundingBox: {
        x: 0.15,
        y: 0.15,
        width: 0.7,
        height: 0.7,
      },
      estimatedAreaSqM: 100,
      usable: true,
    });
  }

  return zones;
}
