/**
 * Domain operations. Pure functions: (data, context, input) -> result.
 *
 * Every operation validates first, works on a clone, and returns either
 * { ok: true, data } or { ok: false, error }. The store applies only ok results,
 * so a UI action can never look successful when the state did not change.
 * All lifecycle decisions are delegated to lifecycle.ts.
 */
import {
  checkActivate,
  checkHold,
  checkLinkDependency,
  checkMarkBlocked,
  checkMoveToBacklog,
  checkResume,
  checkStatusChange,
  getEffectiveState,
  indexTasks,
  unresolvedDependencies,
} from "./lifecycle";
import { getTemplate } from "./templates";
import type {
  AppData,
  AppNotification,
  DeletedSnapshot,
  NewProjectInput,
  NewTaskInput,
  NotificationType,
  OpContext,
  OpResult,
  Priority,
  Project,
  Status,
  Task,
  TaskPatch,
} from "./types";
import {
  LABEL_CATALOG,
  PRIORITY_LABEL,
  STATUS_LABEL,
  TINTS,
  addDays,
  diffDays,
  formatDate,
} from "./utils";

/* ----------------------------- plumbing ------------------------------ */

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function done<T = undefined>(data: AppData, changed: boolean, message?: string, value?: T): OpResult<T> {
  return { ok: true, data, changed, message, value };
}

function nextId(d: AppData, prefix: string): string {
  d.seq += 1;
  return `${prefix}${d.seq}`;
}

const MAX_TITLE = 200;
const MAX_TEXT = 8000;

function taskOf(d: AppData, id: string): Task | undefined {
  return d.tasks.find((t) => t.id === id);
}

function nameOf(d: AppData, userId: string | null | undefined): string {
  if (!userId) return "Unassigned";
  return d.users.find((u) => u.id === userId)?.name ?? "Unknown user";
}

function projectOf(d: AppData, id: string): Project | undefined {
  return d.projects.find((p) => p.id === id);
}

function log(d: AppData, ctx: OpContext, text: string, task: Task | null, projectId?: string | null): void {
  d.activity.push({
    id: nextId(d, "a"),
    taskId: task?.id ?? null,
    projectId: projectId ?? task?.projectId ?? null,
    actorId: ctx.actorId,
    at: ctx.now,
    text,
  });
}

function notify(
  d: AppData,
  ctx: OpContext,
  userId: string | null | undefined,
  type: NotificationType,
  task: Task,
  text: string,
  options: { id?: string; allowSelf?: boolean } = {},
): void {
  if (!userId) return;
  if (userId === ctx.actorId && !options.allowSelf) return;
  if (options.id && d.notifications.some((n) => n.id === options.id)) return;
  const n: AppNotification = {
    id: options.id ?? nextId(d, "n"),
    userId,
    type,
    taskId: task.id,
    actorId: options.allowSelf ? null : ctx.actorId,
    text,
    at: ctx.now,
    read: false,
  };
  d.notifications.push(n);
}

function touch(t: Task, ctx: OpContext): void {
  t.updatedAt = ctx.now;
}

function nextRank(d: AppData): number {
  return d.tasks.reduce((m, t) => Math.max(m, t.rank), 0) + 1;
}

function childrenOf(d: AppData, parentId: string): Task[] {
  return d.tasks.filter((t) => t.parentId === parentId);
}

const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low", "none"];

function validDates(start: string | null | undefined, due: string | null | undefined): string | null {
  if (start && due && diffDays(due, start) < 0) return "The due date can't be before the start date.";
  return null;
}

/* ------------------------------ create ------------------------------- */

/** Mutates the draft. Returns the new task or an error string. */
function createInto(d: AppData, ctx: OpContext, input: NewTaskInput): Task | string {
  const title = input.title?.trim() ?? "";
  if (!title) return "Give the task a title.";
  if (title.length > MAX_TITLE) return `Titles are limited to ${MAX_TITLE} characters.`;
  const description = input.description?.trim() ?? "";
  if (description.length > MAX_TEXT) return "That description is too long.";

  const project = projectOf(d, input.projectId);
  if (!project) return "Choose a project for this task.";

  const assigneeId = input.assigneeId ?? null;
  if (assigneeId && !d.users.some((u) => u.id === assigneeId)) return "That assignee no longer exists.";
  const priority = input.priority ?? "none";
  if (!PRIORITIES.includes(priority)) return "Unknown priority.";
  const dateError = validDates(input.startDate, input.dueDate);
  if (dateError) return dateError;

  const labels = [...new Set(input.labels ?? [])];
  if (labels.some((l) => !LABEL_CATALOG.some((c) => c.name === l))) return "Unknown label.";

  let parent: Task | undefined;
  if (input.parentId) {
    parent = taskOf(d, input.parentId);
    if (!parent) return "The parent task no longer exists.";
    if (parent.parentId) return "Subtasks can't have their own subtasks.";
  }

  const blockedBy = [...new Set(input.blockedBy ?? [])];
  for (const id of blockedBy) {
    if (!taskOf(d, id)) return "A linked dependency no longer exists.";
  }

  const choice = input.status ?? "todo";
  const stage = parent ? parent.stage : choice === "backlog" ? "backlog" : "active";
  const status: Status = stage === "backlog" || choice === "backlog" ? "todo" : choice;

  const number = project.nextNumber;
  project.nextNumber += 1;
  project.updatedAt = ctx.now;

  const task: Task = {
    id: nextId(d, "t"),
    key: `${project.key}-${number}`,
    number,
    title,
    description,
    status,
    stage,
    priority,
    assigneeId,
    reporterId: input.reporterId ?? ctx.actorId,
    projectId: project.id,
    labels,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    completedAt: null,
    startDate: input.startDate ?? null,
    dueDate: input.dueDate ?? null,
    parentId: parent?.id ?? null,
    blockedBy,
    hold: null,
    blocker: null,
    comments: [],
    rank: nextRank(d),
  };
  d.tasks.push(task);
  log(d, ctx, parent ? `added subtask ${task.key}: ${task.title}` : `created ${task.key}`, parent ?? task);
  if (assigneeId) {
    notify(d, ctx, assigneeId, "assigned", task, `${nameOf(d, ctx.actorId)} assigned you ${task.key}: ${task.title}`);
  }

  for (const subTitle of input.subtasks ?? []) {
    const t = subTitle.trim();
    if (!t) continue;
    const child = createInto(d, ctx, { title: t, projectId: project.id, parentId: task.id });
    if (typeof child === "string") return child;
  }
  return task;
}

export function createTask(d0: AppData, ctx: OpContext, input: NewTaskInput): OpResult<string> {
  const d = structuredClone(d0);
  const res = createInto(d, ctx, input);
  if (typeof res === "string") return fail(res);
  return done(d, true, `Created ${res.key}`, res.id);
}

export function addSubtask(d0: AppData, ctx: OpContext, parentId: string, title: string): OpResult<string> {
  const parent = taskOf(d0, parentId);
  if (!parent) return fail("That task no longer exists.");
  return createTask(d0, ctx, { title, projectId: parent.projectId, parentId });
}

export function duplicateTask(d0: AppData, ctx: OpContext, id: string): OpResult<string> {
  const src = taskOf(d0, id);
  if (!src) return fail("That task no longer exists.");
  const d = structuredClone(d0);
  const s = taskOf(d, id)!;
  const copy = createInto(d, ctx, {
    title: `${s.title} (copy)`,
    description: s.description,
    projectId: s.projectId,
    assigneeId: s.assigneeId,
    priority: s.priority,
    status: s.stage === "backlog" ? "backlog" : "todo",
    startDate: s.startDate,
    dueDate: s.dueDate,
    labels: s.labels,
    parentId: s.parentId,
    subtasks: childrenOf(d, s.id).map((c) => c.title),
  });
  if (typeof copy === "string") return fail(copy);
  log(d, ctx, `duplicated ${s.key} as ${copy.key}`, s);
  return done(d, true, `Duplicated as ${copy.key}`, copy.id);
}

/* ------------------------------ update ------------------------------- */

function describeChange(d: AppData, field: keyof TaskPatch, before: Task, after: TaskPatch): string | null {
  switch (field) {
    case "title":
      return `renamed this task to "${after.title}"`;
    case "description":
      return "updated the description";
    case "priority":
      return `changed priority from ${PRIORITY_LABEL[before.priority]} to ${PRIORITY_LABEL[after.priority as Priority]}`;
    case "assigneeId":
      if (!after.assigneeId) return `unassigned ${nameOf(d, before.assigneeId)}`;
      return before.assigneeId
        ? `reassigned from ${nameOf(d, before.assigneeId)} to ${nameOf(d, after.assigneeId)}`
        : `assigned this to ${nameOf(d, after.assigneeId)}`;
    case "reporterId":
      return `changed the reporter to ${nameOf(d, after.reporterId)}`;
    case "projectId":
      return `moved this to ${projectOf(d, after.projectId as string)?.name ?? "another project"}`;
    case "startDate":
      return after.startDate ? `set the start date to ${formatDate(after.startDate)}` : "cleared the start date";
    case "dueDate":
      return after.dueDate
        ? before.dueDate
          ? `changed the due date from ${formatDate(before.dueDate)} to ${formatDate(after.dueDate)}`
          : `set the due date to ${formatDate(after.dueDate)}`
        : "removed the due date";
    case "labels": {
      const added = (after.labels ?? []).filter((l) => !before.labels.includes(l));
      const removed = before.labels.filter((l) => !(after.labels ?? []).includes(l));
      const parts: string[] = [];
      if (added.length) parts.push(`added ${added.join(", ")}`);
      if (removed.length) parts.push(`removed ${removed.join(", ")}`);
      return parts.length ? `${parts.join(" and ")} (labels)` : null;
    }
    default:
      return null;
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i]);
  return a === b;
}

export function updateTask(d0: AppData, ctx: OpContext, id: string, patch: TaskPatch): OpResult {
  const d = structuredClone(d0);
  const t = taskOf(d, id);
  if (!t) return fail("That task no longer exists.");

  const clean: TaskPatch = { ...patch };
  if (clean.title !== undefined) {
    clean.title = clean.title.trim();
    if (!clean.title) return fail("A task needs a title.");
    if (clean.title.length > MAX_TITLE) return fail(`Titles are limited to ${MAX_TITLE} characters.`);
  }
  if (clean.description !== undefined) {
    clean.description = clean.description.trim();
    if (clean.description.length > MAX_TEXT) return fail("That description is too long.");
  }
  if (clean.priority !== undefined && !PRIORITIES.includes(clean.priority)) return fail("Unknown priority.");
  if (clean.assigneeId && !d.users.some((u) => u.id === clean.assigneeId)) return fail("That assignee no longer exists.");
  if (clean.reporterId && !d.users.some((u) => u.id === clean.reporterId)) return fail("That reporter no longer exists.");
  if (clean.projectId && !projectOf(d, clean.projectId)) return fail("That project no longer exists.");
  if (clean.labels) {
    clean.labels = [...new Set(clean.labels)];
    if (clean.labels.some((l) => !LABEL_CATALOG.some((c) => c.name === l))) return fail("Unknown label.");
  }
  const dateError = validDates(
    clean.startDate !== undefined ? clean.startDate : t.startDate,
    clean.dueDate !== undefined ? clean.dueDate : t.dueDate,
  );
  if (dateError) return fail(dateError);

  const changedFields: (keyof TaskPatch)[] = [];
  const before = structuredClone(t);
  for (const key of Object.keys(clean) as (keyof TaskPatch)[]) {
    if (clean[key] === undefined) continue;
    if (sameValue(t[key], clean[key])) continue;
    changedFields.push(key);
  }
  if (changedFields.length === 0) return done(d0, false);

  for (const key of changedFields) {
    (t as unknown as Record<string, unknown>)[key] = clean[key];
    const text = describeChange(d, key, before, clean);
    if (text) log(d, ctx, text, t);
  }
  if (changedFields.includes("projectId")) {
    for (const c of childrenOf(d, t.id)) c.projectId = t.projectId;
  }
  touch(t, ctx);

  const assigneeChanged = changedFields.includes("assigneeId");
  if (assigneeChanged && t.assigneeId) {
    notify(d, ctx, t.assigneeId, "assigned", t, `${nameOf(d, ctx.actorId)} assigned you ${t.key}: ${t.title}`);
  }
  const visible = changedFields.filter((f) => f !== "assigneeId" && f !== "description");
  if (visible.length && t.assigneeId && !(assigneeChanged && t.assigneeId)) {
    notify(d, ctx, t.assigneeId, "updated", t, `${nameOf(d, ctx.actorId)} updated ${t.key}: ${t.title}`);
  }
  return done(d, true, "Saved");
}

export function setStatus(d0: AppData, ctx: OpContext, id: string, to: Status): OpResult {
  const d = structuredClone(d0);
  const t = taskOf(d, id);
  if (!t) return fail("That task no longer exists.");
  if (t.status === to) return done(d0, false);
  const index = indexTasks(d.tasks);
  const check = checkStatusChange(t, to, index);
  if (!check.ok) return fail(check.error);

  const dependentsBefore = d.tasks.filter((x) => x.blockedBy.includes(t.id));
  const wasBlocked = new Map(dependentsBefore.map((x) => [x.id, getEffectiveState(x, index) === "blocked"]));

  const from = t.status;
  t.status = to;
  t.completedAt = to === "done" ? ctx.now : null;
  if (to === "done") {
    // Done work is never paused or blocked. Clear those so the record can't contradict itself.
    if (t.hold) log(d, ctx, "resumed automatically because the task was completed", t);
    if (t.blocker) log(d, ctx, "cleared the blocker because the task was completed", t);
    t.hold = null;
    t.blocker = null;
  }
  touch(t, ctx);
  log(d, ctx, `moved ${t.key} from ${STATUS_LABEL[from]} to ${STATUS_LABEL[to]}`, t);
  notify(d, ctx, t.assigneeId, "updated", t, `${nameOf(d, ctx.actorId)} moved ${t.key} to ${STATUS_LABEL[to]}`);

  // Dependency side effects: completing or reopening changes who is blocked.
  const after = indexTasks(d.tasks);
  for (const dep of dependentsBefore) {
    const live = taskOf(d, dep.id)!;
    const isBlocked = getEffectiveState(live, after) === "blocked";
    if (wasBlocked.get(dep.id) && !isBlocked && live.status !== "done") {
      log(d, ctx, `is no longer blocked: ${t.key} is done`, live);
      notify(d, ctx, live.assigneeId, "updated", live, `${live.key} is no longer blocked. ${t.key} is done.`);
    }
  }
  return done(d, true, `${t.key} moved to ${STATUS_LABEL[to]}`);
}

/* ------------------------- hold and blockers -------------------------- */

export function holdTask(d0: AppData, ctx: OpContext, id: string, reason: string): OpResult {
  const d = structuredClone(d0);
  const t = taskOf(d, id);
  if (!t) return fail("That task no longer exists.");
  const check = checkHold(t);
  if (!check.ok) return fail(check.error);
  const why = reason.trim();
  if (why.length > 500) return fail("Keep the reason under 500 characters.");
  t.hold = { reason: why, at: ctx.now, byId: ctx.actorId };
  touch(t, ctx);
  log(d, ctx, why ? `put this on hold: ${why}` : "put this on hold", t);
  notify(d, ctx, t.assigneeId, "updated", t, `${nameOf(d, ctx.actorId)} put ${t.key} on hold`);
  return done(d, true, `${t.key} is on hold`);
}

export function resumeTask(d0: AppData, ctx: OpContext, id: string): OpResult {
  const d = structuredClone(d0);
  const t = taskOf(d, id);
  if (!t) return fail("That task no longer exists.");
  const check = checkResume(t);
  if (!check.ok) return fail(check.error);
  t.hold = null;
  touch(t, ctx);
  log(d, ctx, "resumed this task", t);
  notify(d, ctx, t.assigneeId, "updated", t, `${nameOf(d, ctx.actorId)} resumed ${t.key}`);
  const state = getEffectiveState(t, indexTasks(d.tasks));
  return done(d, true, state === "blocked" ? `${t.key} resumed, but it is still blocked` : `${t.key} resumed`);
}

export function markBlocked(
  d0: AppData,
  ctx: OpContext,
  id: string,
  input: { reason?: string; dependencyId?: string },
): OpResult {
  const d = structuredClone(d0);
  const t = taskOf(d, id);
  if (!t) return fail("That task no longer exists.");
  const check = checkMarkBlocked(t);
  if (!check.ok) return fail(check.error);
  const reason = input.reason?.trim() ?? "";
  if (!reason && !input.dependencyId) return fail("Add a blocker reason, link a blocking task, or both.");
  if (reason.length > 500) return fail("Keep the reason under 500 characters.");

  if (input.dependencyId) {
    const dep = taskOf(d, input.dependencyId);
    if (!dep) return fail("The blocking task no longer exists.");
    if (dep.status === "done") return fail(`${dep.key} is already done, so it can't block this task.`);
    const link = checkLinkDependency(indexTasks(d.tasks), t.id, dep.id);
    if (!link.ok) return fail(link.error);
    t.blockedBy.push(dep.id);
    log(d, ctx, `is blocked by ${dep.key}: ${dep.title}`, t);
  }
  if (reason) {
    t.blocker = { reason, at: ctx.now, byId: ctx.actorId };
    log(d, ctx, `marked as blocked: ${reason}`, t);
  }
  touch(t, ctx);
  notify(d, ctx, t.assigneeId, "updated", t, `${nameOf(d, ctx.actorId)} marked ${t.key} as blocked`);
  return done(d, true, `${t.key} marked blocked`);
}

export type ResolveTarget = { kind: "manual" } | { kind: "dependency"; dependencyId: string } | { kind: "all" };

export function resolveBlocker(d0: AppData, ctx: OpContext, id: string, target: ResolveTarget): OpResult {
  const d = structuredClone(d0);
  const t = taskOf(d, id);
  if (!t) return fail("That task no longer exists.");
  const index = indexTasks(d.tasks);
  let resolved = 0;

  if (target.kind === "manual" || target.kind === "all") {
    if (t.blocker) {
      log(d, ctx, `resolved the blocker: ${t.blocker.reason}`, t);
      t.blocker = null;
      resolved++;
    } else if (target.kind === "manual") {
      return fail("There's no manual blocker to resolve.");
    }
  }
  if (target.kind === "dependency") {
    if (!t.blockedBy.includes(target.dependencyId)) return fail("That dependency isn't linked anymore.");
    const dep = index.get(target.dependencyId);
    t.blockedBy = t.blockedBy.filter((x) => x !== target.dependencyId);
    log(d, ctx, `resolved the dependency on ${dep?.key ?? "a deleted task"}`, t);
    resolved++;
  }
  if (target.kind === "all") {
    for (const dep of unresolvedDependencies(t, index)) {
      t.blockedBy = t.blockedBy.filter((x) => x !== dep.id);
      log(d, ctx, `resolved the dependency on ${dep.key}`, t);
      resolved++;
    }
  }
  if (resolved === 0) return fail(`${t.key} has nothing to resolve.`);
  touch(t, ctx);
  const still = getEffectiveState(t, indexTasks(d.tasks)) === "blocked";
  notify(d, ctx, t.assigneeId, "updated", t, `${nameOf(d, ctx.actorId)} resolved a blocker on ${t.key}`);
  return done(d, true, still ? `Resolved. ${t.key} still has another blocker.` : `${t.key} is unblocked`);
}

export function linkDependency(d0: AppData, ctx: OpContext, taskId: string, dependsOnId: string): OpResult {
  const d = structuredClone(d0);
  const check = checkLinkDependency(indexTasks(d.tasks), taskId, dependsOnId);
  if (!check.ok) return fail(check.error);
  const t = taskOf(d, taskId)!;
  const dep = taskOf(d, dependsOnId)!;
  t.blockedBy.push(dep.id);
  touch(t, ctx);
  log(d, ctx, `linked a dependency on ${dep.key}: ${dep.title}`, t);
  return done(d, true, `${t.key} now depends on ${dep.key}`);
}

export function unlinkDependency(d0: AppData, ctx: OpContext, taskId: string, dependsOnId: string): OpResult {
  const d = structuredClone(d0);
  const t = taskOf(d, taskId);
  if (!t) return fail("That task no longer exists.");
  if (!t.blockedBy.includes(dependsOnId)) return fail("That dependency isn't linked.");
  const dep = taskOf(d, dependsOnId);
  t.blockedBy = t.blockedBy.filter((x) => x !== dependsOnId);
  touch(t, ctx);
  log(d, ctx, `removed the dependency on ${dep?.key ?? "a deleted task"}`, t);
  return done(d, true, "Dependency removed");
}

/* ------------------------------ backlog ------------------------------- */

export function activateTask(d0: AppData, ctx: OpContext, id: string, status: Exclude<Status, "done"> = "todo"): OpResult {
  const d = structuredClone(d0);
  const t = taskOf(d, id);
  if (!t) return fail("That task no longer exists.");
  const check = checkActivate(t);
  if (!check.ok) return fail(check.error);
  t.stage = "active";
  t.status = status;
  for (const c of childrenOf(d, t.id)) c.stage = "active";
  touch(t, ctx);
  log(d, ctx, `moved ${t.key} from the backlog into active work (${STATUS_LABEL[status]})`, t);
  notify(d, ctx, t.assigneeId, "updated", t, `${nameOf(d, ctx.actorId)} moved ${t.key} into active work`);
  return done(d, true, `${t.key} moved into active work`);
}

export function moveToBacklog(d0: AppData, ctx: OpContext, id: string): OpResult {
  const d = structuredClone(d0);
  const t = taskOf(d, id);
  if (!t) return fail("That task no longer exists.");
  const check = checkMoveToBacklog(t);
  if (!check.ok) return fail(check.error);
  t.stage = "backlog";
  t.status = "todo";
  t.hold = null;
  t.blocker = null;
  t.completedAt = null;
  t.rank = nextRank(d);
  for (const c of childrenOf(d, t.id)) {
    c.stage = "backlog";
    c.status = "todo";
    c.completedAt = null;
  }
  touch(t, ctx);
  log(d, ctx, `moved ${t.key} back to the backlog`, t);
  return done(d, true, `${t.key} moved to the backlog`);
}

export function moveBacklogRank(d0: AppData, ctx: OpContext, id: string, direction: "up" | "down"): OpResult {
  const d = structuredClone(d0);
  const t = taskOf(d, id);
  if (!t || t.stage !== "backlog" || t.parentId) return fail("Only top-level backlog tasks can be reordered.");
  const list = d.tasks.filter((x) => x.stage === "backlog" && !x.parentId).sort((a, b) => a.rank - b.rank);
  const i = list.findIndex((x) => x.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return done(d0, false);
  const other = list[j];
  const r = t.rank;
  t.rank = other.rank;
  other.rank = r;
  touch(t, ctx);
  log(d, ctx, `moved ${t.key} ${direction} in the backlog`, t);
  return done(d, true, `${t.key} moved ${direction}`);
}

/* ----------------------------- comments ------------------------------- */

export function addComment(d0: AppData, ctx: OpContext, taskId: string, body: string): OpResult {
  const text = body.trim();
  if (!text) return fail("Write something before posting a comment.");
  if (text.length > 2000) return fail("Comments are limited to 2000 characters.");
  const d = structuredClone(d0);
  const t = taskOf(d, taskId);
  if (!t) return fail("That task no longer exists.");
  t.comments.push({ id: nextId(d, "c"), authorId: ctx.actorId, body: text, createdAt: ctx.now });
  touch(t, ctx);
  log(d, ctx, "commented", t);

  const lower = text.toLowerCase();
  const mentioned = new Set<string>();
  for (const u of d.users) {
    const first = u.name.split(" ")[0].toLowerCase();
    const full = u.name.toLowerCase().replace(/\s+/g, "");
    if (u.id !== ctx.actorId && (lower.includes(`@${first}`) || lower.includes(`@${full}`))) mentioned.add(u.id);
  }
  for (const uid of mentioned) {
    notify(d, ctx, uid, "mention", t, `${nameOf(d, ctx.actorId)} mentioned you on ${t.key}: ${text.slice(0, 80)}`);
  }
  if (t.assigneeId && !mentioned.has(t.assigneeId)) {
    notify(d, ctx, t.assigneeId, "updated", t, `${nameOf(d, ctx.actorId)} commented on ${t.key}`);
  }
  return done(d, true, "Comment posted");
}

/* ------------------------------ delete -------------------------------- */

export function deleteTask(d0: AppData, ctx: OpContext, id: string): OpResult<DeletedSnapshot> {
  const d = structuredClone(d0);
  const t = taskOf(d, id);
  if (!t) return fail("That task no longer exists.");
  const ids = new Set<string>([t.id, ...childrenOf(d, t.id).map((c) => c.id)]);
  const snapshot: DeletedSnapshot = {
    tasks: d.tasks.filter((x) => ids.has(x.id)),
    activity: d.activity.filter((a) => a.taskId && ids.has(a.taskId)),
    notifications: d.notifications.filter((n) => n.taskId && ids.has(n.taskId)),
    links: [],
  };
  d.tasks = d.tasks.filter((x) => !ids.has(x.id));
  d.activity = d.activity.filter((a) => !(a.taskId && ids.has(a.taskId)));
  d.notifications = d.notifications.filter((n) => !(n.taskId && ids.has(n.taskId)));
  for (const other of d.tasks) {
    const removed = other.blockedBy.filter((x) => ids.has(x));
    if (removed.length) {
      other.blockedBy = other.blockedBy.filter((x) => !ids.has(x));
      for (const r of removed) snapshot.links.push({ taskId: other.id, dependsOnId: r });
      log(d, ctx, `lost a dependency because ${t.key} was deleted`, other);
    }
  }
  const project = projectOf(d, t.projectId);
  if (project) project.updatedAt = ctx.now;
  return done(d, true, `Deleted ${t.key}`, snapshot);
}

export function restoreDeleted(d0: AppData, snapshot: DeletedSnapshot): OpResult {
  const d = structuredClone(d0);
  const existing = new Set(d.tasks.map((t) => t.id));
  if (snapshot.tasks.some((t) => existing.has(t.id))) return fail("That task is already back.");
  d.tasks.push(...structuredClone(snapshot.tasks));
  d.activity.push(...structuredClone(snapshot.activity));
  d.notifications.push(...structuredClone(snapshot.notifications));
  for (const l of snapshot.links) {
    const t = taskOf(d, l.taskId);
    if (t && !t.blockedBy.includes(l.dependsOnId)) t.blockedBy.push(l.dependsOnId);
  }
  return done(d, true, "Restored");
}

/* ------------------------------ projects ------------------------------ */

function makeProjectKey(d: AppData, name: string): string {
  const letters = name.replace(/[^A-Za-z ]/g, " ").trim().split(/\s+/).filter(Boolean);
  let base =
    letters.length >= 2 ? letters.slice(0, 3).map((w) => w[0]).join("") : (letters[0] ?? "PRJ").slice(0, 3);
  base = base.toUpperCase().padEnd(2, "X");
  let key = base;
  let n = 2;
  while (d.projects.some((p) => p.key === key)) key = `${base}${n++}`;
  return key;
}

function createProjectInto(d: AppData, ctx: OpContext, input: NewProjectInput): Project | string {
  const name = input.name?.trim() ?? "";
  if (!name) return "Give the project a name.";
  if (name.length > 80) return "Project names are limited to 80 characters.";
  if (!d.users.some((u) => u.id === input.ownerId)) return "Choose a project owner.";
  const dateError = validDates(input.startDate, input.targetDate);
  if (dateError) return "The target date can't be before the start date.";
  if (d.projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) return "A project with that name already exists.";
  const project: Project = {
    id: nextId(d, "p"),
    key: makeProjectKey(d, name),
    name,
    description: input.description?.trim() ?? "",
    ownerId: input.ownerId,
    status: input.status ?? "active",
    startDate: input.startDate ?? null,
    targetDate: input.targetDate ?? null,
    tint: TINTS[d.projects.length % (TINTS.length - 1)],
    nextNumber: 1,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  d.projects.push(project);
  log(d, ctx, `created project ${project.name}`, null, project.id);
  return project;
}

export function createProject(d0: AppData, ctx: OpContext, input: NewProjectInput): OpResult<string> {
  const d = structuredClone(d0);
  const res = createProjectInto(d, ctx, input);
  if (typeof res === "string") return fail(res);
  return done(d, true, `Created project ${res.name}`, res.id);
}

export function updateProject(
  d0: AppData,
  ctx: OpContext,
  id: string,
  patch: Partial<Omit<NewProjectInput, "ownerId"> & { ownerId: string }>,
): OpResult {
  const d = structuredClone(d0);
  const p = projectOf(d, id);
  if (!p) return fail("That project no longer exists.");
  const name = patch.name !== undefined ? patch.name.trim() : p.name;
  if (!name) return fail("Give the project a name.");
  if (name.length > 80) return fail("Project names are limited to 80 characters.");
  if (d.projects.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) {
    return fail("A project with that name already exists.");
  }
  const owner = patch.ownerId ?? p.ownerId;
  if (!d.users.some((u) => u.id === owner)) return fail("Choose a project owner.");
  const start = patch.startDate !== undefined ? patch.startDate : p.startDate;
  const target = patch.targetDate !== undefined ? patch.targetDate : p.targetDate;
  if (validDates(start, target)) return fail("The target date can't be before the start date.");

  const next = {
    name,
    description: patch.description !== undefined ? patch.description.trim() : p.description,
    ownerId: owner,
    status: patch.status ?? p.status,
    startDate: start,
    targetDate: target,
  };
  const changed = (Object.keys(next) as (keyof typeof next)[]).some((k) => next[k] !== p[k]);
  if (!changed) return done(d0, false);
  Object.assign(p, next);
  p.updatedAt = ctx.now;
  log(d, ctx, `updated project ${p.name}`, null, p.id);
  return done(d, true, "Project saved");
}

/* ----------------------------- templates ------------------------------ */

export function createProjectFromTemplate(
  d0: AppData,
  ctx: OpContext,
  templateId: string,
  input: { name: string; ownerId: string; startDate: string },
): OpResult<string> {
  const tpl = getTemplate(templateId);
  if (!tpl) return fail("That template no longer exists.");
  const d = structuredClone(d0);
  const project = createProjectInto(d, ctx, {
    name: input.name,
    description: tpl.project.description,
    ownerId: input.ownerId,
    status: "planned",
    startDate: input.startDate,
    targetDate: addDays(input.startDate, tpl.project.durationDays),
  });
  if (typeof project === "string") return fail(project);

  const refs = new Map<string, string>();
  for (const item of tpl.items) {
    const created = createInto(d, ctx, {
      title: item.title,
      description: item.description,
      projectId: project.id,
      priority: item.priority,
      labels: item.labels,
      startDate: input.startDate,
      dueDate: addDays(input.startDate, item.dueOffset),
      subtasks: item.subtasks,
      blockedBy: (item.dependsOn ?? []).map((r) => refs.get(r)).filter((x): x is string => !!x),
    });
    if (typeof created === "string") return fail(created);
    refs.set(item.ref, created.id);
  }
  return done(d, true, `Created ${project.name} with ${tpl.items.length} tasks`, project.id);
}

export function createTaskFromTemplate(
  d0: AppData,
  ctx: OpContext,
  templateId: string,
  input: { projectId: string; dueDate?: string | null },
): OpResult<string> {
  const tpl = getTemplate(templateId);
  if (!tpl) return fail("That template no longer exists.");
  return createTask(d0, ctx, {
    title: tpl.task.title,
    description: tpl.task.description,
    projectId: input.projectId,
    priority: tpl.task.priority,
    labels: tpl.task.labels,
    dueDate: input.dueDate ?? null,
    subtasks: tpl.task.subtasks,
  });
}

/* --------------------------- notifications ---------------------------- */

export function markNotificationRead(d0: AppData, id: string): OpResult {
  const n = d0.notifications.find((x) => x.id === id);
  if (!n) return fail("That notification no longer exists.");
  if (n.read) return done(d0, false);
  const d = structuredClone(d0);
  d.notifications.find((x) => x.id === id)!.read = true;
  return done(d, true);
}

export function markAllNotificationsRead(d0: AppData, userId: string): OpResult {
  if (!d0.notifications.some((n) => n.userId === userId && !n.read)) return done(d0, false);
  const d = structuredClone(d0);
  for (const n of d.notifications) if (n.userId === userId) n.read = true;
  return done(d, true, "All caught up");
}

/** Adds one notification for each of the user's tasks that are due within two days. Idempotent. */
export function syncDeadlineNotifications(d0: AppData, ctx: OpContext, today: string): OpResult {
  const d = structuredClone(d0);
  let added = 0;
  const index = indexTasks(d.tasks);
  for (const t of d.tasks) {
    if (t.parentId || !t.dueDate || !t.assigneeId) continue;
    if (getEffectiveState(t, index) === "done" || t.stage === "backlog" || t.hold) continue;
    const delta = diffDays(t.dueDate, today);
    if (delta < 0 || delta > 2) continue;
    const id = `n-deadline-${t.id}-${t.dueDate}`;
    if (d.notifications.some((n) => n.id === id)) continue;
    const when = delta === 0 ? "today" : delta === 1 ? "tomorrow" : `on ${formatDate(t.dueDate)}`;
    notify(d, ctx, t.assigneeId, "deadline", t, `${t.key} is due ${when}: ${t.title}`, { id, allowSelf: true });
    added++;
  }
  return added ? done(d, true) : done(d0, false);
}

/**
 * Prototype helper: makes a teammate perform a REAL change so the resulting
 * notification, activity entry and data are all consistent. Nothing here is faked.
 */
export type SimulatedEvent = "assigned" | "mention" | "updated" | "deadline";

export function simulateTeammateEvent(d0: AppData, ctx: OpContext, kind: SimulatedEvent, today: string): OpResult {
  const me = ctx.actorId;
  const teammates = d0.users.filter((u) => u.id !== me);
  if (teammates.length === 0) return fail("There are no teammates to simulate.");
  const teammate = teammates[d0.seq % teammates.length];
  const theirs: OpContext = { actorId: teammate.id, now: ctx.now };
  const index = indexTasks(d0.tasks);
  const open = d0.tasks.filter((t) => !t.parentId && t.stage === "active" && t.status !== "done");

  if (kind === "assigned") {
    const pick = open.find((t) => !t.assigneeId) ?? open.find((t) => t.assigneeId !== me);
    if (!pick) return fail("There's no task available to assign.");
    return updateTask(d0, theirs, pick.id, { assigneeId: me });
  }
  if (kind === "mention") {
    const pick = open.find((t) => t.assigneeId === me) ?? open[0];
    if (!pick) return fail("There's no task to comment on.");
    const first = d0.users.find((u) => u.id === me)?.name.split(" ")[0] ?? "there";
    return addComment(d0, theirs, pick.id, `@${first} can you take a look at this before the next check-in?`);
  }
  if (kind === "updated") {
    const pick = open.find((t) => t.assigneeId === me && t.status === "todo" && getEffectiveState(t, index) === "active");
    if (pick) return setStatus(d0, theirs, pick.id, "in_progress");
    const any = open.find((t) => t.assigneeId === me && t.priority !== "urgent");
    if (!any) return fail("None of your tasks can be updated right now.");
    return updateTask(d0, theirs, any.id, { priority: "high" });
  }
  // deadline: pull one of my tasks forward, then let the deadline sync notice it
  const pick = open.find((t) => t.assigneeId === me && (!t.dueDate || diffDays(t.dueDate, today) > 2) && !t.hold);
  if (!pick) return fail("None of your tasks can be pulled forward right now.");
  const moved = updateTask(d0, ctx, pick.id, { dueDate: addDays(today, 1) });
  if (!moved.ok) return moved;
  const synced = syncDeadlineNotifications(moved.data, ctx, today);
  return synced.ok ? done(synced.data, true, `Pulled ${pick.key} forward to tomorrow`) : synced;
}

