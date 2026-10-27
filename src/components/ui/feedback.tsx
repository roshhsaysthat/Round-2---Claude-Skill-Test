"use client";

import { CheckCircle, CircleNotch, Info, Warning, WarningCircle, X } from "@phosphor-icons/react";
import { useSyncExternalStore, type ReactNode } from "react";
import { dismissToast, toastStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "./button";
import { useOverlayCount } from "@/lib/overlay-store";

/* ------------------------------- Meter ------------------------------- */

export function Meter({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <progress className="meter" value={value} max={Math.max(max, 1)} aria-label={label} />
      <span className="shrink-0 text-xs tabular-nums text-muted">
        {value}/{max}
      </span>
    </div>
  );
}

/* ------------------------------ Skeleton ----------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("anim-pulse rounded-md bg-sunken", className)} />;
}

export function LoadingState({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex flex-col items-center justify-center gap-3 px-6 py-16 text-muted", className)}>
      <CircleNotch aria-hidden size={24} className="anim-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-8">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

/** Full-screen placeholder shown until saved data has been read. */
export function AppLoading() {
  return (
    <div role="status" aria-label="Loading your workspace" className="flex h-dvh bg-canvas">
      <div className="hidden w-60 shrink-0 flex-col gap-3 border-r border-line bg-surface p-4 md:flex">
        <Skeleton className="h-8 w-32" />
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
      <div className="flex-1 p-8">
        <PageSkeleton />
      </div>
    </div>
  );
}

/* ----------------------------- Empty / Error ----------------------------- */

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-14 text-center", className)}>
      {icon ? (
        <span aria-hidden className="mb-1 inline-flex size-12 items-center justify-center rounded-pill bg-sunken text-2xl text-muted">
          {icon}
        </span>
      ) : null}
      <h3 className="text-lg">{title}</h3>
      {body ? <p className="max-w-sm text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  body = "That didn't load as expected. You can try again.",
  onRetry,
  action,
}: {
  title?: string;
  body?: ReactNode;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <span aria-hidden className="mb-1 inline-flex size-12 items-center justify-center rounded-pill bg-peach text-2xl text-ink">
        <WarningCircle />
      </span>
      <h2 className="text-xl">{title}</h2>
      <p className="max-w-sm text-sm text-muted">{body}</p>
      <div className="mt-3 flex gap-2">
        {onRetry ? (
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  );
}

/* ------------------------------- Banner ------------------------------- */

const BANNER_TONE = {
  info: { bg: "bg-ice", icon: <Info size={18} /> },
  success: { bg: "bg-sage", icon: <CheckCircle size={18} weight="fill" /> },
  warning: { bg: "bg-butter", icon: <Warning size={18} weight="fill" /> },
  error: { bg: "bg-peach", icon: <WarningCircle size={18} weight="fill" /> },
} as const;

/** Inline feedback with a live-region role and a dismiss control. */
export function Banner({
  tone = "info",
  children,
  onDismiss,
  action,
  className,
}: {
  tone?: keyof typeof BANNER_TONE;
  children: ReactNode;
  onDismiss?: () => void;
  action?: ReactNode;
  className?: string;
}) {
  const t = BANNER_TONE[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-lg px-4 py-3 text-sm text-ink", t.bg, className)}
    >
      <span aria-hidden className="mt-0.5 shrink-0">
        {t.icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      {action}
      {onDismiss ? (
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="-m-1 inline-flex size-7 shrink-0 items-center justify-center rounded-pill hover:bg-ink/10">
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------ Toast region ------------------------------ */

/**
 * Transient confirmations. Rendered once in the app shell, and again inside any open
 * dialog or drawer, because a modal's top layer and inert background would otherwise hide it.
 */
export function ToastRegion({ inDialog }: { inDialog?: boolean }) {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, toastStore.getServerSnapshot);
  const overlays = useOverlayCount();
  if (!inDialog && overlays > 0) return null;
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-3">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className="anim-rise pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg bg-ink py-2.5 pl-4 pr-2 text-sm text-surface shadow-elev-3"
        >
          <span aria-hidden className="shrink-0">
            {t.kind === "error" ? (
              <WarningCircle size={18} weight="fill" className="text-peach" />
            ) : t.kind === "info" ? (
              <Info size={18} className="text-ice" />
            ) : (
              <CheckCircle size={18} weight="fill" className="text-sage" />
            )}
          </span>
          <span className="min-w-0 flex-1">{t.text}</span>
          {t.action ? (
            <button
              type="button"
              onClick={() => {
                t.action?.run();
                dismissToast(t.id);
              }}
              className="shrink-0 rounded-pill px-3 py-1 text-[13px] font-medium text-surface underline underline-offset-2 hover:bg-surface/15"
            >
              {t.action.label}
            </button>
          ) : null}
          <IconButton
            aria-label="Dismiss message"
            size="sm"
            onClick={() => dismissToast(t.id)}
            className="text-surface hover:bg-surface/15"
          >
            <X size={14} />
          </IconButton>
        </div>
      ))}
    </div>
  );
}
