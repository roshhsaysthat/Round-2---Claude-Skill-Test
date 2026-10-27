"use client";

import { useMemo } from "react";
import { useQueryState } from "./app-context";
import type { Priority, TaskFilters } from "./types";

const KEYS = { q: "q", projectId: "project", priority: "priority", assigneeId: "assignee", due: "due", status: "status", label: "label" } as const;

/** Task filters stored in the URL so views are shareable and survive opening the detail drawer. */
export function useTaskFilters(): {
  filters: TaskFilters;
  setFilters: (patch: Partial<TaskFilters>) => void;
  clear: () => void;
} {
  const [params, set] = useQueryState();
  const raw = params.toString();
  const filters = useMemo<TaskFilters>(() => {
    const p = new URLSearchParams(raw);
    return {
      q: p.get("q") ?? "",
      projectId: p.get("project") ?? "",
      priority: (p.get("priority") ?? "") as Priority | "",
      assigneeId: p.get("assignee") ?? "",
      due: (p.get("due") ?? "") as TaskFilters["due"],
      status: (p.get("status") ?? "") as TaskFilters["status"],
      label: p.get("label") ?? "",
    };
  }, [raw]);
  const setFilters = (patch: Partial<TaskFilters>): void => {
    const out: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(patch)) out[KEYS[k as keyof typeof KEYS]] = (v as string) || null;
    set(out);
  };
  const clear = (): void => set(Object.fromEntries(Object.values(KEYS).map((k) => [k, null])));
  return { filters, setFilters, clear };
}
