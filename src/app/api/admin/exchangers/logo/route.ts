import { NextResponse } from "next/server";
import { assertAdminResource } from "@/lib/admin-guard";
import {
  deleteExchangerLogo,
  saveExchangerLogo,
  validateAndPrepareLogo,
} from "@/lib/logo";
import { updateExchanger } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await assertAdminResource("exchangers", request.method);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Некорректная форма" }, { status: 400 });
  }

  const id = String(form.get("id") ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const remove = String(form.get("remove") ?? "") === "1";
  if (remove) {
    await deleteExchangerLogo(id);
    const updated = await updateExchanger(id, { logo: null });
    if (!updated) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ exchanger: updated });
  }

  const logoField = form.get("logo");
  const logoFile = logoField instanceof File ? logoField : null;

  let prepared;
  try {
    prepared = await validateAndPrepareLogo(logoFile);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Некорректный логотип";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!prepared) {
    return NextResponse.json(
      { error: "Выберите SVG или PNG с прозрачным фоном" },
      { status: 400 },
    );
  }

  const logo = await saveExchangerLogo(id, prepared);
  const updated = await updateExchanger(id, { logo });
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ exchanger: updated });
}
