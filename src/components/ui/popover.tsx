"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TriggerProps {
  ref: (el: HTMLButtonElement | null) => void;
  onClick: () => void;
  "aria-expanded": boolean;
  "aria-haspopup": "dialog";
  "aria-controls": string;
}

interface Position {
  left: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

/**
 * Anchored panel for pickers. Positioned with `fixed` from the trigger's rect when opened
 * (so scroll containers don't clip it). Closes on outside press, Escape, scroll and resize.
 */
export function Popover({
  trigger,
  children,
  width = 288,
  label,
  className,
}: {
  trigger: (props: TriggerProps, open: boolean) => ReactNode;
  children: (api: { close: () => void }) => ReactNode;
  width?: number;
  label: string;
  className?: string;
}) {
  const id = useId();
  const [pos, setPos] = useState<Position | null>(null);
  const [triggerEl, setTriggerEl] = useState<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  const close = (): void => {
    setPos(null);
    triggerEl?.focus();
  };

  const toggle = (): void => {
    if (open) return close();
    const r = triggerEl?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    const spaceBelow = vh - r.bottom - 12;
    const spaceAbove = r.top - 12;
    if (spaceBelow >= 240 || spaceBelow >= spaceAbove) {
      setPos({ left, top: r.bottom + 6, maxHeight: Math.max(160, Math.min(380, spaceBelow)) });
    } else {
      setPos({ left, bottom: vh - r.top + 6, maxHeight: Math.max(160, Math.min(380, spaceAbove)) });
    }
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || triggerEl?.contains(t)) return;
      setPos(null);
    };
    const onResize = (): void => setPos(null);
    const onScroll = (e: Event): void => {
      if (panel.current?.contains(e.target as Node)) return;
      setPos(null);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    const first = panel.current?.querySelector<HTMLElement>("input, button, [tabindex]:not([tabindex='-1'])");
    first?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, triggerEl]);

  return (
    <>
      {trigger(
        {
          ref: setTriggerEl,
          onClick: toggle,
          "aria-expanded": open,
          "aria-haspopup": "dialog",
          "aria-controls": id,
        },
        open,
      )}
      {open ? (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={label}
          style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width, maxHeight: pos.maxHeight }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              e.preventDefault();
              close();
            }
          }}
          className={cn("anim-fade z-[70] flex flex-col overflow-hidden rounded-lg bg-surface text-ink shadow-elev-3", className)}
        >
          {children({ close })}
        </div>
      ) : null}
    </>
  );
}
