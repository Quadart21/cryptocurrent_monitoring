export type NavItem = {
  href: string;
  label: string;
  hint: string;
  icon: "exchange" | "list" | "ad" | "plus" | "cabinet" | "block";
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
    href: "/advertise",
    label: "Реклама",
    hint: "Форматы и тарифы",
    icon: "ad",
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

export function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
