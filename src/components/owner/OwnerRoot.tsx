"use client";

import { OwnerLogin } from "@/components/owner/OwnerLogin";
import { OwnerProvider, useOwner } from "@/components/owner/OwnerProvider";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";

function OwnerGate() {
  const { checking, authed } = useOwner();

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-ink-muted">
        Загрузка кабинета…
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
