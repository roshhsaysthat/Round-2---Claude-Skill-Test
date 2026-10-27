/**
 * Shared data model for the whole app. One Task record type is used by every
 * view (Home, Kanban, List, Backlog, Projects, Search, Notifications).
 *
 * LIFECYCLE MODEL (see lifecycle.ts for the rules that enforce it)
 * ----------------------------------------------------------------
 * Four independent dimensions, so states cannot be confused:
 *
 *  1. status  : workflow position. todo | in_progress | in_review | done
 *  2. stage   : planning state. "backlog" (unplanned) or "active" (in play).
 *               Backlog is NOT a workflow status. A backlog task always has
 *               status "todo" and is simply not in active work yet.
 *  3. hold    : deliberate pause. Null or { reason }. Independent of status.
 *  4. blockers: an impediment. Either a manual `blocker` (external reason) and/or
 *               `blockedBy` task links. A link only blocks while the task it
 *               points at is not done, so it resolves itself automatically.
 *
 * `getEffectiveState` (lifecycle.ts) collapses these to exactly one display
 * state with a fixed precedence: backlog > done > on_hold > blocked > active.
 * That is what prevents "Done and blocked" or "On hold and blocked" from ever
 * being displayed at once.
 */

export type Status = "todo" | "in_progress" | "in_review" | "done";
export type Stage = "backlog" | "active";
export type Priority = "urgent" | "high" | "medium" | "low" | "none";
export type EffectiveState = "backlog" | "done" | "on_hold" | "blocked" | "active";

export type Tint = "sky" | "ice" | "stone" | "cream" | "sage" | "peach" | "butter" | "lilac";

export interface User {
  id: string;
  name: string;
  role: string;
  team: string;
}

export interface Hold {
  reason: string;
  at: string;
  byId: string;
}

export interface Blocker {
  reason: string;
  at: string;
  byId: string;
}

export interface Comment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Task {
  id: string;
  key: string;
  number: number;
  title: string;
  description: string;
  status: Status;
  stage: Stage;
  priority: Priority;
  assigneeId: string | null;
  reporterId: string;
  projectId: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  startDate: string | null;
  dueDate: string | null;
  /** Subtasks are real task records pointing at their parent. One level deep. */
  parentId: string | null;
  /** Ids of tasks that must be done before this one can proceed. */
  blockedBy: string[];
  hold: Hold | null;
  blocker: Blocker | null;
  comments: Comment[];
  /** Ordering within the backlog (lower first). */
  rank: number;
}

export type ProjectStatus = "planned" | "active" | "paused" | "completed";

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  ownerId: string;
  status: ProjectStatus;
  startDate: string | null;
  targetDate: string | null;
  tint: Tint;
  nextNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEvent {
  id: string;
  taskId: string | null;
  projectId: string | null;
  actorId: string;
  at: string;
  text: string;
}

export type NotificationType = "assigned" | "mention" | "updated" | "deadline";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  taskId: string | null;
  actorId: string | null;
  text: string;
  at: string;
  read: boolean;
}

export interface AppData {
  version: number;
  seq: number;
  currentUserId: string;
  users: User[];
  projects: Project[];
  tasks: Task[];
  activity: ActivityEvent[];
  notifications: AppNotification[];
}

/* ------------------------------ Results ------------------------------ */

export type OpOk<T = undefined> = {
  ok: true;
  data: AppData;
  /** False when the request was valid but nothing needed to change. */
  changed: boolean;
  message?: string;
  value?: T;
};
export type OpErr = { ok: false; error: string };
export type OpResult<T = undefined> = OpOk<T> | OpErr;

export interface OpContext {
  actorId: string;
  /** ISO timestamp. Injected so domain functions stay pure and testable. */
  now: string;
}

/* ----------------------------- Inputs -------------------------------- */

export type CreateStatusChoice = "backlog" | "todo" | "in_progress" | "in_review";

export interface NewTaskInput {
  title: string;
  description?: string;
  projectId: string;
  assigneeId?: string | null;
  reporterId?: string;
  priority?: Priority;
  status?: CreateStatusChoice;
  startDate?: string | null;
  dueDate?: string | null;
  labels?: string[];
  blockedBy?: string[];
  subtasks?: string[];
  parentId?: string | null;
}

export type TaskPatch = Partial<
  Pick<
    Task,
    "title" | "description" | "priority" | "assigneeId" | "reporterId" | "projectId" | "labels" | "startDate" | "dueDate"
  >
>;

export interface NewProjectInput {
  name: string;
  description?: string;
  ownerId: string;
  status?: ProjectStatus;
  startDate?: string | null;
  targetDate?: string | null;
}

export interface DeletedSnapshot {
  tasks: Task[];
  activity: ActivityEvent[];
  notifications: AppNotification[];
  /** Links removed from surviving tasks so they can be restored on undo. */
  links: { taskId: string; dependsOnId: string }[];
}

export interface TaskFilters {
  q?: string;
  projectId?: string;
  priority?: Priority | "";
  assigneeId?: string | "unassigned" | "";
  status?: Status | "backlog" | "";
  due?: "" | "overdue" | "upcoming" | "none";
  label?: string;
}
