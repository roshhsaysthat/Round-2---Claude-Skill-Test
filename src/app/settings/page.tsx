import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import { SettingsScreen } from "@/components/screens/settings-screen";

export default function Route() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsScreen />
    </Suspense>
  );
}
