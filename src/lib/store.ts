/**
 * The single source of truth. One AppData record, one store.
 *
 * - Every action goes through a domain operation (domain.ts), which validates and
 *   returns an ok/err result. Only ok results are committed, so the UI can't show
 *   success for something that didn't happen.
 * - Persistence is behind PersistenceAdapter (storage.ts).
 * - Exposed as an external store so React reads it with useSyncExternalStore:
 *   the server and first hydration render see `null` (loading), so there is no
 *   hydration mismatch even though the data comes from localStorage.
 */
import * as domain from "./domain";
import { indexTasks, type TaskIndex } from "./lifecycle";
import { buildSeed } from "./seed";
import { localStorageAdapter, type PersistenceAdapter } from "./storage";
import type {
  AppData,
  CreateStatusChoice,
  DeletedSnapshot,
  NewProjectInput,
  NewTaskInput,
  OpContext,
  OpOk,
  OpResult,
  Status,
  TaskPatch,
} from "./types";
import { todayStr } from "./utils";

export interface Snapshot {
  data: AppData;
  index: TaskIndex;
  today: string;
  now: string;
  /** Present when saved data couldn't be used and demo data was loaded instead. */
  loadError?: string;
}

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
  action?: { label: string; run: () => void };
}

const adapter: PersistenceAdapter = localStorageAdapter;

/** Opens the task detail drawer from anywhere, including toast actions that live outside React. */
export const OPEN_TASK_EVENT = "taskflow:open-task";
export function requestOpenTask(taskId: string): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<string>(OPEN_TASK_EVENT, { detail: taskId }));
}

/* ------------------------------ core store ------------------------------ */

let snapshot: Snapshot | null = null;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function emit(): void {
  for (const l of listeners) l();
}

function makeSnapshot(data: AppData, loadError?: string): Snapshot {
  const nowDate = new Date();
  return { data, index: indexTasks(data.tasks), today: todayStr(nowDate), now: nowDate.toISOString(), loadError };
}

function ctxFor(s: Snapshot): OpContext {
  return { actorId: s.data.currentUserId, now: new Date().toISOString() };
}

function withDeadlines(data: AppData, today: string): AppData {
  const res = domain.syncDeadlineNotifications(data, { actorId: data.currentUserId, now: new Date().toISOString() }, today);
  return res.ok && res.changed ? res.data : data;
}

function load(): Snapshot {
  const res = adapter.load();
  const nowDate = new Date();
  const today = todayStr(nowDate);
  const base = res.data ?? buildSeed(today, nowDate.toISOString());
  const data = withDeadlines(base, today);
  const s = makeSnapshot(data, res.error);
  if (!res.data) adapter.save(data);
  return s;
}

function ensure(): Snapshot {
  if (!snapshot) snapshot = load();
  return snapshot;
}

function persist(data: AppData): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => adapter.save(data), 120);
}

function commit(data: AppData): void {
  const s = ensure();
  const next = makeSnapshot(data, s.loadError);
  const synced = withDeadlines(data, next.today);
  snapshot = synced === data ? next : makeSnapshot(synced, s.loadError);
  persist(snapshot.data);
  emit();
}

export const store = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): Snapshot | null {
    if (typeof window === "undefined") return null;
    return ensure();
  },
  getServerSnapshot(): Snapshot | null {
    return null;
  },
};

/** Advance the clock (relative times, overdue status past midnight). */
export function tick(): void {
  if (!snapshot) return;
  const dayChanged = todayStr() !== snapshot.today;
  if (dayChanged) commit(snapshot.data);
  else {
    snapshot = { ...snapshot, now: new Date().toISOString() };
    emit();
  }
}

/** Pick up changes made in another tab. */
export function reloadFromStorage(): void {
  const res = adapter.load();
  if (!res.data) return;
  snapshot = makeSnapshot(res.data);
  emit();
}

/* ------------------------------- toasts -------------------------------- */

let toasts: Toast[] = [];
let toastSeq = 0;
const toastListeners = new Set<() => void>();

export const toastStore = {
  subscribe(l: () => void): () => void {
    toastListeners.add(l);
    return () => toastListeners.delete(l);
  },
  getSnapshot(): Toast[] {
    return toasts;
  },
  getServerSnapshot(): Toast[] {
    return [];
  },
};

function emitToasts(): void {
  for (const l of toastListeners) l();
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emitToasts();
}

export function pushToast(t: Omit<Toast, "id">): void {
  const id = ++toastSeq;
  // Replace an identical visible message instead of stacking duplicates.
  toasts = [...toasts.filter((x) => x.text !== t.text), { ...t, id }].slice(-4);
  emitToasts();
  const ttl = t.kind === "error" ? 9000 : t.action ? 9000 : 4200;
  setTimeout(() => dismissToast(id), ttl);
}

/* ------------------------------- actions -------------------------------- */

interface RunOptions<T> {
  silent?: boolean;
  message?: (r: OpOk<T>) => string | undefined;
  action?: (r: OpOk<T>) => Toast["action"];
}

function run<T>(op: (d: AppData, ctx: OpContext) => OpResult<T>, opts: RunOptions<T> = {}): OpResult<T> {
  const s = ensure();
  const result = op(s.data, ctxFor(s));
  if (!result.ok) {
    pushToast({ kind: "error", text: result.error });
    return result;
  }
  if (result.changed) {
    commit(result.data);
    if (!opts.silent) {
      const text = opts.message ? opts.message(result) : result.message;
      if (text) pushToast({ kind: "success", text, action: opts.action?.(result) });
    }
  }
  return result;
}

function keyOf(id: string): string {
  return ensure().data.tasks.find((t) => t.id === id)?.key ?? "Task";
}

export const actions = {
  createTask: (input: NewTaskInput) =>
    run((d, c) => domain.createTask(d, c, input), {
      action: (r) => ({ label: "Open", run: () => requestOpenTask(r.value as string) }),
    }),
  addSubtask: (parentId: string, title: string) =>
    run((d, c) => domain.addSubtask(d, c, parentId, title), { message: () => "Subtask added" }),
  duplicateTask: (id: string) =>
    run((d, c) => domain.duplicateTask(d, c, id), {
      action: (r) => ({ label: "Open", run: () => requestOpenTask(r.value as string) }),
    }),
  updateTask: (id: string, patch: TaskPatch) =>
    run((d, c) => domain.updateTask(d, c, id, patch), { message: () => `${keyOf(id)} updated` }),
  setStatus: (id: string, to: Status) => run((d, c) => domain.setStatus(d, c, id, to)),
  holdTask: (id: string, reason: string) => run((d, c) => domain.holdTask(d, c, id, reason)),
  resumeTask: (id: string) => run((d, c) => domain.resumeTask(d, c, id)),
  markBlocked: (id: string, input: { reason?: string; dependencyId?: string }) =>
    run((d, c) => domain.markBlocked(d, c, id, input)),
  resolveBlocker: (id: string, target: domain.ResolveTarget) => run((d, c) => domain.resolveBlocker(d, c, id, target)),
  linkDependency: (id: string, dependsOnId: string) => run((d, c) => domain.linkDependency(d, c, id, dependsOnId)),
  unlinkDependency: (id: string, dependsOnId: string) =>
    run((d, c) => domain.unlinkDependency(d, c, id, dependsOnId)),
  activateTask: (id: string, status: Exclude<Status, "done"> = "todo") =>
    run((d, c) => domain.activateTask(d, c, id, status)),
  moveToBacklog: (id: string) => run((d, c) => domain.moveToBacklog(d, c, id)),
  moveBacklogRank: (id: string, dir: "up" | "down") =>
    run((d, c) => domain.moveBacklogRank(d, c, id, dir), { silent: true }),
  addComment: (id: string, body: string) => run((d, c) => domain.addComment(d, c, id, body)),
  deleteTask: (id: string) =>
    run<DeletedSnapshot>((d, c) => domain.deleteTask(d, c, id), {
      action: (r) => ({
        label: "Undo",
        run: () => {
          if (r.value) run((d) => domain.restoreDeleted(d, r.value as DeletedSnapshot), { message: () => "Task restored" });
        },
      }),
    }),
  createProject: (input: NewProjectInput) => run((d, c) => domain.createProject(d, c, input)),
  updateProject: (id: string, patch: Parameters<typeof domain.updateProject>[3]) =>
    run((d, c) => domain.updateProject(d, c, id, patch)),
  createProjectFromTemplate: (templateId: string, input: { name: string; ownerId: string; startDate: string }) =>
    run((d, c) => domain.createProjectFromTemplate(d, c, templateId, input)),
  createTaskFromTemplate: (templateId: string, input: { projectId: string; dueDate?: string | null }) =>
    run((d, c) => domain.createTaskFromTemplate(d, c, templateId, input)),
  markNotificationRead: (id: string) => run((d) => domain.markNotificationRead(d, id), { silent: true }),
  markAllNotificationsRead: () => run((d) => domain.markAllNotificationsRead(d, d.currentUserId)),
  simulate: (kind: domain.SimulatedEvent) =>
    run((d, c) => domain.simulateTeammateEvent(d, c, kind, todayStr()), {
      message: (r) => (r.message ? `Simulated: ${r.message}` : "Simulated teammate activity"),
    }),
  switchUser: (userId: string) => {
    const s = ensure();
    const user = s.data.users.find((u) => u.id === userId);
    if (!user) {
      pushToast({ kind: "error", text: "That user no longer exists." });
      return;
    }
    if (user.id === s.data.currentUserId) return;
    commit({ ...s.data, currentUserId: userId });
    pushToast({ kind: "info", text: `Now viewing as ${user.name}` });
  },
  resetDemoData: () => {
    adapter.clear();
    const nowDate = new Date();
    const today = todayStr(nowDate);
    const data = withDeadlines(buildSeed(today, nowDate.toISOString()), today);
    snapshot = makeSnapshot(data);
    adapter.save(data);
    emit();
    pushToast({ kind: "success", text: "Demo data reset" });
  },
};

export type { CreateStatusChoice };
