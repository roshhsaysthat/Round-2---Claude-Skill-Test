import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import { BacklogScreen } from "@/components/screens/backlog-screen";

export default function Route() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BacklogScreen />
    </Suspense>
  );
}
