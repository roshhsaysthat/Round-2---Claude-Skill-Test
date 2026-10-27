"use client";

import { At, Bell, CheckCircle, ClockCountdown, PencilSimple, UserPlus } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Drawer } from "@/components/ui/overlay";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { requestOpenTask, useApp, useUi } from "@/lib/app-context";
import type { AppNotification, NotificationType } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

const ICON: Record<NotificationType, ReactNode> = {
  assigned: <UserPlus size={16} />,
  mention: <At size={16} />,
  updated: <PencilSimple size={16} />,
  deadline: <ClockCountdown size={16} />,
};

type Filter = "all" | "unread";

function Row({ n, onOpen }: { n: AppNotification; onOpen: (n: AppNotification) => void }) {
  const { data, now } = useApp();
  const actor = data.users.find((u) => u.id === n.actorId);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(n)}
        className={cn(
          "flex w-full items-start gap-3 rounded-md px-3 py-3 text-left hover:bg-sunken",
          !n.read && "bg-canvas",
        )}
      >
        {actor ? (
          <Avatar name={actor.name} size="md" />
        ) : (
          <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-pill bg-butter">
            {ICON[n.type]}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm", !n.read && "font-medium")}>{n.text}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            {ICON[n.type]}
            <span className="capitalize">{n.type}</span>
            <span aria-hidden>·</span>
            <time dateTime={n.at}>{formatRelative(n.at, now)}</time>
          </span>
        </span>
        {!n.read ? (
          <>
            <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-pill bg-signal" />
            <span className="sr-only">Unread</span>
          </>
        ) : null}
      </button>
    </li>
  );
}

export function NotificationPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { data, actions } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const mine = data.notifications
    .filter((n) => n.userId === data.currentUserId)
    .sort((a, b) => b.at.localeCompare(a.at));
  const unread = mine.filter((n) => !n.read).length;
  const shown = filter === "unread" ? mine.filter((n) => !n.read) : mine;

  const open = (n: AppNotification): void => {
    if (!n.read) actions.markNotificationRead(n.id);
    if (n.taskId && data.tasks.some((t) => t.id === n.taskId)) {
      onNavigate?.();
      requestOpenTask(n.taskId);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs<Filter>
          label="Filter notifications"
          idPrefix="notif"
          value={filter}
          onChange={setFilter}
          items={[
            { value: "all", label: "All", count: mine.length },
            { value: "unread", label: "Unread", count: unread },
          ]}
        />
        <Button size="sm" variant="secondary" icon={<CheckCircle size={14} />} disabled={unread === 0} onClick={() => actions.markAllNotificationsRead()}>
          Mark all read
        </Button>
      </div>
      {shown.length === 0 ? (
        <EmptyState
          icon={<Bell />}
          title={filter === "unread" ? "You're all caught up" : "No notifications yet"}
          body={filter === "unread" ? "Nothing unread." : "Assignments, mentions, updates and deadlines will show up here."}
        />
      ) : (
        <TabPanel idPrefix="notif" value={filter}>
          <ul aria-label="Notifications" className="flex flex-col gap-0.5">
            {shown.map((n) => (
              <Row key={n.id} n={n} onOpen={open} />
            ))}
          </ul>
        </TabPanel>
      )}
      <div className="rounded-lg border border-dashed border-line-strong p-3">
        <p className="mb-2 text-xs text-muted">
          Demo only: simulate a teammate acting on your work. These make real changes to the data and are not sent over email or push.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => actions.simulate("assigned")}>Assign me a task</Button>
          <Button size="sm" onClick={() => actions.simulate("mention")}>Mention me</Button>
          <Button size="sm" onClick={() => actions.simulate("updated")}>Update my task</Button>
          <Button size="sm" onClick={() => actions.simulate("deadline")}>Deadline moves up</Button>
        </div>
      </div>
    </div>
  );
}

export function NotificationDrawer() {
  const ui = useUi();
  return (
    <Drawer open={ui.notificationsOpen} onClose={() => ui.setNotificationsOpen(false)} title="Notifications" width="max-w-[480px]">
      <NotificationPanel onNavigate={() => ui.setNotificationsOpen(false)} />
    </Drawer>
  );
}
