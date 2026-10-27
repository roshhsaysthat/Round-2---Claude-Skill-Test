"use client";

import { ArrowDown, ArrowUp, ArrowUUpRight, Plus, Trash, Tray } from "@phosphor-icons/react";
import { AssigneeAvatar } from "@/components/ui/avatar";
import { LabelTag, PriorityIndicator } from "@/components/ui/badges";
import { ProjectBadge } from "@/components/ui/badges";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Page, PageHeader, TwoToneTitle } from "@/components/shell/page";
import { activeFilterCount, TaskFilterBar, type FilterVisibility } from "@/components/tasks/task-filters";
import { requestOpenTask, useApp, useUi } from "@/lib/app-context";
import { applyFilters, topLevel } from "@/lib/selectors";
import { useTaskFilters } from "@/lib/use-task-filters";
import { pluralize } from "@/lib/utils";

const SHOW: FilterVisibility = { search: true, project: true, priority: true, assignee: true, due: false, status: false };

/**
 * Backlog holds the same task records as everywhere else; "active" is just a stage flag.
 * Order here is manual rank, so reprioritizing is disabled while filters hide part of the list.
 */
export function BacklogScreen() {
  const { data, today, actions } = useApp();
  const ui = useUi();
  const { filters, setFilters, clear } = useTaskFilters();
  const all = topLevel(data.tasks).filter((t) => t.stage === "backlog").sort((a, b) => a.rank - b.rank);
  const filtered = activeFilterCount(filters, SHOW) > 0;
  const tasks = applyFilters(all, filters, today, data);

  const remove = async (id: string, key: string, title: string): Promise<void> => {
    const ok = await ui.confirm({
      title: `Delete ${key}?`,
      body: `"${title}" and its subtasks will be removed. You can undo right after.`,
      confirmLabel: "Delete task",
      danger: true,
    });
    if (ok) actions.deleteTask(id);
  };

  return (
    <Page>
      <PageHeader
        title={<TwoToneTitle soft="Ideas &" strong="backlog" />}
        description={`${pluralize(all.length, "task")} waiting. Move one into active work when it is ready.`}
        actions={<Button variant="primary" icon={<Plus size={14} />} onClick={() => ui.openCreate({ status: "backlog" })}>Add to backlog</Button>}
      />
      <div className="mb-4"><TaskFilterBar value={filters} onChange={setFilters} onClear={clear} show={SHOW} /></div>
      {filtered ? <p className="mb-2 text-xs text-muted">Reordering is off while filters are applied.</p> : null}
      {tasks.length === 0 ? (
        <EmptyState
          icon={<Tray />}
          title={filtered ? "No backlog tasks match" : "The backlog is empty"}
          body={filtered ? "Try removing a filter." : "Capture ideas here before they are ready to plan."}
          action={filtered ? <Button onClick={clear}>Clear filters</Button> : <Button variant="primary" onClick={() => ui.openCreate({ status: "backlog" })}>Add to backlog</Button>}
        />
      ) : (
        <ol aria-label="Backlog" className="flex flex-col gap-2">
          {tasks.map((t, i) => {
            const project = data.projects.find((p) => p.id === t.projectId);
            const user = data.users.find((u) => u.id === t.assigneeId);
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface p-3 shadow-elev-1">
                <PriorityIndicator priority={t.priority} />
                <span className="shrink-0 text-xs tabular-nums text-muted">{t.key}</span>
                <button type="button" onClick={() => requestOpenTask(t.id)} className="min-w-0 flex-1 truncate rounded-sm text-left text-sm font-medium hover:underline">
                  {t.title}
                </button>
                <span className="hidden gap-1 md:flex">{t.labels.slice(0, 2).map((l) => <LabelTag key={l} name={l} />)}</span>
                <ProjectBadge project={project} className="hidden sm:inline-flex" />
                <AssigneeAvatar user={user} size="sm" />
                <div className="flex items-center gap-1">
                  <IconButton aria-label={`Move ${t.key} up`} size="sm" disabled={filtered || i === 0} onClick={() => actions.moveBacklogRank(t.id, "up")}><ArrowUp /></IconButton>
                  <IconButton aria-label={`Move ${t.key} down`} size="sm" disabled={filtered || i === all.length - 1} onClick={() => actions.moveBacklogRank(t.id, "down")}><ArrowDown /></IconButton>
                  <Button size="sm" icon={<ArrowUUpRight size={14} />} onClick={() => actions.activateTask(t.id, "todo")}>Move to active</Button>
                  <IconButton aria-label={`Delete ${t.key}`} size="sm" onClick={() => void remove(t.id, t.key, t.title)}><Trash /></IconButton>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Page>
  );
}
