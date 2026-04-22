import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  await db.user.deleteMany({ where: { id } });
  return NextResponse.json({ success: true });
}
