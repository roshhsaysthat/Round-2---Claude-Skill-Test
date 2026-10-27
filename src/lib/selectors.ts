/**
 * Read-side logic: filtering, sorting, dashboard metrics and search.
 * Everything is computed from the single AppData record. Nothing is hardcoded.
 * Search is client-side but isolated here, so it can be swapped for a server query.
 */
import { getEffectiveState, indexTasks, isInFlow, type TaskIndex } from "./lifecycle";
import type { ActivityEvent, AppData, EffectiveState, Priority, Project, Task, TaskFilters } from "./types";
import { PRIORITY_WEIGHT, diffDays } from "./utils";

export function topLevel(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.parentId);
}

export function subtasksOf(tasks: Task[], parentId: string): Task[] {
  return tasks.filter((t) => t.parentId === parentId).sort((a, b) => a.number - b.number);
}

export function subtaskProgress(tasks: Task[], parentId: string): { done: number; total: number } {
  const subs = tasks.filter((t) => t.parentId === parentId);
  return { done: subs.filter((s) => s.status === "done").length, total: subs.length };
}

/** Tasks that this task is currently holding up. */
export function blockingTasks(tasks: Task[], taskId: string): Task[] {
  return tasks.filter((t) => t.blockedBy.includes(taskId));
}

export function isOverdue(task: Task, today: string): boolean {
  return !!task.dueDate && task.stage === "active" && task.status !== "done" && diffDays(task.dueDate, today) < 0;
}

export function isUpcoming(task: Task, today: string, days = 7): boolean {
  if (!task.dueDate || task.stage !== "active" || task.status === "done") return false;
  const delta = diffDays(task.dueDate, today);
  return delta >= 0 && delta <= days;
}

/* ------------------------------ filtering ------------------------------ */

export function applyFilters(tasks: Task[], f: TaskFilters, today: string, data: AppData): Task[] {
  const q = f.q?.trim().toLowerCase();
  const projectNames = new Map(data.projects.map((p) => [p.id, p.name.toLowerCase()]));
  return tasks.filter((t) => {
    if (f.projectId && t.projectId !== f.projectId) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.assigneeId === "unassigned" && t.assigneeId) return false;
    if (f.assigneeId && f.assigneeId !== "unassigned" && t.assigneeId !== f.assigneeId) return false;
    if (f.label && !t.labels.includes(f.label)) return false;
    if (f.status === "backlog" && t.stage !== "backlog") return false;
    if (f.status && f.status !== "backlog" && (t.stage === "backlog" || t.status !== f.status)) return false;
    if (f.due === "overdue" && !isOverdue(t, today)) return false;
    if (f.due === "upcoming" && !isUpcoming(t, today)) return false;
    if (f.due === "none" && t.dueDate) return false;
    if (q) {
      const hay = `${t.key} ${t.title} ${t.description} ${projectNames.get(t.projectId) ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type SortKey = "priority" | "due" | "updated" | "title" | "status" | "assignee" | "key";
export type SortDir = "asc" | "desc";

const STATUS_WEIGHT = { todo: 0, in_progress: 1, in_review: 2, done: 3 } as const;

export function sortTasks(tasks: Task[], key: SortKey, dir: SortDir, data: AppData): Task[] {
  const names = new Map(data.users.map((u) => [u.id, u.name]));
  const sign = dir === "asc" ? 1 : -1;
  const farFuture = "9999-12-31";
  const cmp = (a: Task, b: Task): number => {
    switch (key) {
      case "priority":
        return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      case "due":
        return (a.dueDate ?? farFuture).localeCompare(b.dueDate ?? farFuture);
      case "updated":
        return a.updatedAt.localeCompare(b.updatedAt);
      case "title":
        return a.title.localeCompare(b.title);
      case "status":
        return STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status];
      case "assignee":
        return (names.get(a.assigneeId ?? "") ?? "zzz").localeCompare(names.get(b.assigneeId ?? "") ?? "zzz");
      case "key":
        return a.key.localeCompare(b.key, undefined, { numeric: true });
    }
  };
  return [...tasks].sort((a, b) => sign * cmp(a, b) || a.key.localeCompare(b.key, undefined, { numeric: true }));
}

/* ------------------------------- My Tasks ------------------------------ */

export type MyTasksView = "kanban" | "list" | "onhold" | "blocked";
export type Scope = "me" | "all";

export function tasksForView(data: AppData, index: TaskIndex, view: MyTasksView, scope: Scope): Task[] {
  const mine = (t: Task): boolean => scope === "all" || t.assigneeId === data.currentUserId;
  return topLevel(data.tasks).filter((t) => {
    if (!mine(t)) return false;
    const state = getEffectiveState(t, index);
    if (view === "onhold") return state === "on_hold";
    if (view === "blocked") return state === "blocked";
    return isInFlow(t, index);
  });
}

/** Tasks in each state for a set of top-level tasks, used by counts and badges. */
export function countByState(tasks: Task[], index: TaskIndex): Record<EffectiveState, number> {
  const out: Record<EffectiveState, number> = { backlog: 0, done: 0, on_hold: 0, blocked: 0, active: 0 };
  for (const t of tasks) out[getEffectiveState(t, index)]++;
  return out;
}

/* --------------------------------- Home --------------------------------- */

export interface HomeMetrics {
  active: Task[];
  completed: Task[];
  overdue: Task[];
  upcoming: Task[];
  onHold: Task[];
  blocked: Task[];
}

export function homeMetrics(data: AppData, scope: Scope, today: string): HomeMetrics {
  const index = indexTasks(data.tasks);
  const mine = topLevel(data.tasks).filter((t) => scope === "all" || t.assigneeId === data.currentUserId);
  const stateOf = (t: Task): EffectiveState => getEffectiveState(t, index);
  const inPlay = mine.filter((t) => ["active", "blocked"].includes(stateOf(t)));
  return {
    active: inPlay,
    completed: mine.filter((t) => stateOf(t) === "done"),
    overdue: inPlay.filter((t) => isOverdue(t, today)),
    upcoming: inPlay.filter((t) => isUpcoming(t, today)).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")),
    onHold: mine.filter((t) => stateOf(t) === "on_hold"),
    blocked: mine.filter((t) => stateOf(t) === "blocked"),
  };
}

export function recentActivity(data: AppData, limit = 8, scope: Scope = "all"): ActivityEvent[] {
  const mineIds = new Set(data.tasks.filter((t) => t.assigneeId === data.currentUserId).map((t) => t.id));
  return [...data.activity]
    .filter((a) => a.taskId !== null)
    .filter((a) => scope === "all" || (a.taskId && mineIds.has(a.taskId)))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/* -------------------------------- Projects ------------------------------- */

export interface ProjectStats {
  total: number;
  done: number;
  open: number;
  backlog: number;
  overdue: number;
  blocked: number;
  onHold: number;
  progress: number;
}

export function projectStats(data: AppData, projectId: string, today: string): ProjectStats {
  const index = indexTasks(data.tasks);
  const tasks = topLevel(data.tasks).filter((t) => t.projectId === projectId);
  const counts = countByState(tasks, index);
  const planned = tasks.filter((t) => t.stage === "active");
  const done = counts.done;
  return {
    total: tasks.length,
    done,
    open: counts.active + counts.blocked + counts.on_hold,
    backlog: counts.backlog,
    overdue: planned.filter((t) => isOverdue(t, today)).length,
    blocked: counts.blocked,
    onHold: counts.on_hold,
    progress: planned.length ? Math.round((done / planned.length) * 100) : 0,
  };
}

export function projectTasks(data: AppData, projectId: string): Task[] {
  return topLevel(data.tasks).filter((t) => t.projectId === projectId);
}

/* --------------------------------- Search -------------------------------- */

export interface SearchResults {
  tasks: Task[];
  projects: Project[];
}

function score(haystacks: { text: string; weight: number }[], tokens: string[]): number {
  let total = 0;
  for (const token of tokens) {
    let best = 0;
    for (const h of haystacks) {
      const text = h.text.toLowerCase();
      if (!text.includes(token)) continue;
      const bonus = text === token ? 3 : text.startsWith(token) ? 2 : 1;
      best = Math.max(best, h.weight * bonus);
    }
    if (best === 0) return 0; // every token must match somewhere
    total += best;
  }
  return total;
}

export function searchAll(data: AppData, query: string, filters: TaskFilters, today: string): SearchResults {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const projectName = new Map(data.projects.map((p) => [p.id, p.name]));
  const filtered = applyFilters(data.tasks, { ...filters, q: "" }, today, data);

  const hasFilters = Object.values({ ...filters, q: "" }).some(Boolean);
  const scoredTasks = filtered
    .map((t) => ({
      t,
      s: tokens.length
        ? score(
            [
              { text: t.key, weight: 12 },
              { text: t.title, weight: 8 },
              { text: projectName.get(t.projectId) ?? "", weight: 4 },
              { text: t.description, weight: 2 },
            ],
            tokens,
          )
        : 1,
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.t.key.localeCompare(b.t.key, undefined, { numeric: true }));

  const projects =
    tokens.length && !hasFilters
      ? data.projects
          .map((p) => ({
            p,
            s: score(
              [
                { text: p.name, weight: 10 },
                { text: p.key, weight: 8 },
                { text: p.description, weight: 2 },
              ],
              tokens,
            ),
          }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s)
          .map((x) => x.p)
      : [];

  return { tasks: scoredTasks.map((x) => x.t), projects };
}

export function priorityCounts(tasks: Task[]): Record<Priority, number> {
  const out: Record<Priority, number> = { urgent: 0, high: 0, medium: 0, low: 0, none: 0 };
  for (const t of tasks) out[t.priority]++;
  return out;
}

