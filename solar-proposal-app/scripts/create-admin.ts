/**
 * One-time script to create the admin user.
 * Run: npx tsx scripts/create-admin.ts
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

const ADMIN_EMAIL = "admin@solarpropose.com";
const ADMIN_PASSWORD = "SolarAdmin@2026";
const ADMIN_NAME = "Admin";

async function main() {
  console.log("Creating admin user...");

  const existing = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`Admin user ${ADMIN_EMAIL} already exists. Skipping.`);
    return;
  }

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const user = await db.user.create({
    data: {
      email: ADMIN_EMAIL,
      password: hashed,
      name: ADMIN_NAME,
      role: "ADMIN",
      company: {
        create: {
          name: "SolarPropose Admin",
        },
      },
    },
  });

  console.log(`Admin created:`);
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`  User ID:  ${user.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
