"use client";

import { createContext, type ReactNode } from "react";
import type { AdCreative } from "@/lib/store-types";

export type PublicAd = Pick<
  AdCreative,
  | "id"
  | "type"
  | "placement"
  | "title"
  | "body"
  | "href"
  | "imageUrl"
  | "image"
  | "exchangerId"
  | "pairs"
  | "priority"
>;

export type AdsContextValue = {
  ads: PublicAd[];
  ready: boolean;
};

export const AdsContext = createContext<AdsContextValue | null>(null);

export function AdsProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: AdsContextValue;
}) {
  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}
