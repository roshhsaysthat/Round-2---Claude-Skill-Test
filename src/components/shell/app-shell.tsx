"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { NotificationDrawer } from "@/components/notifications/notification-panel";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { TaskDetailHost } from "@/components/tasks/task-detail";
import { ToastRegion } from "@/components/ui/feedback";
import { Drawer } from "@/components/ui/overlay";
import { AppProvider, useUi } from "@/lib/app-context";
import { SidebarNav } from "./sidebar";
import { TopBar } from "./topbar";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** Linear-style single-key shortcuts. Ignored while typing or while a dialog is open. */
function useShortcuts(): void {
  const ui = useUi();
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "c") {
        e.preventDefault();
        ui.openCreate();
      } else if (e.key === "/") {
        const el = document.getElementById("global-search") ?? document.querySelector<HTMLInputElement>("input[type=search]");
        if (el) {
          e.preventDefault();
          el.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ui]);
}

function Shell({ children }: { children: ReactNode }) {
  const ui = useUi();
  useShortcuts();
  return (
    <>
      <a
        href="#main"
        className="sr-only z-[90] rounded-pill bg-ink px-4 py-2 text-surface focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to main content
      </a>
      <div className="flex h-dvh bg-canvas">
        <aside aria-label="Sidebar" className="hidden w-60 shrink-0 border-r border-line bg-surface p-3 md:block">
          <SidebarNav />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main id="main" tabIndex={-1} className="scroll-thin min-h-0 flex-1 overflow-y-auto outline-none">
            {children}
          </main>
        </div>
      </div>

      <Drawer open={ui.mobileNavOpen} onClose={() => ui.setMobileNavOpen(false)} title="Navigation" side="left" width="max-w-[300px]">
        <div className="h-full p-3">
          <SidebarNav onNavigate={() => ui.setMobileNavOpen(false)} />
        </div>
      </Drawer>
      <Suspense fallback={null}>
        <TaskDetailHost />
      </Suspense>
      <CreateTaskDialog />
      <NotificationDrawer />
      <ToastRegion />
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
