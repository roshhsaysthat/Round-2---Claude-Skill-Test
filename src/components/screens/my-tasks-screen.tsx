"use client";

import { Plus } from "@phosphor-icons/react";
import { useMemo } from "react";
import { Page, PageHeader, TwoToneTitle } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { BlockedTaskList, HeldTaskList } from "@/components/tasks/hold-blocked";
import { KanbanBoard } from "@/components/tasks/kanban";
import { activeFilterCount, TaskFilterBar, type FilterVisibility } from "@/components/tasks/task-filters";
import { TaskTable } from "@/components/tasks/task-table";
import { requestOpenTask, useApp, useQueryState, useUi } from "@/lib/app-context";
import { applyFilters, tasksForView, type MyTasksView, type Scope, type SortDir, type SortKey } from "@/lib/selectors";
import { sortTasks } from "@/lib/selectors";
import { useTaskFilters } from "@/lib/use-task-filters";
import type { Task } from "@/lib/types";

const VIEWS: MyTasksView[] = ["kanban", "list", "onhold", "blocked"];
const SHOW: FilterVisibility = { search: true, project: true, priority: true, assignee: false, due: true, status: false };
const SHOW_LIST: FilterVisibility = { ...SHOW, status: true };

export function MyTasksScreen() {
  const { data, index, today } = useApp();
  const ui = useUi();
  const [params, setParams] = useQueryState();
  const { filters, setFilters, clear } = useTaskFilters();

  const rawView = params.get("view");
  const view: MyTasksView = VIEWS.includes(rawView as MyTasksView) ? (rawView as MyTasksView) : "kanban";
  const scope: Scope = params.get("scope") === "all" ? "all" : "me";
  const sortKey = (params.get("sort") as SortKey | null) ?? "due";
  const sortDir: SortDir = params.get("dir") === "desc" ? "desc" : "asc";

  const counts = useMemo(
    () => ({
      kanban: tasksForView(data, index, "kanban", scope).length,
      list: tasksForView(data, index, "list", scope).length,
      onhold: tasksForView(data, index, "onhold", scope).length,
      blocked: tasksForView(data, index, "blocked", scope).length,
    }),
    [data, index, scope],
  );

  const show = view === "list" ? SHOW_LIST : SHOW;
  // Only apply filters that the current view exposes, so a stale URL param can't hide tasks invisibly.
  const effective = {
    ...filters,
    status: show.status ? filters.status : "",
  };
  const base = tasksForView(data, index, view, scope);
  const tasks = applyFilters(base, effective, today, data);
  const filtered = activeFilterCount(effective, show) > 0;
  const open = (t: Task): void => requestOpenTask(t.id);

  const onSort = (key: SortKey): void =>
    setParams({ sort: key, dir: key === sortKey && sortDir === "asc" ? "desc" : "asc" });

  const empty = (
    <EmptyState
      title={filtered ? "No tasks match these filters" : "Nothing here yet"}
      body={filtered ? "Try removing a filter." : "Create a task to get started."}
      action={
        filtered ? (
          <Button onClick={clear}>Clear filters</Button>
        ) : (
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => ui.openCreate()}>Create task</Button>
        )
      }
    />
  );

  return (
    <Page wide>
      <PageHeader
        title={<TwoToneTitle soft="Your" strong="tasks" />}
        description="One list of work in four views. Holds and blockers live here too."
        actions={
          <>
            <Tabs<Scope>
              label="Scope"
              idPrefix="mt-scope"
              value={scope}
              onChange={(s) => setParams({ scope: s === "all" ? "all" : null })}
              items={[{ value: "me", label: "Mine" }, { value: "all", label: "Everyone" }]}
            />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => ui.openCreate()}>Create task</Button>
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3">
        <Tabs<MyTasksView>
          label="My Tasks views"
          idPrefix="mt"
          value={view}
          onChange={(v) => setParams({ view: v === "kanban" ? null : v })}
          items={[
            { value: "kanban", label: "Kanban", count: counts.kanban },
            { value: "list", label: "List", count: counts.list },
            { value: "onhold", label: "On hold", count: counts.onhold },
            { value: "blocked", label: "Blocked", count: counts.blocked },
          ]}
        />
        <TaskFilterBar value={effective} onChange={setFilters} onClear={clear} show={show} />
      </div>
      <TabPanel idPrefix="mt" value={view}>
        {view === "onhold" ? (
          <HeldTaskList tasks={tasks} onOpen={open} />
        ) : view === "blocked" ? (
          <BlockedTaskList tasks={tasks} onOpen={open} />
        ) : tasks.length === 0 ? (
          empty
        ) : view === "kanban" ? (
          <KanbanBoard tasks={tasks} onOpen={open} />
        ) : (
          <TaskTable
            tasks={sortTasks(tasks, sortKey, sortDir, data)}
            onOpen={open}
            sort={{ key: sortKey, dir: sortDir }}
            onSort={onSort}
            caption="My tasks"
          />
        )}
      </TabPanel>
    </Page>
  );
}
