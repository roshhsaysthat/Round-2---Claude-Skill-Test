"use client";

import { Plus, Tag as TagIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Popover } from "@/components/ui/popover";
import { LabelTag } from "@/components/ui/badges";
import { cn, LABEL_CATALOG } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import type { Task } from "@/lib/types";
import { SearchField } from "@/components/ui/fields";

/** Multi-select label picker. Stays open while toggling, closes on Escape or outside press. */
export function LabelPicker({ value, onChange }: { value: string[]; onChange: (labels: string[]) => void }) {
  const toggle = (name: string): void => {
    onChange(value.includes(name) ? value.filter((l) => l !== name) : [...value, name]);
  };
  return (
    <Popover
      label="Choose labels"
      width={240}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className={cn(
            "inline-flex h-8 max-w-full items-center gap-1.5 rounded-pill border bg-surface px-3 text-[13px] hover:border-ink/40 [@media(pointer:coarse)]:h-11",
            value.length ? "border-line-strong text-ink" : "border-line text-muted",
          )}
        >
          <TagIcon size={14} />
          <span className="truncate">{value.length ? value.join(", ") : "Labels"}</span>
        </button>
      )}
    >
      {() => (
        <ul className="scroll-thin overflow-y-auto p-1.5" role="group" aria-label="Labels">
          {LABEL_CATALOG.map((l) => {
            const on = value.includes(l.name);
            return (
              <li key={l.name}>
                <label className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm hover:bg-sunken [@media(pointer:coarse)]:min-h-11">
                  <input type="checkbox" checked={on} onChange={() => toggle(l.name)} className="size-4 accent-ink" />
                  <LabelTag name={l.name} />
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </Popover>
  );
}

/** Searchable task picker for dependencies. `candidates` decides which tasks are valid targets. */
export function TaskPicker({
  candidates,
  onPick,
  label = "Add dependency",
  triggerLabel = "Add dependency",
  disabled,
}: {
  candidates: Task[];
  onPick: (task: Task) => void;
  label?: string;
  triggerLabel?: string;
  disabled?: boolean;
}) {
  const { data } = useApp();
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? candidates.filter((t) => `${t.key} ${t.title}`.toLowerCase().includes(needle))
      : candidates;
    return list.slice(0, 40);
  }, [candidates, q]);
  const projectKey = (t: Task): string => data.projects.find((p) => p.id === t.projectId)?.name ?? "";

  return (
    <Popover
      label={label}
      width={340}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          disabled={disabled}
          className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-line-strong bg-surface px-3 text-[13px] hover:bg-sunken disabled:opacity-45 [@media(pointer:coarse)]:h-11"
        >
          <Plus size={14} />
          {triggerLabel}
        </button>
      )}
    >
      {({ close }) => (
        <div className="flex min-h-0 flex-col">
          <div className="border-b border-line p-2">
            <SearchField value={q} onChange={setQ} placeholder="Search by ID or title" label="Search tasks to link" autoFocus />
          </div>
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              {candidates.length === 0 ? "No tasks can be linked here." : "No matching tasks."}
            </p>
          ) : (
            <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5">
              {results.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(t);
                      setQ("");
                      close();
                    }}
                    className="flex min-h-11 w-full flex-col items-start rounded-md px-2.5 py-1.5 text-left hover:bg-sunken"
                  >
                    <span className="flex w-full items-center gap-2 text-sm">
                      <span className="shrink-0 text-xs tabular-nums text-muted">{t.key}</span>
                      <span className="truncate">{t.title}</span>
                    </span>
                    <span className="text-xs text-muted">{projectKey(t)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Popover>
  );
}
