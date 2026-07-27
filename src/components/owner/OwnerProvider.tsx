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
import type { ExchangerReview, FeedExchanger } from "@/lib/store-types";

export type OwnerExchanger = Pick<
  FeedExchanger,
  | "id"
  | "slug"
  | "name"
  | "website"
  | "feedUrl"
  | "contact"
  | "description"
  | "status"
  | "verified"
  | "rating"
  | "reviews"
  | "reviewsPositive"
  | "reviewsNegative"
  | "pairCount"
  | "approvedAt"
  | "lastSyncAt"
  | "lastError"
  | "logo"
> & {
  workingSince: string;
  traffic: {
    pageViews: number;
    siteClicks: number;
    lastViewAt: string | null;
    lastClickAt: string | null;
    ctr: string;
    daily: Array<{ date: string; pageViews: number; siteClicks: number }>;
  };
};

export type OwnerReview = Pick<
  ExchangerReview,
  | "id"
  | "sentiment"
  | "orderId"
  | "text"
  | "status"
  | "createdAt"
  | "moderatedAt"
  | "ownerReply"
  | "ownerRepliedAt"
>;

type OwnerContextValue = {
  checking: boolean;
  authed: boolean;
  busy: boolean;
  setBusy: (v: boolean) => void;
  exchanger: OwnerExchanger | null;
  reviews: OwnerReview[];
  refresh: () => Promise<boolean>;
  login: (login: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
};

const OwnerContext = createContext<OwnerContextValue | null>(null);

export function OwnerProvider({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exchanger, setExchanger] = useState<OwnerExchanger | null>(null);
  const [reviews, setReviews] = useState<OwnerReview[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/owner/me", { cache: "no-store" });
    if (!res.ok) {
      setAuthed(false);
      setExchanger(null);
      setReviews([]);
      return false;
    }
    const data = (await res.json()) as {
      exchanger: OwnerExchanger;
      reviews: OwnerReview[];
    };
    setAuthed(true);
    setExchanger(data.exchanger);
    setReviews(data.reviews);
    return true;
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
      setChecking(false);
    })();
  }, [refresh]);

  const login = useCallback(
    async (loginValue: string, password: string) => {
      setBusy(true);
      try {
        const res = await fetch("/api/owner/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login: loginValue, password }),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) return body.error ?? "Неверный логин или пароль";
        await refresh();
        return null;
      } catch {
        return "Сеть недоступна";
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await fetch("/api/owner/logout", { method: "POST" });
    setAuthed(false);
    setExchanger(null);
    setReviews([]);
  }, []);

  const value = useMemo<OwnerContextValue>(
    () => ({
      checking,
      authed,
      busy,
      setBusy,
      exchanger,
      reviews,
      refresh,
      login,
      logout,
    }),
    [checking, authed, busy, exchanger, reviews, refresh, login, logout],
  );

  return (
    <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>
  );
}

export function useOwner() {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error("useOwner must be used within OwnerProvider");
  return ctx;
}
