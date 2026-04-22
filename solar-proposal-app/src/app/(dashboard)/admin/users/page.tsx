import { db } from "@/lib/db";
import { UsersAdminClient } from "@/components/admin/UsersAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { company: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <span className="text-sm text-slate-400">{users.length} total</span>
      </div>
      <UsersAdminClient initialUsers={users} />
    </div>
  );
}
