"use client";

import { useState } from "react";
import { toast } from "@/components/ui/Toaster";
import type { UserModel } from "@/generated/prisma/models/User";
import type { CompanyModel } from "@/generated/prisma/models/Company";

type UserWithCompany = UserModel & { company: CompanyModel | null };

interface Props {
  initialUsers: UserWithCompany[];
}

export function UsersAdminClient({ initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = users.filter(
    (u) =>
      !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.company?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(filtered.map((u) => u.id)));
    else setSelected(new Set());
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} user(s)? This cannot be undone.`)) return;

    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });

    if (!res.ok) {
      toast("Failed to delete users", "error");
      return;
    }

    toast(`${selected.size} user(s) deleted`, "success");
    setUsers((prev) => prev.filter((u) => !selected.has(u.id)));
    setSelected(new Set());
  };

  const deleteOne = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) { toast("Failed to delete", "error"); return; }
    toast("User deleted", "success");
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none w-64"
        />
        {selected.size > 0 && (
          <button
            onClick={deleteSelected}
            className="px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/20 transition-colors"
          >
            Delete {selected.size} selected
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="rounded border-slate-600"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Company</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Joined</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-slate-800/30 transition-colors group">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggleOne(u.id)}
                    className="rounded border-slate-600"
                  />
                </td>
                <td className="px-4 py-3 text-sm text-white">{u.name || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{u.email}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{u.company?.name || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full border ${u.role === "ADMIN" ? "bg-orange-500/10 border-orange-500/20 text-orange-400" : "bg-slate-700 border-slate-600 text-slate-300"}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => deleteOne(u.id)}
                    className="text-red-400 hover:text-red-300 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-5 py-8 text-center text-slate-500 text-sm">No users found</p>
        )}
      </div>
    </div>
  );
}
