import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import { NotificationsScreen } from "@/components/screens/notifications-screen";

export default function Route() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NotificationsScreen />
    </Suspense>
  );
}
