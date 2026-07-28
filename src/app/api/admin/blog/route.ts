import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import {
  createBlogPost,
  deleteBlogPost,
  listBlogPosts,
  updateBlogPost,
} from "@/lib/store";
import type { BlogPostStatus } from "@/lib/store-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await assertAdmin();
  if (denied) return denied;
  return NextResponse.json({ posts: await listBlogPosts({ status: "all" }) });
}

export async function POST(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;
  const body = (await request.json()) as {
    title?: string;
    slug?: string;
    excerpt?: string;
    body?: string;
    status?: BlogPostStatus;
    seoTitle?: string;
    seoDescription?: string;
    authorName?: string;
    tags?: string[];
  };
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  const post = await createBlogPost({
    title: body.title,
    slug: body.slug,
    excerpt: body.excerpt,
    body: body.body,
    status: body.status,
    seoTitle: body.seoTitle,
    seoDescription: body.seoDescription,
    authorName: body.authorName,
    tags: body.tags,
  });
  return NextResponse.json({ post });
}

export async function PATCH(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;
  const body = (await request.json()) as {
    id?: string;
    title?: string;
    slug?: string;
    excerpt?: string;
    body?: string;
    status?: BlogPostStatus;
    seoTitle?: string;
    seoDescription?: string;
    authorName?: string;
    tags?: string[];
  };
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const post = await updateBlogPost(body.id, body);
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ post });
}

export async function DELETE(request: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = await deleteBlogPost(id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
