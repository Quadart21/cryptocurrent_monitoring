import type { ReactNode } from "react";
import type { NavItem } from "@/components/shell/nav";

const paths: Record<NavItem["icon"], ReactNode> = {
  exchange: (
    <>
      <path d="M7 10h12" />
      <path d="M15 6l4 4-4 4" />
      <path d="M17 14H5" />
      <path d="M9 18l-4-4 4-4" />
    </>
  ),
  list: (
    <>
      <rect x="4" y="5" width="16" height="4" rx="1.5" />
      <rect x="4" y="11" width="16" height="4" rx="1.5" />
      <rect x="4" y="17" width="12" height="4" rx="1.5" />
    </>
  ),
  ad: (
    <>
      <path d="M4 8h10l6 4-6 4H4V8z" />
      <path d="M8 12h4" />
    </>
  ),
  plus: (
    <>
      <path d="M12 6v12" />
      <path d="M6 12h12" />
    </>
  ),
  cabinet: (
    <>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5.5 19c1.6-3 4-4.5 6.5-4.5S17 16 18.5 19" />
    </>
  ),
  block: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M7 7l10 10" />
    </>
  ),
  rates: (
    <>
      <path d="M4 18V6" />
      <path d="M4 18h16" />
      <path d="M8 14l3-4 3 2 4-6" />
    </>
  ),
  blog: (
    <>
      <path d="M6 5h12v14H6z" />
      <path d="M9 9h6" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </>
  ),
};

export function NavIcon({
  name,
  className = "size-5",
}: {
  name: NavItem["icon"];
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}
