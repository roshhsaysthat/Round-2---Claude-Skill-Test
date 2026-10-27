"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,

  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AppLoading } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { actions, reloadFromStorage, store, tick, type Snapshot } from "./store";
import { STORAGE_KEY } from "./storage";
import type { CreateStatusChoice, Project, Task, User } from "./types";

/* ----------------------------- data context ------------------------------ */

const SnapshotContext = createContext<Snapshot | null>(null);

export function useApp() {
  const snap = useContext(SnapshotContext);
  if (!snap) throw new Error("useApp must be used inside <AppProvider>");
  const me = snap.data.users.find((u) => u.id === snap.data.currentUserId) as User;
  return { ...snap, me, actions };
}

export function useUser(id: string | null | undefined): User | undefined {
  const { data } = useApp();
  return id ? data.users.find((u) => u.id === id) : undefined;
}

export function useProject(id: string | null | undefined): Project | undefined {
  const { data } = useApp();
  return id ? data.projects.find((p) => p.id === id) : undefined;
}

export function useTask(id: string | null | undefined): Task | undefined {
  const { index } = useApp();
  return id ? index.get(id) : undefined;
}

/* ------------------------------ UI context ------------------------------- */

export interface CreateDefaults {
  projectId?: string;
  status?: CreateStatusChoice;
  assigneeId?: string | null;
  title?: string;
  openAi?: boolean;
}

interface ConfirmOptions {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
}

interface UiValue {
  createState: { open: boolean; defaults: CreateDefaults };
  openCreate: (defaults?: CreateDefaults) => void;
  closeCreate: () => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmState: (ConfirmOptions & { resolve: (v: boolean) => void }) | null;
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
  notificationsOpen: boolean;
  setNotificationsOpen: (v: boolean) => void;
}

const UiContext = createContext<UiValue | null>(null);

export function useUi(): UiValue {
  const ui = useContext(UiContext);
  if (!ui) throw new Error("useUi must be used inside <AppProvider>");
  return ui;
}

function UiProvider({ children }: { children: ReactNode }) {
  const [createState, setCreateState] = useState<UiValue["createState"]>({ open: false, defaults: {} });
  const [confirmState, setConfirmState] = useState<UiValue["confirmState"]>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const openCreate = useCallback((defaults: CreateDefaults = {}) => setCreateState({ open: true, defaults }), []);
  const closeCreate = useCallback(() => setCreateState((s) => ({ ...s, open: false })), []);
  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...options, resolve });
      }),
    [],
  );

  const value = useMemo<UiValue>(
    () => ({
      createState,
      openCreate,
      closeCreate,
      confirm,
      confirmState,
      mobileNavOpen,
      setMobileNavOpen,
      notificationsOpen,
      setNotificationsOpen,
    }),
    [createState, openCreate, closeCreate, confirm, confirmState, mobileNavOpen, notificationsOpen],
  );

  return (
    <UiContext.Provider value={value}>
      {children}
      <ConfirmHost state={confirmState} clear={() => setConfirmState(null)} />
    </UiContext.Provider>
  );
}

function ConfirmHost({ state, clear }: { state: UiValue["confirmState"]; clear: () => void }) {
  // Keep the last request mounted so the dialog's content doesn't vanish while it closes.
  const [last, setLast] = useState(state);
  if (state && state !== last) setLast(state);
  const shown = state ?? last;
  if (!shown) return null;
  const answer = (v: boolean): void => {
    shown.resolve(v);
    clear();
  };
  return (
    <ConfirmDialog
      open={state !== null}
      title={shown.title}
      body={shown.body}
      confirmLabel={shown.confirmLabel}
      danger={shown.danger}
      onConfirm={() => answer(true)}
      onCancel={() => answer(false)}
    />
  );
}

/* ------------------------------- provider -------------------------------- */

/**
 * Renders a loading shell until saved data has been read on the client. The server and the
 * first hydration pass both see `null`, so there is never a hydration mismatch.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  useEffect(() => {
    const timer = setInterval(tick, 60_000);
    const onStorage = (e: StorageEvent): void => {
      if (e.key === STORAGE_KEY) reloadFromStorage();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (!snap) return <AppLoading />;
  return (
    <SnapshotContext.Provider value={snap}>
      <UiProvider>{children}</UiProvider>
    </SnapshotContext.Provider>
  );
}

/* ----------------------------- URL query state ---------------------------- */

/**
 * Reads and writes URL search params without a navigation. Uses the History API (which
 * Next.js syncs with useSearchParams), so views keep their scroll position, filters and state.
 * Components using this must sit under a <Suspense> boundary.
 */
export function useQueryState() {
  const params = useSearchParams();
  const pathname = usePathname();
  const set = useCallback(
    (patch: Record<string, string | null | undefined>, mode: "replace" | "push" = "replace") => {
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (mode === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [pathname],
  );
  return [params, set] as const;
}

export { OPEN_TASK_EVENT, requestOpenTask } from "./store";
