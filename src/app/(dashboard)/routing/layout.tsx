"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Lightbulb,
  Calendar,
  Inbox,
} from "lucide-react";

const tabs = [
  { href: "/routing", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/routing/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/routing/calendar", label: "Calendar", icon: Calendar },
  { href: "/routing/queues", label: "Queues", icon: Inbox },
];

export default function RoutingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Content Routing</h1>
        <p className="text-muted-foreground">
          Route, score, and schedule content across publications.
        </p>
      </div>

      <div className="border-b">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div>{children}</div>
    </div>
  );
}
