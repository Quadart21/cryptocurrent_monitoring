import { withApiAuth } from "@/lib/public-api/auth";
import { apiChangers } from "@/lib/public-api/catalog";
import { apiJson, apiOptions } from "@/lib/public-api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ apiKey: string; lang: string }> };

export async function OPTIONS() {
  return apiOptions();
}

export async function GET(_request: Request, { params }: Params) {
  const { apiKey, lang } = await params;
  return withApiAuth(apiKey, async () => apiJson(await apiChangers(lang)));
}
