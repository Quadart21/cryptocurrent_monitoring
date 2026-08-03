export type AdminRole =
  | "owner"
  | "moderator"
  | "editor"
  | "ads"
  | "viewer";

export type AdminPermission =
  | "overview"
  | "exchangers.read"
  | "exchangers.write"
  | "reviews.read"
  | "reviews.write"
  | "complaints.read"
  | "complaints.write"
  | "blacklist.read"
  | "blacklist.write"
  | "banners.read"
  | "banners.write"
  | "blog.read"
  | "blog.write"
  | "telegram.read"
  | "telegram.write"
  | "qualities.read"
  | "qualities.write"
  | "achievements.read"
  | "achievements.write"
  | "ads.read"
  | "ads.write"
  | "ad_tariffs.read"
  | "ad_tariffs.write"
  | "seo.read"
  | "seo.write"
  | "branding.read"
  | "branding.write"
  | "legal.read"
  | "legal.write"
  | "email.read"
  | "email.write"
  | "catalog.read"
  | "catalog.write"
  | "sync.read"
  | "sync.write"
  | "api_clients.read"
  | "api_clients.write"
  | "admins.read"
  | "admins.write";

export type AdminResource =
  | "overview"
  | "exchangers"
  | "reviews"
  | "complaints"
  | "blacklist"
  | "banners"
  | "blog"
  | "telegram"
  | "qualities"
  | "achievements"
  | "ads"
  | "ad_tariffs"
  | "seo"
  | "branding"
  | "legal"
  | "email"
  | "catalog"
  | "sync"
  | "api_clients"
  | "admins";

export const ADMIN_ROLES: AdminRole[] = [
  "owner",
  "moderator",
  "editor",
  "ads",
  "viewer",
];

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  owner: "Owner",
  moderator: "Модератор",
  editor: "Редактор",
  ads: "Реклама",
  viewer: "Наблюдатель",
};

export const ADMIN_ROLE_HINT: Record<AdminRole, string> = {
  owner: "Полный доступ, управление админами",
  moderator: "Обменники, отзывы, жалобы, ЧС, баннеры, API-ключи",
  editor: "Новости, Telegram, качества, ачивки",
  ads: "Креативы и тарифы",
  viewer: "Только просмотр",
};

const ALL_PERMISSIONS: AdminPermission[] = [
  "overview",
  "exchangers.read",
  "exchangers.write",
  "reviews.read",
  "reviews.write",
  "complaints.read",
  "complaints.write",
  "blacklist.read",
  "blacklist.write",
  "banners.read",
  "banners.write",
  "blog.read",
  "blog.write",
  "telegram.read",
  "telegram.write",
  "qualities.read",
  "qualities.write",
  "achievements.read",
  "achievements.write",
  "ads.read",
  "ads.write",
  "ad_tariffs.read",
  "ad_tariffs.write",
  "seo.read",
  "seo.write",
  "branding.read",
  "branding.write",
  "legal.read",
  "legal.write",
  "email.read",
  "email.write",
  "catalog.read",
  "catalog.write",
  "sync.read",
  "sync.write",
  "api_clients.read",
  "api_clients.write",
  "admins.read",
  "admins.write",
];

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[] | "*"> = {
  owner: "*",
  moderator: [
    "overview",
    "exchangers.read",
    "exchangers.write",
    "reviews.read",
    "reviews.write",
    "complaints.read",
    "complaints.write",
    "blacklist.read",
    "blacklist.write",
    "banners.read",
    "banners.write",
    "api_clients.read",
    "api_clients.write",
  ],
  editor: [
    "overview",
    "exchangers.read",
    "reviews.read",
    "blog.read",
    "blog.write",
    "telegram.read",
    "telegram.write",
    "qualities.read",
    "qualities.write",
    "achievements.read",
    "achievements.write",
  ],
  ads: [
    "overview",
    "ads.read",
    "ads.write",
    "ad_tariffs.read",
    "ad_tariffs.write",
  ],
  viewer: [
    "overview",
    "exchangers.read",
    "reviews.read",
    "complaints.read",
    "blacklist.read",
    "banners.read",
    "blog.read",
    "telegram.read",
    "qualities.read",
    "achievements.read",
    "ads.read",
    "ad_tariffs.read",
    "seo.read",
    "branding.read",
    "legal.read",
    "email.read",
    "catalog.read",
    "sync.read",
    "api_clients.read",
  ],
};

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as string[]).includes(value);
}

export function permissionsForRole(role: AdminRole): AdminPermission[] {
  const perms = ROLE_PERMISSIONS[role];
  if (perms === "*") return [...ALL_PERMISSIONS];
  return [...perms];
}

export function roleHasPermission(
  role: AdminRole,
  permission: AdminPermission,
): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (perms === "*") return true;
  return perms.includes(permission);
}

export function resourcePermission(
  resource: AdminResource,
  mode: "read" | "write",
): AdminPermission {
  if (resource === "overview") return "overview";
  return `${resource}.${mode}` as AdminPermission;
}

export function permissionForRequest(
  resource: AdminResource,
  method: string,
): AdminPermission {
  const upper = method.toUpperCase();
  if (upper === "GET" || upper === "HEAD") {
    return resourcePermission(resource, "read");
  }
  return resourcePermission(resource, "write");
}
