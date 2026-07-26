"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/trulala" || pathname.startsWith("/trulala/")) {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}
