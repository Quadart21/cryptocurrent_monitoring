import { NextResponse } from "next/server";
import {
  assertAdminResource,
  isSessionContext,
  requireAdminSession,
} from "@/lib/admin-guard";
import {
  discardTelegramDraft,
  editTelegramPost,
  deleteTelegramPost,
  getTelegramAdminSnapshot,
  getTelegramImageJobStatus,
  listTelegramPosts,
  publishTelegramPost,
  startTelegramComposeDraft,
  startTelegramImageFromPostText,
  testTelegramConnection,
  updateTelegramSettings,
} from "@/lib/telegram/service";
import {
  discardTelegramContentJob,
  runTelegramContentCycle,
} from "@/lib/telegram/content/engine";
import { DEFAULT_TELEGRAM_COMPOSE_PROMPT } from "@/lib/telegram/default-prompt";
import type {
  TelegramButtonRow,
  TelegramParseMode,
} from "@/lib/telegram/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const denied = await assertAdminResource("telegram", request.method);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") ?? "snapshot";

  try {
    if (view === "snapshot") {
      return NextResponse.json(await getTelegramAdminSnapshot());
    }
    if (view === "posts") {
      const limit = Number(searchParams.get("limit") ?? 50);
      return NextResponse.json({ posts: await listTelegramPosts(limit) });
    }
    if (view === "compose-image-job") {
      const id = searchParams.get("id") ?? "";
      return NextResponse.json(await getTelegramImageJobStatus(id));
    }
    return NextResponse.json({ error: "unknown view" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fail";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  const session = await requireAdminSession(
    request.method.toUpperCase() === "GET"
      ? "telegram.read"
      : "telegram.write",
  );
  if (!isSessionContext(session)) return session;

  const body = (await request.json()) as {
    action?: string;
    settings?: {
      botToken?: string;
      channelId?: string;
      parseMode?: TelegramParseMode;
      disablePreview?: boolean;
      silent?: boolean;
      composeModel?: string;
      composePrompt?: string;
      resetComposePrompt?: boolean;
      contentEnabled?: boolean;
      contentSpreadEnabled?: boolean;
      contentNewsEnabled?: boolean;
      contentMinSpreadPct?: number;
      contentMinOffers?: number;
      contentMaxSpreadPerRun?: number;
      contentSpreadCooldownHours?: number;
      contentAutoPublish?: boolean;
      contentMaxPostsPerDay?: number;
      contentMinIntervalMinutes?: number;
      contentQuietStartHour?: number;
      contentQuietEndHour?: number;
      contentIntervalMinutes?: number;
      contentMaxNewsPerRun?: number;
      contentNewsLookbackHours?: number;
      contentIncludeCash?: boolean;
      contentPairAllowlist?: string;
      contentPairBlocklist?: string;
      contentFooter?: string;
      contentSpreadButtonText?: string;
      contentNewsButtonText?: string;
      contentUtmCampaign?: string;
      contentWithNewsImage?: boolean;
      contentPostSilent?: boolean;
      contentDisablePreview?: boolean;
    };
    text?: string;
    photoUrl?: string;
    parseMode?: TelegramParseMode;
    disablePreview?: boolean;
    silent?: boolean;
    buttons?: TelegramButtonRow[];
    id?: string;
    draftId?: string;
    topic?: string;
    model?: string;
    withImage?: boolean;
    force?: boolean;
  };

  try {
    if (body.action === "settings" && body.settings) {
      const patch = { ...body.settings };
      if (body.settings.resetComposePrompt) {
        patch.composePrompt = DEFAULT_TELEGRAM_COMPOSE_PROMPT;
      }
      delete (patch as { resetComposePrompt?: boolean }).resetComposePrompt;
      const settings = await updateTelegramSettings(patch);
      return NextResponse.json({ settings });
    }

    if (body.action === "test") {
      const connection = await testTelegramConnection();
      const snapshot = await getTelegramAdminSnapshot();
      return NextResponse.json({ connection, settings: snapshot.settings });
    }

    if (body.action === "compose-start") {
      const post = await startTelegramComposeDraft({
        topic: body.topic ?? "",
        withImage: body.withImage !== false,
        model: body.model,
        adminLogin: session.user.login,
      });
      return NextResponse.json({ post });
    }

    if (body.action === "compose-image") {
      const started = await startTelegramImageFromPostText({
        text: body.text ?? "",
        topic: body.topic,
      });
      return NextResponse.json({ jobId: started.jobId });
    }

    if (body.action === "discard-draft" && body.id) {
      const post = await discardTelegramDraft(body.id);
      return NextResponse.json({ post });
    }

    if (body.action === "content-run") {
      const result = await runTelegramContentCycle({
        force: body.force === true,
      });
      const snapshot = await getTelegramAdminSnapshot();
      return NextResponse.json({
        result,
        contentJobs: snapshot.contentJobs,
        posts: snapshot.posts,
        settings: snapshot.settings,
      });
    }

    if (body.action === "content-discard" && body.id) {
      const job = await discardTelegramContentJob(body.id);
      const snapshot = await getTelegramAdminSnapshot();
      return NextResponse.json({
        job,
        contentJobs: snapshot.contentJobs,
        posts: snapshot.posts,
      });
    }

    if (body.action === "publish") {
      try {
        const post = await publishTelegramPost({
          text: body.text ?? "",
          photoUrl: body.photoUrl,
          parseMode: body.parseMode,
          disablePreview: body.disablePreview,
          silent: body.silent,
          buttons: body.buttons,
          adminLogin: session.user.login,
          draftId: body.draftId,
        });
        return NextResponse.json({ post });
      } catch (error) {
        const post =
          error && typeof error === "object" && "post" in error
            ? (error as { post: unknown }).post
            : null;
        const message =
          error instanceof Error ? error.message : "Ошибка публикации";
        return NextResponse.json({ error: message, post }, { status: 502 });
      }
    }

    if (body.action === "edit" && body.id) {
      const post = await editTelegramPost({
        id: body.id,
        text: body.text ?? "",
        parseMode: body.parseMode,
        disablePreview: body.disablePreview,
        buttons: body.buttons,
      });
      return NextResponse.json({ post });
    }

    if (body.action === "delete" && body.id) {
      const post = await deleteTelegramPost(body.id);
      return NextResponse.json({ post });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fail";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
