"use client";

import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminProvider, useAdmin } from "@/components/admin/AdminProvider";
import { AdminShell } from "@/components/admin/AdminShell";

function AdminGate({ children }: { children: React.ReactNode }) {
  const { checking, authed } = useAdmin();

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">
        Загрузка…
      </div>
    );
  }

  if (!authed) return <AdminLogin />;
  return <AdminShell>{children}</AdminShell>;
}

export function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminGate>{children}</AdminGate>
    </AdminProvider>
  );
}
