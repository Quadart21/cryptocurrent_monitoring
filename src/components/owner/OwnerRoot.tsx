"use client";

import { OwnerLogin } from "@/components/owner/OwnerLogin";
import { OwnerProvider, useOwner } from "@/components/owner/OwnerProvider";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";

function OwnerGate() {
  const { checking, authed } = useOwner();

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">
        Загрузка…
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
