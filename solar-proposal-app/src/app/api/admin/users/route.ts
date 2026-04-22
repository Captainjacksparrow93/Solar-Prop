import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { company: true },
  });

  return NextResponse.json(users);
}

export async function DELETE(req: NextRequest) {
  const { ids } = await req.json();
  if (!Array.isArray(ids)) return NextResponse.json({ error: "ids array required" }, { status: 400 });

  await db.user.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ deleted: ids.length });
}
