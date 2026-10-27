"use client";

import { Bell, List, Plus } from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { SearchField } from "@/components/ui/fields";
import { useApp, useUi } from "@/lib/app-context";

export function TopBar() {
  const { data, me } = useApp();
  const ui = useUi();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const unread = data.notifications.filter((n) => n.userId === me.id && !n.read).length;
  const onSearchPage = pathname === "/search";

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-5">
      <IconButton aria-label="Open navigation" className="md:hidden" onClick={() => ui.setMobileNavOpen(true)}>
        <List />
      </IconButton>
      <div className="min-w-0 flex-1">
        {onSearchPage ? null : (
          <SearchField
            value={q}
            onChange={setQ}
            onSubmit={(v) => {
              const text = v.trim();
              router.push(text ? `/search?q=${encodeURIComponent(text)}` : "/search");
              setQ("");
            }}
            placeholder="Search tasks and projects"
            label="Search tasks and projects"
            className="max-w-md"
            inputRef={(el) => {
              if (el) el.id = "global-search";
            }}
          />
        )}
      </div>
      <IconButton
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        onClick={() => ui.setNotificationsOpen(true)}
        className="relative"
      >
        <Bell />
        {unread ? (
          <span
            aria-hidden
            className="absolute right-1 top-1 min-w-4 rounded-pill bg-signal px-1 text-center text-[10px] font-medium leading-4 text-surface"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </IconButton>
      <Button
        variant="primary"
        icon={<Plus weight="bold" />}
        onClick={() => ui.openCreate()}
        aria-keyshortcuts="C"
        trailing={
          <kbd aria-hidden className="ml-1 hidden rounded-sm bg-surface/20 px-1.5 text-[11px] font-medium sm:inline">
            C
          </kbd>
        }
      >
        <span className="sr-only sm:not-sr-only">Create task</span>
        <span className="sm:hidden" aria-hidden>
          New
        </span>
      </Button>
    </div>
  );
}
