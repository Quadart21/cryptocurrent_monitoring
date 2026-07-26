import type { Metadata } from "next";
import { AdminRoot } from "@/components/admin/AdminRoot";

export const metadata: Metadata = {
  title: "Админка",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminRoot>{children}</AdminRoot>;
}
