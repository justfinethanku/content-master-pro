"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/sidebar-context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Brain,
  Calendar,
  Map,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
} from "lucide-react";

const navigation = [
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Deliverables", href: "/deliverables", icon: Package },
  { name: "Roadmap", href: "/roadmap", icon: Map },
  { name: "MCP", href: "/mcp", icon: Plug },
];

// Commented out during frontend rebuild — will re-enable as pages are rebuilt
// const adminNavigation = [
//   { name: "Invites", href: "/admin/invites", icon: Mail },
//   { name: "Partners", href: "/admin/partners", icon: Users },
//   { name: "API Usage", href: "/admin/usage", icon: BarChart3 },
// ];

// const partnerNavigation = [
//   { name: "Partner Dashboard", href: "/partner", icon: LayoutDashboard },
//   { name: "API Keys", href: "/partner/keys", icon: Key },
//   { name: "Usage", href: "/partner/usage", icon: BarChart3 },
//   { name: "API Docs", href: "/docs/api", icon: BookOpen },
// ];

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggle, isMobileOpen, closeMobile } = useSidebar();

  // Auto-close mobile sidebar on navigation
  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  const renderNavItems = (items: typeof navigation, sectionKey: string, mobile?: boolean) => {
    return items.map((item) => {
      const isActive =
        pathname === item.href || pathname.startsWith(`${item.href}/`);

      if (!mobile && isCollapsed) {
        return (
          <Tooltip key={`${sectionKey}-${item.name}`}>
            <TooltipTrigger asChild>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center justify-center rounded-lg p-2 transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              {item.name}
            </TooltipContent>
          </Tooltip>
        );
      }

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

  const sidebarContent = (mobile: boolean) => (
    <>
      <div className={cn(
        "flex h-16 items-center border-b border-border",
        !mobile && isCollapsed ? "justify-center px-2" : "justify-between px-4"
      )}>
        <Link href="/deliverables" className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          {(mobile || !isCollapsed) && (
            <span className="font-semibold text-foreground">Content Master</span>
          )}
        </Link>
        {!mobile && !isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="h-8 w-8"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>
      <nav className={cn(
        "flex-1 space-y-1 overflow-y-auto",
        !mobile && isCollapsed ? "p-2" : "p-4"
      )}>
        {renderNavItems(navigation, mobile ? "mobile" : "main", mobile)}
      </nav>

      {/* Expand button when collapsed (desktop only) */}
      {!mobile && isCollapsed && (
        <div className="border-t border-border p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                className="w-full"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Expand sidebar
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </>
  );

  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex h-screen flex-col border-r border-border bg-background transition-all duration-300",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile sidebar overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMobile}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-background transition-transform duration-300 md:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent(true)}
      </aside>
    </TooltipProvider>
  );
}
