import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import { MyTasksScreen } from "@/components/screens/my-tasks-screen";

export default function Route() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyTasksScreen />
    </Suspense>
  );
}
