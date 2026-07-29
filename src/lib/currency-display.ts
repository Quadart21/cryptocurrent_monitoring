/** Client-safe currency label from dashboard options (code → display name). */
export function currencyOptionLabel(
  code: string,
  options: Array<{ code: string; name: string }>,
): string {
  const hit = options.find((c) => c.code.toUpperCase() === code.toUpperCase());
  const name = hit?.name?.trim();
  return name || code;
}
