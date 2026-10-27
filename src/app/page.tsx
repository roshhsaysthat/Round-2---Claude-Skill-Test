import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import { HomeScreen } from "@/components/screens/home-screen";

export default function Route() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HomeScreen />
    </Suspense>
  );
}
