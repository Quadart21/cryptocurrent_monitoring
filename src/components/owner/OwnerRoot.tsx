"use client";

import { OwnerLogin } from "@/components/owner/OwnerLogin";
import { OwnerProvider, useOwner } from "@/components/owner/OwnerProvider";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";

function OwnerGate() {
  const { checking, authed } = useOwner();

  if (checking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-4">
        <div
          className="size-10 animate-pulse rounded-2xl bg-accent/20"
          aria-hidden
        />
        <p className="text-sm text-ink-muted">Открываем кабинет…</p>
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
