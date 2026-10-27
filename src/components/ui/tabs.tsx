"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
  icon?: ReactNode;
}

/**
 * Pill tabs with roving focus (arrow keys, Home, End). The selected tab is ink-filled
 * so it stays distinct from the rest. Pair with <TabPanel> for the controlled region.
 */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
  idPrefix,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: TabItem<T>[];
  label: string;
  idPrefix: string;
  className?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const move = (to: number): void => {
    const item = items[(to + items.length) % items.length];
    onChange(item.value);
    refs.current[item.value]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[item.value] = el;
            }}
            role="tab"
            id={`${idPrefix}-tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                move(i + 1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                move(i - 1);
              } else if (e.key === "Home") {
                e.preventDefault();
                move(0);
              } else if (e.key === "End") {
                e.preventDefault();
                move(items.length - 1);
              }
            }}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-pill px-4 text-sm font-medium transition-colors duration-150 [@media(pointer:coarse)]:h-11",
              selected ? "bg-ink text-surface" : "text-muted hover:bg-sunken hover:text-ink",
            )}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined ? (
              <span
                className={cn(
                  "min-w-5 rounded-pill px-1.5 text-center text-xs tabular-nums",
                  selected ? "bg-surface/20 text-surface" : "bg-sunken text-muted",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idPrefix, value, children, className }: { idPrefix: string; value: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel`} aria-labelledby={`${idPrefix}-tab-${value}`} className={className}>
      {children}
    </div>
  );
}

/** Toggle chip for filters. Selected = ink fill. */
export function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 text-[13px] transition-colors duration-150 [@media(pointer:coarse)]:h-11",
        pressed ? "border-ink bg-ink text-surface" : "border-line-strong bg-surface text-ink hover:bg-sunken",
      )}
    >
      {children}
    </button>
  );
}
