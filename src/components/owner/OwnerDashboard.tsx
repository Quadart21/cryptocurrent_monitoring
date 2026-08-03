"use client";

import { useMemo, useState } from "react";
import { useOwner } from "@/components/owner/OwnerProvider";
import { OwnerShell } from "@/components/owner/OwnerShell";
import { type OwnerTabId } from "@/components/owner/owner-utils";
import { OwnerBannerSection } from "@/components/owner/sections/OwnerBannerSection";
import { OwnerOverviewSection } from "@/components/owner/sections/OwnerOverviewSection";
import { OwnerProfileSection } from "@/components/owner/sections/OwnerProfileSection";
import { OwnerReviewsSection } from "@/components/owner/sections/OwnerReviewsSection";
import { OwnerTrafficSection } from "@/components/owner/sections/OwnerTrafficSection";

function needsOwnerReply(review: {
  status: string;
  threadClosed?: boolean | null;
  replies?: Array<{ authorRole: string }>;
}): boolean {
  if (review.status !== "approved" || review.threadClosed) return false;
  const thread = review.replies ?? [];
  if (thread.length === 0) return true;
  return thread[thread.length - 1]?.authorRole !== "owner";
}

export function OwnerDashboard() {
  const { exchanger, reviews, logout, refresh, busy } = useOwner();
  const [tab, setTab] = useState<OwnerTabId>("overview");

  const pendingReviews = useMemo(
    () => reviews.filter((r) => r.status === "pending").length,
    [reviews],
  );
  const unansweredReviews = useMemo(
    () => reviews.filter(needsOwnerReply).length,
    [reviews],
  );

  if (!exchanger) return null;

  function go(next: OwnerTabId) {
    setTab(next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <OwnerShell
      exchanger={exchanger}
      tab={tab}
      onTab={go}
      onLogout={() => void logout()}
      busy={busy}
    >
      {tab === "overview" ? (
        <OwnerOverviewSection
          exchanger={exchanger}
          pendingReviews={pendingReviews}
          unansweredReviews={unansweredReviews}
          onGo={go}
        />
      ) : null}
      {tab === "banner" ? <OwnerBannerSection exchanger={exchanger} /> : null}
      {tab === "traffic" ? <OwnerTrafficSection exchanger={exchanger} /> : null}
      {tab === "reviews" ? (
        <OwnerReviewsSection
          reviews={reviews}
          exchangerStatus={exchanger.status}
          onSaved={refresh}
        />
      ) : null}
      {tab === "profile" ? (
        <OwnerProfileSection exchanger={exchanger} />
      ) : null}
    </OwnerShell>
  );
}
