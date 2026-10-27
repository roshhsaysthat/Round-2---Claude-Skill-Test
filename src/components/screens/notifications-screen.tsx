"use client";

import { NotificationPanel } from "@/components/notifications/notification-panel";
import { Page, PageHeader, TwoToneTitle } from "@/components/shell/page";

export function NotificationsScreen() {
  return (
    <Page className="max-w-[760px]">
      <PageHeader title={<TwoToneTitle soft="Your" strong="notifications" />} description="Assignments, mentions, updates and deadlines. Delivery here is simulated; nothing is sent by email or push." />
      <NotificationPanel />
    </Page>
  );
}
