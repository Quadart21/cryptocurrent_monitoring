export type NavItem = {
  href: string;
  label: string;
  hint: string;
  icon: "exchange" | "list" | "ad" | "plus" | "cabinet" | "block" | "rates" | "blog" | "api";
};

export const SITE_NAV: NavItem[] = [
  {
    href: "/",
    label: "Обмен",
    hint: "Курсы и калькулятор",
    icon: "exchange",
  },
  {
    href: "/exchangers",
    label: "Обменники",
    hint: "Каталог сервисов",
    icon: "list",
  },
  {
    href: "/blog",
    label: "Новости",
    hint: "События крипторынка",
    icon: "blog",
  },
  {
    href: "/advertise",
    label: "Реклама",
    hint: "Форматы и тарифы",
    icon: "ad",
  },
  {
    href: "/api-docs",
    label: "API",
    hint: "Документация и ключ",
    icon: "api",
  },
  {
    href: "/apply",
    label: "Добавить",
    hint: "Заявка обменника",
    icon: "plus",
  },
  {
    href: "/cabinet",
    label: "Кабинет",
    hint: "Для владельцев",
    icon: "cabinet",
  },
  {
    href: "/blacklist",
    label: "Чёрный список",
    hint: "Ненадёжные сервисы",
    icon: "block",
  },
];

/** Primary thumb destinations for sticky bottom bar (phones). */
export const MOBILE_TAB_NAV: Array<Pick<NavItem, "href" | "label" | "icon">> = [
  { href: "/", label: "Обмен", icon: "exchange" },
  { href: "/exchangers", label: "Список", icon: "list" },
  { href: "/blog", label: "Новости", icon: "blog" },
  { href: "/cabinet", label: "Кабинет", icon: "cabinet" },
];

export function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Public top/footer nav; hide API entry when the feature is off. */
export function publicSiteNav(apiEnabled = true): NavItem[] {
  if (apiEnabled) return SITE_NAV;
  return SITE_NAV.filter((item) => item.href !== "/api-docs");
}

