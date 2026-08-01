import { withApiAuth } from "@/lib/public-api/auth";
import { apiPresences } from "@/lib/public-api/catalog";
import { apiJson, apiOptions } from "@/lib/public-api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ apiKey: string; pair: string }> };

export async function OPTIONS() {
  return apiOptions();
}

export async function GET(_request: Request, { params }: Params) {
  const { apiKey, pair } = await params;
  return withApiAuth(apiKey, async () => {
    try {
      return apiJson(await apiPresences(pair));
    } catch (error) {
      if (error instanceof Error && error.message === "PAIR_LIMIT") {
        return apiJson(
          { error: "too many pairs (max 500)" },
          { status: 400 },
        );
      }
      throw error;
    }
  });
}
