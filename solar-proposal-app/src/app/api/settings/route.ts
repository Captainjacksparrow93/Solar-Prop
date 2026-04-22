import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";

export async function PATCH(req: NextRequest) {
  const userId = await getDefaultUserId();
  const body = await req.json();
  const { company, user } = body;

  const ops = [];

  if (user) {
    ops.push(
      db.user.update({
        where: { id: userId },
        data: { name: user.name },
      })
    );
  }

  if (company) {
    ops.push(
      db.company.upsert({
        where: { userId },
        update: company,
        create: { ...company, userId },
      })
    );
  }

  await Promise.all(ops);

  return NextResponse.json({ success: true });
}
