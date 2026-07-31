"use client";

import { useState } from "react";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminPasswordGate } from "@/components/admin/AdminPasswordGate";
import { AdminProvider, useAdmin } from "@/components/admin/AdminProvider";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminTotpGate,
  wasTotpDeferred,
} from "@/components/admin/AdminTotpGate";

function AdminGate({ children }: { children: React.ReactNode }) {
  const { checking, authed, me } = useAdmin();
  const [totpSkipped, setTotpSkipped] = useState(() => wasTotpDeferred());

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">
        Загрузка…
      </div>
    );
  }

  if (!authed) return <AdminLogin />;

  if (me?.mustChangePassword) {
    return <AdminPasswordGate />;
  }

  if (me && !me.totpEnabled && !totpSkipped) {
    return (
      <AdminTotpGate
        onDismiss={() => setTotpSkipped(true)}
      />
    );
  }

  return <AdminShell>{children}</AdminShell>;
}

export function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminGate>{children}</AdminGate>
    </AdminProvider>
  );
}
