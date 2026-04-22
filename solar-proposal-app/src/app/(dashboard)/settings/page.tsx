import { db } from "@/lib/db";
import { getDefaultUserId } from "@/lib/default-user";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await getDefaultUserId();

  const [user, company] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    db.company.findUnique({ where: { userId } }),
  ]);

  return <SettingsClient user={user} company={company} />;
}
