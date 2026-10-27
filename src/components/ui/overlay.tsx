"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { bumpOverlay } from "@/lib/overlay-store";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "./button";
import { ToastRegion } from "./feedback";

/** Shared <dialog> plumbing: native focus trap, Esc, inert background. */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // React's autoFocus runs before the dialog is open, so honor an explicit marker here.
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    bumpOverlay(1);
    return () => bumpOverlay(-1);
  }, [open]);
  return {
    ref,
    onCancel: (e: React.SyntheticEvent) => {
      e.preventDefault();
      onClose();
    },
    onMouseDown: (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
  };
}

const SIZE = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" } as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  hideTitle,
  children,
  footer,
  size = "md",
  position = "center",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  hideTitle?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZE;
  position?: "center" | "top";
  className?: string;
}) {
  const titleId = useId();
  const { ref: dialogRef, onCancel, onMouseDown } = useDialog(open, onClose);
  return (
    <dialog
      ref={dialogRef}
      onCancel={onCancel}
      onMouseDown={onMouseDown}
      aria-labelledby={titleId}
      className={cn(
        "m-auto w-[calc(100%-24px)] overflow-visible rounded-xl border-0 bg-surface p-0 text-ink shadow-elev-4",
        "max-h-[calc(100dvh-24px)] backdrop:bg-backdrop",
        position === "top" && "mt-[6vh] mb-auto",
        SIZE[size],
        className,
      )}
    >
      {open ? (
        <div className="anim-rise flex max-h-[calc(100dvh-24px)] flex-col">
          <div className={cn("flex items-start justify-between gap-4 px-6 pt-5", hideTitle && "sr-only")}>
            <div className="min-w-0">
              <h2 id={titleId} className="text-xl">
                {title}
              </h2>
              {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
            </div>
            <IconButton aria-label="Close dialog" size="sm" onClick={onClose}>
              <X />
            </IconButton>
          </div>
          {hideTitle ? null : null}
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-3">{footer}</div> : null}
          <ToastRegion inDialog />
        </div>
      ) : null}
    </dialog>
  );
}

/** Side sheet that fills the screen below 640px. */
export function Drawer({
  open,
  onClose,
  title,
  header,
  children,
  side = "right",
  width = "max-w-[580px]",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Replaces the default close-button header row. Must include its own close control. */
  header?: ReactNode;
  children: ReactNode;
  side?: "right" | "left";
  width?: string;
}) {
  const titleId = useId();
  const { ref: dialogRef, onCancel, onMouseDown } = useDialog(open, onClose);
  return (
    <dialog
      ref={dialogRef}
      onCancel={onCancel}
      onMouseDown={onMouseDown}
      aria-labelledby={titleId}
      className={cn(
        "m-0 h-dvh max-h-none w-full overflow-hidden border-0 bg-surface p-0 text-ink shadow-elev-4 backdrop:bg-backdrop",
        "sm:rounded-none",
        side === "right" ? "ml-auto sm:rounded-l-xl" : "mr-auto sm:rounded-r-xl",
        width,
      )}
    >
      {open ? (
        <div className={cn("flex h-full min-h-0 flex-col", side === "right" ? "anim-drawer" : "anim-drawer")}>
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
          {header ?? (
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <span aria-hidden className="font-display text-lg">
                {title}
              </span>
              <IconButton aria-label={`Close ${title}`} size="sm" onClick={onClose}>
                <X />
              </IconButton>
            </div>
          )}
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
          <ToastRegion inDialog />
        </div>
      ) : null}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted">{body}</div>
    </Modal>
  );
}
