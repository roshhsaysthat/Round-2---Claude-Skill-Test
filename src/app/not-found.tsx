"use client";

import Link from "next/link";
import { Page } from "@/components/shell/page";
import { EmptyState } from "@/components/ui/feedback";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Page>
      <EmptyState title="Page not found" body="That address doesn't exist." action={<Link href="/" className={buttonClass("primary", "md")}>Go home</Link>} />
    </Page>
  );
}
