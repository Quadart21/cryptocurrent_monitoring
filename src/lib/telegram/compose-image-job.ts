import "server-only";

import { composeTelegramPostImage } from "@/lib/telegram/compose-image";

export type TgImageJobStatus = "queued" | "running" | "done" | "error";

export type TgImageJob = {
  id: string;
  status: TgImageJobStatus;
  progress: string;
  percent: number;
  photoUrl: string;
  error: string | null;
  startedAt: number;
  updatedAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __gapsnapTgImageJobs: Map<string, TgImageJob> | undefined;
  // eslint-disable-next-line no-var
  var __gapsnapTgImageJobRuns: Map<string, Promise<void>> | undefined;
}

function jobs(): Map<string, TgImageJob> {
  if (!globalThis.__gapsnapTgImageJobs) {
    globalThis.__gapsnapTgImageJobs = new Map();
  }
  return globalThis.__gapsnapTgImageJobs;
}

function runs(): Map<string, Promise<void>> {
  if (!globalThis.__gapsnapTgImageJobRuns) {
    globalThis.__gapsnapTgImageJobRuns = new Map();
  }
  return globalThis.__gapsnapTgImageJobRuns;
}

function newJobId(): string {
  return `tgimg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function patchJob(id: string, patch: Partial<TgImageJob>): void {
  const cur = jobs().get(id);
  if (!cur) return;
  const next = { ...cur, ...patch, updatedAt: Date.now() };
  jobs().set(id, next);
}

/** Drop finished jobs older than 30 minutes. */
function gcJobs(): void {
  const cutoff = Date.now() - 30 * 60_000;
  for (const [id, job] of jobs()) {
    if (
      (job.status === "done" || job.status === "error") &&
      job.updatedAt < cutoff
    ) {
      jobs().delete(id);
      runs().delete(id);
    }
  }
}

export function getTelegramImageJob(id: string): TgImageJob | null {
  const job = jobs().get(id.trim());
  return job ?? null;
}

/**
 * Start image generation in the background and return immediately.
 * Avoids Cloudflare ~100s HTML gateway timeouts on long `/images/generations`.
 */
export function startTelegramImageJob(input: {
  postText: string;
  topic?: string;
  siteName: string;
  imageModel?: string;
}): { jobId: string; alreadyRunning: boolean } {
  gcJobs();

  const text = input.postText.trim();
  if (!text) throw new Error("Нет текста поста для картинки");

  const id = newJobId();
  const now = Date.now();
  const job: TgImageJob = {
    id,
    status: "queued",
    progress: "В очереди…",
    percent: 5,
    photoUrl: "",
    error: null,
    startedAt: now,
    updatedAt: now,
  };
  jobs().set(id, job);

  const run = (async () => {
    patchJob(id, {
      status: "running",
      progress: "Рисую обложку (это может занять до 2 мин)…",
      percent: 20,
    });
    try {
      const result = await composeTelegramPostImage({
        postText: text,
        topic: input.topic,
        siteName: input.siteName,
        imageModel: input.imageModel,
      });
      patchJob(id, {
        status: "done",
        progress: "Картинка готова",
        percent: 100,
        photoUrl: result.photoUrl,
        error: null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ошибка генерации картинки";
      console.warn(`[gapsnap] telegram image job ${id} failed:`, message);
      patchJob(id, {
        status: "error",
        progress: "Ошибка",
        percent: 100,
        error: message,
      });
    } finally {
      runs().delete(id);
    }
  })();

  runs().set(id, run);
  // Detach — caller must not await.
  void run;

  return { jobId: id, alreadyRunning: false };
}
