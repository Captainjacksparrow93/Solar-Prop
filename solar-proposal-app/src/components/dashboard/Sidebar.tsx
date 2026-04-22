"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun,
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  Zap,
  Shield,
  Radar,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/scan", icon: Radar, label: "Scan" },
  { href: "/leads", icon: Users, label: "Leads" },
  { href: "/proposals", icon: FileText, label: "Proposals" },
  { href: "/outreach", icon: Send, label: "Outreach" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex flex-col bg-slate-900 border-r border-slate-800">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
          <Sun className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-white text-lg">SolarPropose</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
              {label}
            </Link>
          );
        })}

        <Link
          href="/admin"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            pathname === "/admin" || pathname.startsWith("/admin/")
              ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          )}
        >
          <Shield className="w-[18px] h-[18px]" />
          Admin
        </Link>
      </nav>

      {/* Upgrade hint */}
      <div className="p-4 border-t border-slate-800">
        <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <div className="flex items-center gap-2 text-orange-400 text-xs font-semibold mb-1">
            <Zap className="w-3.5 h-3.5" />
            Pro tip
          </div>
          <p className="text-slate-400 text-xs">
            Set your default pricing in Settings to speed up proposals.
          </p>
        </div>
      </div>
    </aside>
  );
}
