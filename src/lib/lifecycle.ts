/**
 * Centralized lifecycle rules. UI code must NOT compare raw status/stage/hold
 * fields to decide what a task "is" or what can happen to it. Ask this module.
 *
 * Display-state precedence (exactly one wins):
 *   backlog  : stage is "backlog". Never shown as blocked or on hold.
 *   done     : status is "done". Done work is never displayed as blocked or paused.
 *   on_hold  : deliberately paused. Beats blocked, because the pause was a decision.
 *   blocked  : manual blocker reason and/or an unfinished dependency.
 *   active   : everything else in play.
 */
import type { EffectiveState, Task } from "./types";

export type TaskIndex = Map<string, Task>;

export function indexTasks(tasks: Task[]): TaskIndex {
  return new Map(tasks.map((t) => [t.id, t]));
}

/** Linked tasks that still need to finish before this one can proceed. */
export function unresolvedDependencies(task: Task, index: TaskIndex): Task[] {
  const out: Task[] = [];
  for (const id of task.blockedBy) {
    const dep = index.get(id);
    if (dep && dep.status !== "done") out.push(dep);
  }
  return out;
}

export function hasImpediment(task: Task, index: TaskIndex): boolean {
  return task.blocker !== null || unresolvedDependencies(task, index).length > 0;
}

export function getEffectiveState(task: Task, index: TaskIndex): EffectiveState {
  if (task.stage === "backlog") return "backlog";
  if (task.status === "done") return "done";
  if (task.hold) return "on_hold";
  if (hasImpediment(task, index)) return "blocked";
  return "active";
}

/** Tasks that live in the Kanban board and the List (everything in play except paused work). */
export function isInFlow(task: Task, index: TaskIndex): boolean {
  const s = getEffectiveState(task, index);
  return s === "active" || s === "blocked" || s === "done";
}

/** "Open" work: not done, not backlog. Includes paused and blocked. */
export function isOpenWork(task: Task): boolean {
  return task.stage === "active" && task.status !== "done";
}

export type Check = { ok: true } | { ok: false; error: string };
const yes: Check = { ok: true };
const no = (error: string): Check => ({ ok: false, error });

export function checkStatusChange(task: Task, to: Task["status"], index: TaskIndex): Check {
  if (task.stage === "backlog") {
    return no(`${task.key} is in the backlog. Move it into active work before changing its status.`);
  }
  if (to === "done" && getEffectiveState(task, index) === "blocked") {
    return no(`${task.key} is blocked. Resolve its blocker before marking it done.`);
  }
  return yes;
}

export function checkHold(task: Task): Check {
  if (task.stage === "backlog") return no("Backlog tasks can't be put on hold. They aren't in active work yet.");
  if (task.status === "done") return no("Done tasks can't be put on hold.");
  if (task.hold) return no(`${task.key} is already on hold.`);
  if (task.blocker) return no(`${task.key} has a blocker. Resolve it before pausing the task.`);
  return yes;
}

export function checkResume(task: Task): Check {
  return task.hold ? yes : no(`${task.key} isn't on hold.`);
}

export function checkMarkBlocked(task: Task): Check {
  if (task.stage === "backlog") return no("Backlog tasks can't be blocked. Move it into active work first.");
  if (task.status === "done") return no("Done tasks can't be blocked. Reopen it first.");
  if (task.hold) return no(`${task.key} is on hold. Resume it before marking it blocked.`);
  return yes;
}

export function checkMoveToBacklog(task: Task): Check {
  if (task.stage === "backlog") return no(`${task.key} is already in the backlog.`);
  if (task.status === "done") return no("Done tasks can't go back to the backlog. Reopen it first.");
  if (task.parentId) return no("Subtasks follow their parent task.");
  return yes;
}

export function checkActivate(task: Task): Check {
  if (task.stage === "active") return no(`${task.key} is already in active work.`);
  if (task.parentId) return no("Subtasks follow their parent task.");
  return yes;
}

/** True when `from` (transitively) depends on `target`. */
export function dependsOn(index: TaskIndex, from: string, target: string, seen = new Set<string>()): boolean {
  if (from === target) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  const t = index.get(from);
  if (!t) return false;
  return t.blockedBy.some((id) => dependsOn(index, id, target, seen));
}

export function checkLinkDependency(index: TaskIndex, taskId: string, dependsOnId: string): Check {
  const task = index.get(taskId);
  const dep = index.get(dependsOnId);
  if (!task || !dep) return no("That task no longer exists.");
  if (taskId === dependsOnId) return no("A task can't depend on itself.");
  if (task.blockedBy.includes(dependsOnId)) return no(`${task.key} already depends on ${dep.key}.`);
  if (task.parentId === dep.id || dep.parentId === task.id) {
    return no("A task can't depend on its own parent or subtask.");
  }
  if (dependsOn(index, dependsOnId, taskId)) {
    return no(`${dep.key} already depends on ${task.key}. Linking them would create a circular dependency.`);
  }
  return yes;
}

/** Tasks a given task could still be linked to (for pickers). */
export function linkableTasks(index: TaskIndex, taskId: string): Task[] {
  const out: Task[] = [];
  for (const t of index.values()) {
    if (t.parentId) continue;
    if (t.status === "done") continue;
    if (checkLinkDependency(index, taskId, t.id).ok) out.push(t);
  }
  return out;
}
