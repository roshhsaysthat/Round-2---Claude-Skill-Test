import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import { SearchScreen } from "@/components/screens/search-screen";

export default function Route() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SearchScreen />
    </Suspense>
  );
}
