import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import { ProjectDetailScreen } from "@/components/screens/project-detail-screen";

export default function Route({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {params.then(({ id }) => (
        <ProjectDetailScreen id={id} />
      ))}
    </Suspense>
  );
}
