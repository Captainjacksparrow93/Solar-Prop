import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";

export async function POST(req: NextRequest) {
  try {
    const userId = await getDefaultUserId();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const leadId = formData.get("leadId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!leadId) {
      return NextResponse.json({ error: "leadId required" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Accept JPEG, PNG, WebP only" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum 10MB" },
        { status: 400 }
      );
    }

    // Verify lead exists and belongs to user
    const lead = await db.lead.findUnique({
      where: { id: leadId },
      include: { solarAnalysis: true },
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

    // Upload to Vercel Blob
    const filename = `solar-${leadId}-${Date.now()}.${file.type.split("/")[1]}`;
    const blob = await put(filename, file, {
      access: "public",
    });

    // Update SolarAnalysis with image URL
    const analysis = await db.solarAnalysis.upsert({
      where: { leadId },
      update: {
        uploadedImageUrl: blob.url,
      },
      create: {
        leadId,
        uploadedImageUrl: blob.url,
      },
    });

    return NextResponse.json({ url: blob.url, analysis });
  } catch (error) {
    console.error("Image upload error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
