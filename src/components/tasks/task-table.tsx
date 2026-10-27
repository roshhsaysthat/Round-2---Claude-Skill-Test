"use client";

import { ArrowDown, ArrowUp, ArrowsDownUp } from "@phosphor-icons/react";
import { ProjectBadge, StateBadge } from "@/components/ui/badges";
import { DateInput, SelectField } from "@/components/ui/fields";
import { useApp } from "@/lib/app-context";
import { getEffectiveState } from "@/lib/lifecycle";
import type { SortDir, SortKey } from "@/lib/selectors";
import type { Priority, Status, Task } from "@/lib/types";
import { PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL, STATUS_ORDER, cn } from "@/lib/utils";
import { SubtaskIndicator, DependencyIndicator } from "./task-indicators";

export type TableColumn = "key" | "title" | "status" | "priority" | "assignee" | "project" | "due";

const HEADERS: Record<TableColumn, { label: string; sort?: SortKey; className?: string }> = {
  key: { label: "ID", sort: "key", className: "w-24" },
  title: { label: "Task", sort: "title" },
  status: { label: "Status", sort: "status", className: "w-40" },
  priority: { label: "Priority", sort: "priority", className: "w-36" },
  assignee: { label: "Assignee", sort: "assignee", className: "w-44" },
  project: { label: "Project", className: "w-44" },
  due: { label: "Due", sort: "due", className: "w-40" },
};

export const DEFAULT_COLUMNS: TableColumn[] = ["key", "title", "status", "priority", "assignee", "project", "due"];

/**
 * Sortable table over the shared task records. Status, priority, assignee and due date
 * are editable in place and go through the same actions as the board and the detail panel.
 */
export function TaskTable({
  tasks,
  onOpen,
  sort,
  onSort,
  columns = DEFAULT_COLUMNS,
  caption,
}: {
  tasks: Task[];
  onOpen: (t: Task) => void;
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
  columns?: TableColumn[];
  caption: string;
}) {
  const { data, index, actions } = useApp();

  const cell = (col: TableColumn, t: Task) => {
    const state = getEffectiveState(t, index);
    switch (col) {
      case "key":
        return <span className="text-xs tabular-nums text-muted">{t.key}</span>;
      case "title":
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <button
              type="button"
              onClick={() => onOpen(t)}
              className={cn(
                "line-clamp-2 min-h-6 rounded-sm text-left text-sm font-medium hover:underline",
                state === "done" && "text-muted line-through decoration-line-strong",
              )}
            >
              {t.title}
            </button>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {state === "on_hold" || state === "backlog" ? <StateBadge state={state} /> : null}
              <DependencyIndicator task={t} />
              <SubtaskIndicator task={t} />
            </span>
          </div>
        );
      case "status":
        return t.stage === "backlog" ? (
          <StateBadge state="backlog" />
        ) : (
          <SelectField
            compact
            aria-label={`${t.key} status`}
            value={t.status}
            onChange={(e) => actions.setStatus(t.id, e.target.value as Status)}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </SelectField>
        );
      case "priority":
        return (
          <SelectField
            compact
            aria-label={`${t.key} priority`}
            value={t.priority}
            onChange={(e) => actions.updateTask(t.id, { priority: e.target.value as Priority })}
          >
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </SelectField>
        );
      case "assignee":
        return (
          <SelectField
            compact
            aria-label={`${t.key} assignee`}
            value={t.assigneeId ?? ""}
            onChange={(e) => actions.updateTask(t.id, { assigneeId: e.target.value || null })}
          >
            <option value="">Unassigned</option>
            {data.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </SelectField>
        );
      case "project":
        return <ProjectBadge project={data.projects.find((p) => p.id === t.projectId)} />;
      case "due":
        return (
          <DateInput
            aria-label={`${t.key} due date`}
            value={t.dueDate ?? ""}
            onChange={(e) => actions.updateTask(t.id, { dueDate: e.target.value || null })}
            className="h-8 rounded-sm px-2 text-[13px]"
          />
        );
    }
  };

  return (
    <div className="scroll-thin overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[920px] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-canvas">
            {columns.map((col) => {
              const h = HEADERS[col];
              const active = h.sort && sort.key === h.sort;
              return (
                <th
                  key={col}
                  scope="col"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : h.sort ? "none" : undefined}
                  className={cn("px-3 py-2 text-xs font-medium text-muted", h.className)}
                >
                  {h.sort ? (
                    <button
                      type="button"
                      onClick={() => onSort(h.sort as SortKey)}
                      className={cn("inline-flex items-center gap-1 rounded-sm hover:text-ink", active && "text-ink")}
                    >
                      {h.label}
                      {active ? sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowsDownUp size={12} />}
                    </button>
                  ) : (
                    h.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="border-b border-line last:border-b-0 hover:bg-canvas/70">
              {columns.map((col) => (
                <td key={col} className="px-3 py-2.5 align-middle">
                  {cell(col, t)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
