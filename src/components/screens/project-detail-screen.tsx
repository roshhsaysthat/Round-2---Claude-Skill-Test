"use client";

import { PencilSimple, Plus, SquaresFour, Warning } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { ProjectFormDialog, TemplateDialog } from "@/components/projects/project-parts";
import { Page, PageHeader, Section, TwoToneTitle } from "@/components/shell/page";
import { ProjectStatusTag } from "@/components/ui/badges";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState, Meter } from "@/components/ui/feedback";
import { TaskFilterBar, type FilterVisibility } from "@/components/tasks/task-filters";
import { TaskTable } from "@/components/tasks/task-table";
import { requestOpenTask, useApp, useUi } from "@/lib/app-context";
import { applyFilters, projectStats, projectTasks, sortTasks, type SortDir, type SortKey } from "@/lib/selectors";
import { useTaskFilters } from "@/lib/use-task-filters";
import { formatDate, pluralize } from "@/lib/utils";

const SHOW: FilterVisibility = { search: true, priority: true, assignee: true, due: true, status: "with-backlog" };

export function ProjectDetailScreen({ id }: { id: string }) {
  const { data, today } = useApp();
  const ui = useUi();
  const { filters, setFilters, clear } = useTaskFilters();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "due", dir: "asc" });
  const [editing, setEditing] = useState(false);
  const [templates, setTemplates] = useState(false);
  const project = data.projects.find((p) => p.id === id);

  if (!project) {
    return (
      <Page>
        <EmptyState title="Project not found" body="It may have been removed." action={<Link href="/projects" className={buttonClass("primary", "md")}>Back to projects</Link>} />
      </Page>
    );
  }
  const s = projectStats(data, id, today);
  const owner = data.users.find((u) => u.id === project.ownerId);
  const tasks = sortTasks(applyFilters(projectTasks(data, id), filters, today, data), sort.key, sort.dir, data);

  return (
    <Page>
      <PageHeader
        breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: project.name }]}
        title={<TwoToneTitle soft={project.key} strong={project.name} />}
        description={project.description}
        actions={
          <>
            <ProjectStatusTag status={project.status} />
            <Button icon={<PencilSimple size={14} />} onClick={() => setEditing(true)}>Edit</Button>
            <Button icon={<SquaresFour size={14} />} onClick={() => setTemplates(true)}>Add from template</Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => ui.openCreate({ projectId: id })}>Add task</Button>
          </>
        }
      />
      <div className="mb-8 grid gap-4 rounded-lg bg-surface p-4 shadow-elev-1 md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-2">
          <Meter value={s.done} max={Math.max(s.total - s.backlog, 1)} label={`${s.progress}% complete`} />
          <p className="text-sm text-muted">{s.progress}% complete · {s.done} done · {pluralize(s.open, "open task")} · {s.backlog} in backlog</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Owner</dt><dd>{owner?.name ?? "Unassigned"}</dd>
          <dt className="text-muted">Start</dt><dd>{formatDate(project.startDate, true)}</dd>
          <dt className="text-muted">Target</dt><dd>{formatDate(project.targetDate, true)}</dd>
          <dt className="text-muted">Overdue</dt>
          <dd className={s.overdue ? "inline-flex items-center gap-1 text-signal" : ""}>{s.overdue ? <Warning size={12} weight="fill" aria-hidden /> : null}{s.overdue}</dd>
          <dt className="text-muted">Blocked</dt><dd>{s.blocked}</dd>
          <dt className="text-muted">On hold</dt><dd>{s.onHold}</dd>
        </dl>
      </div>
      <Section title="Tasks" id="project-tasks">
        <div className="mb-3"><TaskFilterBar value={filters} onChange={setFilters} onClear={clear} show={SHOW} /></div>
        {tasks.length === 0 ? (
          <EmptyState title={projectTasks(data, id).length ? "No tasks match these filters" : "No tasks in this project"} action={<Button variant="primary" onClick={() => ui.openCreate({ projectId: id })}>Add task</Button>} />
        ) : (
          <TaskTable
            tasks={tasks}
            onOpen={(t) => requestOpenTask(t.id)}
            sort={sort}
            onSort={(key) => setSort((p) => ({ key, dir: p.key === key && p.dir === "asc" ? "desc" : "asc" }))}
            columns={["key", "title", "status", "priority", "assignee", "due"]}
            caption={`Tasks in ${project.name}`}
          />
        )}
      </Section>
      {editing ? <ProjectFormDialog open project={project} onClose={() => setEditing(false)} /> : null}
      {templates ? <TemplateDialog open defaultProjectId={id} onClose={() => setTemplates(false)} onCreated={(k, tid) => k === "task" && requestOpenTask(tid)} /> : null}
    </Page>
  );
}
