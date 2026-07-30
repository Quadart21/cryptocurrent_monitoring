"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AdminCounts,
  AdminMe,
  AdminOverview,
} from "@/components/admin/types";

type AdminContextValue = {
  checking: boolean;
  authed: boolean;
  busy: boolean;
  setBusy: (v: boolean) => void;
  overview: AdminOverview | null;
  counts: AdminCounts | null;
  me: AdminMe | null;
  lastGlobalSyncAt: string | null;
  can: (permission: string) => boolean;
  refresh: () => Promise<boolean>;
  login: (
    login: string,
    password: string,
    totpCode?: string,
  ) => Promise<{ error: string | null; needsTotp?: boolean }>;
  logout: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

const emptyCounts: AdminCounts = {
  exchangers: 0,
  active: 0,
  pending: 0,
  error: 0,
  rates: 0,
  blacklist: 0,
  pendingReviews: 0,
  pendingComplaints: 0,
  pendingCatalog: 0,
  achievements: 0,
  ads: 0,
  bannerMissing: 0,
};

export function AdminProvider({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [overview, setOverview] = useState<AdminOverview | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/overview", { cache: "no-store" });
    if (res.status === 401 || !res.ok) {
      setAuthed(false);
      setOverview(null);
      return false;
    }
    const data = (await res.json()) as AdminOverview;
    setOverview(data);
    setAuthed(true);
    return true;
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
      setChecking(false);
    })();
  }, [refresh]);

  const login = useCallback(
    async (loginValue: string, password: string, totpCode?: string) => {
      setBusy(true);
      try {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            login: loginValue,
            password,
            totpCode,
          }),
        });
        const body = (await res.json()) as {
          error?: string;
          needsTotp?: boolean;
        };
        if (!res.ok) {
          return {
            error: body.error ?? "Неверный логин или пароль",
            needsTotp: Boolean(body.needsTotp),
          };
        }
        const ok = await refresh();
        if (!ok) {
          return { error: "Сессия не сохранилась, попробуйте ещё раз" };
        }
        return { error: null };
      } catch {
        return { error: "Сеть недоступна" };
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setOverview(null);
  }, []);

  const me = overview?.me ?? null;
  const permSet = useMemo(
    () => new Set(me?.permissions ?? []),
    [me?.permissions],
  );

  const can = useCallback(
    (permission: string) => permSet.has(permission),
    [permSet],
  );

  const value = useMemo<AdminContextValue>(
    () => ({
      checking,
      authed,
      busy,
      setBusy,
      overview,
      counts: overview?.counts ?? (authed ? emptyCounts : null),
      me,
      lastGlobalSyncAt: overview?.lastGlobalSyncAt ?? null,
      can,
      refresh,
      login,
      logout,
    }),
    [checking, authed, busy, overview, me, can, refresh, login, logout],
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
