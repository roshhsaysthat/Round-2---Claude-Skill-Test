"use client";

import { Page } from "@/components/shell/page";
import { ErrorState } from "@/components/ui/feedback";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <Page>
      <ErrorState onRetry={reset} />
    </Page>
  );
}
