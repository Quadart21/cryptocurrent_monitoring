import { withApiAuth } from "@/lib/public-api/auth";
import { apiLangs } from "@/lib/public-api/catalog";
import { apiJson, apiOptions } from "@/lib/public-api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ apiKey: string }> };

export async function OPTIONS() {
  return apiOptions();
}

export async function GET(_request: Request, { params }: Params) {
  const { apiKey } = await params;
  return withApiAuth(apiKey, async () => apiJson(await apiLangs()));
}
