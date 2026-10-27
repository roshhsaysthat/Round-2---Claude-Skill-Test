import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import { ProjectsScreen } from "@/components/screens/projects-screen";

export default function Route() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProjectsScreen />
    </Suspense>
  );
}
