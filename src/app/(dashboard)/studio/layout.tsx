"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FileText,
  Cpu,
  Globe,
  Palette,
  FlaskConical,
} from "lucide-react";

const tabs = [
  { href: "/studio/templates", label: "Templates", icon: FileText },
  { href: "/studio/models", label: "Models", icon: Cpu },
  { href: "/studio/destinations", label: "Destinations", icon: Globe },
  { href: "/studio/guidelines", label: "Guidelines", icon: Palette },
  { href: "/studio/test", label: "Test", icon: FlaskConical },
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
