"use client";

import { OwnerLogin } from "@/components/owner/OwnerLogin";
import { OwnerProvider, useOwner } from "@/components/owner/OwnerProvider";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";

function OwnerGate() {
  const { checking, authed } = useOwner();

  if (checking) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 top-10 size-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.28),transparent_70%)] blur-2xl"
        />
        <p className="relative text-sm text-ink-muted">Загрузка кабинета…</p>
      </div>
    );
  }

  if (!authed) return <OwnerLogin />;
  return <OwnerDashboard />;
}

export function OwnerRoot() {
  return (
    <OwnerProvider>
      <OwnerGate />
    </OwnerProvider>
  );
}
