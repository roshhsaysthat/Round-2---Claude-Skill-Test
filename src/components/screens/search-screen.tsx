"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useState } from "react";
import { ProjectCard } from "@/components/projects/project-parts";
import { Page, PageHeader, Section, TwoToneTitle } from "@/components/shell/page";
import { EmptyState } from "@/components/ui/feedback";
import { SearchField } from "@/components/ui/fields";
import { TaskFilterBar, type FilterVisibility } from "@/components/tasks/task-filters";
import { TaskTable } from "@/components/tasks/task-table";
import { requestOpenTask, useApp } from "@/lib/app-context";
import { searchAll, type SortDir, type SortKey } from "@/lib/selectors";
import { useTaskFilters } from "@/lib/use-task-filters";
import { pluralize } from "@/lib/utils";

const SHOW: FilterVisibility = { search: false, project: true, priority: true, assignee: true, due: true, status: "with-backlog" };

export function SearchScreen() {
  const { data, today } = useApp();
  const { filters, setFilters, clear } = useTaskFilters();
  const q = filters.q ?? "";
  const [draft, setDraft] = useState(q);
  const [seen, setSeen] = useState(q);
  if (q !== seen) {
    setSeen(q);
    setDraft(q);
  }
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  const hasFilters = !!(filters.projectId || filters.priority || filters.assigneeId || filters.due || filters.status || filters.label);
  const searching = q.trim().length > 0 || hasFilters;
  const results = searching ? searchAll(data, q, filters, today) : { tasks: [], projects: [] };
  const tasks = sort ? [...results.tasks].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const av = sort.key === "due" ? a.dueDate ?? "9999" : sort.key === "title" ? a.title : sort.key === "updated" ? a.updatedAt : a.key;
    const bv = sort.key === "due" ? b.dueDate ?? "9999" : sort.key === "title" ? b.title : sort.key === "updated" ? b.updatedAt : b.key;
    return av.localeCompare(bv, undefined, { numeric: true }) * dir;
  }) : results.tasks;

  return (
    <Page>
      <PageHeader title={<TwoToneTitle soft="Search" strong="everything" />} description="Task titles, IDs, descriptions and project names." />
      <div className="mb-4 flex flex-col gap-3">
        <SearchField
          value={draft}
          onChange={(v) => { setDraft(v); setFilters({ q: v }); }}
          onSubmit={(v) => setFilters({ q: v })}
          placeholder="Search tasks and projects"
          label="Search tasks and projects"
          className="w-full max-w-xl"
          autoFocus
        />
        <TaskFilterBar value={filters} onChange={setFilters} onClear={clear} show={SHOW} />
      </div>
      {!searching ? (
        <EmptyState icon={<MagnifyingGlass />} title="Search the whole workspace" body="Try a task ID like AUR-12, a word from a title, or a project name. Filters work on their own too." />
      ) : results.tasks.length === 0 && results.projects.length === 0 ? (
        <EmptyState icon={<MagnifyingGlass />} title={q ? `No results for "${q}"` : "No tasks match these filters"} body="Check the spelling or remove a filter." />
      ) : (
        <div className="flex flex-col gap-8">
          <p role="status" className="text-sm text-muted">{pluralize(results.tasks.length, "task")}{results.projects.length ? `, ${pluralize(results.projects.length, "project")}` : ""} found</p>
          {results.projects.length > 0 ? (
            <Section title="Projects" id="search-projects">
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{results.projects.map((p) => <ProjectCard key={p.id} project={p} />)}</ul>
            </Section>
          ) : null}
          {tasks.length > 0 ? (
            <Section title="Tasks" id="search-tasks">
              <TaskTable
                tasks={tasks}
                onOpen={(t) => requestOpenTask(t.id)}
                sort={sort ?? { key: "key", dir: "asc" }}
                onSort={(key) => setSort((p) => ({ key, dir: p?.key === key && p.dir === "asc" ? "desc" : "asc" }))}
                columns={["key", "title", "status", "priority", "assignee", "project", "due"]}
                caption="Search results"
              />
            </Section>
          ) : null}
        </div>
      )}
    </Page>
  );
}
