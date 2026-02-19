"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import {
  FileText,
  Cpu,
  Globe,
  Palette,
  FlaskConical,
  ScrollText,
  Newspaper,
  Route,
  Calculator,
  Layers,
  CalendarClock,
} from "lucide-react";

const tabs = [
  { href: "/studio/prompts", label: "Prompts", icon: FileText },
  { href: "/studio/models", label: "Models", icon: Cpu },
  { href: "/studio/destinations", label: "Destinations", icon: Globe },
  { href: "/studio/guidelines", label: "Guidelines", icon: Palette },
  { href: "/studio/test", label: "Test", icon: FlaskConical },
  { href: "/studio/logs", label: "Logs", icon: ScrollText },
  { href: "/studio/publications", label: "Publications", icon: Newspaper },
  { href: "/studio/routing-rules", label: "Routing", icon: Route },
  { href: "/studio/scoring", label: "Scoring", icon: Calculator },
  { href: "/studio/tiers", label: "Tiers", icon: Layers },
  { href: "/studio/calendar-slots", label: "Slots", icon: CalendarClock },
];

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Prompt Studio</h1>
        <p className="text-muted-foreground">
          Configure prompts, models, destinations, and guidelines in one place.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Configuration Area
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400/80">
            Studio controls how the platform works. Changes here affect AI
            generation, prompts, and content routing. If you&apos;re not sure
            what you&apos;re doing, please don&apos;t modify anything.
          </p>
        </div>
      </div>

      <div className="border-b">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;
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
