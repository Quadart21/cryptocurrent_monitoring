import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import {
  deleteAdImage,
  saveAdImage,
  validateAndPrepareAdImage,
} from "@/lib/ad-image";
import { getAdById } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await assertAdmin();
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

  const existing = await getAdById(id);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const remove = String(form.get("remove") ?? "") === "1";
  if (remove) {
    await deleteAdImage(id);
    const ad = await getAdById(id);
    return NextResponse.json({ ad });
  }

  const imageField = form.get("image");
  const imageFile = imageField instanceof File ? imageField : null;

  let prepared;
  try {
    prepared = await validateAndPrepareAdImage(imageFile);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Некорректная картинка";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!prepared) {
    return NextResponse.json(
      { error: "Выберите JPG, PNG или WebP" },
      { status: 400 },
    );
  }

  await saveAdImage(id, prepared);
  const ad = await getAdById(id);
  return NextResponse.json({ ad });
}
