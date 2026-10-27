"use client";

import { CalendarBlank, CircleHalf, FolderSimple, User, X, CellSignalFull } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PillSelect, SearchField } from "@/components/ui/fields";
import { useApp } from "@/lib/app-context";
import type { TaskFilters } from "@/lib/types";
import { PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL, STATUS_ORDER } from "@/lib/utils";

export interface FilterVisibility {
  search?: boolean;
  project?: boolean;
  priority?: boolean;
  assignee?: boolean;
  due?: boolean;
  status?: boolean | "with-backlog";
}

const DUE_OPTIONS = [
  { value: "", label: "Any due date" },
  { value: "overdue", label: "Overdue" },
  { value: "upcoming", label: "Due in 7 days" },
  { value: "none", label: "No due date" },
];

export function activeFilterCount(f: TaskFilters, show: FilterVisibility): number {
  let n = 0;
  if (show.search && f.q?.trim()) n++;
  if (show.project && f.projectId) n++;
  if (show.priority && f.priority) n++;
  if (show.assignee && f.assigneeId) n++;
  if (show.due && f.due) n++;
  if (show.status && f.status) n++;
  return n;
}

/** One filter bar for every list in the app (My Tasks, Backlog, Project, Search). */
export function TaskFilterBar({
  value,
  onChange,
  onClear,
  show,
  searchPlaceholder = "Filter tasks",
  searchLabel = "Filter tasks",
}: {
  value: TaskFilters;
  onChange: (patch: Partial<TaskFilters>) => void;
  onClear: () => void;
  show: FilterVisibility;
  searchPlaceholder?: string;
  searchLabel?: string;
}) {
  const { data } = useApp();
  const count = activeFilterCount(value, show);
  const statusOptions = [
    { value: "", label: "Any status" },
    ...(show.status === "with-backlog" ? [{ value: "backlog", label: "Backlog" }] : []),
    ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
      {show.search ? (
        <SearchField
          value={value.q ?? ""}
          onChange={(q) => onChange({ q })}
          placeholder={searchPlaceholder}
          label={searchLabel}
          className="w-full sm:w-64"
        />
      ) : null}
      {show.project ? (
        <PillSelect
          label="Filter by project"
          value={value.projectId ?? ""}
          onChange={(v) => onChange({ projectId: v })}
          icon={<FolderSimple size={14} />}
          muted={!value.projectId}
          display={value.projectId ? undefined : "Project"}
          options={[{ value: "", label: "All projects" }, ...data.projects.map((p) => ({ value: p.id, label: p.name }))]}
        />
      ) : null}
      {show.status ? (
        <PillSelect
          label="Filter by status"
          value={value.status ?? ""}
          onChange={(v) => onChange({ status: v as TaskFilters["status"] })}
          icon={<CircleHalf size={14} />}
          muted={!value.status}
          display={value.status ? undefined : "Status"}
          options={statusOptions}
        />
      ) : null}
      {show.priority ? (
        <PillSelect
          label="Filter by priority"
          value={value.priority ?? ""}
          onChange={(v) => onChange({ priority: v as TaskFilters["priority"] })}
          icon={<CellSignalFull size={14} />}
          muted={!value.priority}
          display={value.priority ? undefined : "Priority"}
          options={[{ value: "", label: "Any priority" }, ...PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))]}
        />
      ) : null}
      {show.assignee ? (
        <PillSelect
          label="Filter by assignee"
          value={value.assigneeId ?? ""}
          onChange={(v) => onChange({ assigneeId: v })}
          icon={<User size={14} />}
          muted={!value.assigneeId}
          display={value.assigneeId ? undefined : "Assignee"}
          options={[
            { value: "", label: "Anyone" },
            { value: "unassigned", label: "Unassigned" },
            ...data.users.map((u) => ({ value: u.id, label: u.name })),
          ]}
        />
      ) : null}
      {show.due ? (
        <PillSelect
          label="Filter by due date"
          value={value.due ?? ""}
          onChange={(v) => onChange({ due: v as TaskFilters["due"] })}
          icon={<CalendarBlank size={14} />}
          muted={!value.due}
          display={value.due ? undefined : "Due date"}
          options={DUE_OPTIONS}
        />
      ) : null}
      {count > 0 ? (
        <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={onClear}>
          Clear {count === 1 ? "filter" : `${count} filters`}
        </Button>
      ) : null}
    </div>
  );
}
