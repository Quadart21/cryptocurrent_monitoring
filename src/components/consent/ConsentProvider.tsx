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
import {
  makeConsent,
  readConsentFromDocument,
  writeConsentToDocument,
  type ConsentState,
} from "@/lib/consent";

type ConsentContextValue = {
  ready: boolean;
  consent: ConsentState | null;
  acceptAll: () => void;
  acceptNecessary: () => void;
  analyticsAllowed: boolean;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [consent, setConsent] = useState<ConsentState | null>(null);

  useEffect(() => {
    setConsent(readConsentFromDocument());
    setReady(true);
  }, []);

  const acceptAll = useCallback(() => {
    const next = makeConsent(true);
    writeConsentToDocument(next);
    setConsent(next);
  }, []);

  const acceptNecessary = useCallback(() => {
    const next = makeConsent(false);
    writeConsentToDocument(next);
    setConsent(next);
  }, []);

  const value = useMemo<ConsentContextValue>(
    () => ({
      ready,
      consent,
      acceptAll,
      acceptNecessary,
      analyticsAllowed: Boolean(consent?.analytics),
    }),
    [ready, consent, acceptAll, acceptNecessary],
  );

  return (
    <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
  );
}

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used within ConsentProvider");
  return ctx;
}
