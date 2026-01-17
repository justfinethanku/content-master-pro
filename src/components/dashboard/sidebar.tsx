"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  Brain,
  Search,
  History,
  Settings,
  RefreshCw,
  FlaskConical,
  LayoutDashboard,
  Shield,
  Users,
  Mail,
  Key,
  BarChart3,
  BookOpen,
  Newspaper,
  Bookmark,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Create", href: "/create", icon: Brain },
  { name: "News Feed", href: "/swipe", icon: Newspaper },
  { name: "Captures", href: "/captures", icon: Bookmark },
  { name: "Search", href: "/search", icon: Search },
  { name: "History", href: "/history", icon: History },
  { name: "Studio", href: "/studio", icon: FlaskConical },
  { name: "Sync", href: "/sync", icon: RefreshCw },
  { name: "Settings", href: "/settings", icon: Settings },
];

const adminNavigation = [
  { name: "Invites", href: "/admin/invites", icon: Mail },
  { name: "Partners", href: "/admin/partners", icon: Users },
  { name: "API Usage", href: "/admin/usage", icon: BarChart3 },
];

const partnerNavigation = [
  { name: "Partner Dashboard", href: "/partner", icon: LayoutDashboard },
  { name: "API Keys", href: "/partner/keys", icon: Key },
  { name: "Usage", href: "/partner/usage", icon: BarChart3 },
  { name: "API Docs", href: "/docs/api", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPartner, setIsPartner] = useState(false);

  useEffect(() => {
    async function checkUserRoles() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Check admin role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role === "admin") {
        setIsAdmin(true);
      }

      // Check partner status
      const { data: partner } = await supabase
        .from("partners")
        .select("status")
        .eq("user_id", user.id)
        .single();

      if (partner?.status === "active") {
        setIsPartner(true);
      }
    }

    checkUserRoles();
  }, []);

  const renderNavItems = (items: typeof navigation, sectionKey: string) => {
    return items.map((item) => {
      const isActive =
        pathname === item.href || pathname.startsWith(`${item.href}/`);
      return (
        <Link
          key={`${sectionKey}-${item.name}`}
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.name}
        </Link>
      );
    });
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-background">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          <span className="font-semibold text-foreground">Content Master</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {renderNavItems(navigation, "main")}

        {isAdmin && (
          <>
            <div className="my-4 border-t border-border" />
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
              <Shield className="h-3 w-3" />
              Admin
            </div>
            {renderNavItems(adminNavigation, "admin")}
          </>
        )}

        {isPartner && (
          <>
            <div className="my-4 border-t border-border" />
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
              <Key className="h-3 w-3" />
              Partner API
            </div>
            {renderNavItems(partnerNavigation, "partner")}
          </>
        )}
      </nav>
    </aside>
  );
}
