import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    // Check for seed secret in header
    const secret = req.headers.get("x-seed-secret");
    const expectedSecret = process.env.SEED_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { email, password, name, role = "USER", companyName } = body;

    if (!email || !password || !name || !companyName) {
      return NextResponse.json(
        { error: "Missing required fields: email, password, name, companyName" },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role as "ADMIN" | "USER",
        company: {
          create: {
            name: companyName,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "User created successfully",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
