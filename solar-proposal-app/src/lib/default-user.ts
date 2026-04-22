import { db } from "@/lib/db";

export async function getDefaultUserId(): Promise<string> {
  const user = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("No users in database. Run seed script first.");
  return user.id;
}
