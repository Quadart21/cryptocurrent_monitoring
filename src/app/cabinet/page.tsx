import type { Metadata } from "next";
import { OwnerRoot } from "@/components/owner/OwnerRoot";

export const metadata: Metadata = {
  title: "Кабинет владельца",
  robots: { index: false, follow: false },
};

export default function CabinetPage() {
  return <OwnerRoot />;
}
