"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  user: { name?: string | null; email?: string | null; role?: "USER" | "ADMIN" };
}

export function Header({ user }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user.email?.[0].toUpperCase() ?? "U";

  return (
    <header className="h-14 flex items-center justify-end px-6 border-b border-slate-800 bg-slate-900 shrink-0">
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
          <span className="text-sm text-slate-300 font-medium hidden sm:block">
            {user.name || user.email}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-xs text-slate-400">{user.email || "admin"}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
