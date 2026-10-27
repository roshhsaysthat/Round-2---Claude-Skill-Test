"use client";

import { ListChecks, Prohibit } from "@phosphor-icons/react";
import { useApp } from "@/lib/app-context";
import { getEffectiveState, unresolvedDependencies } from "@/lib/lifecycle";
import { blockingTasks, subtaskProgress } from "@/lib/selectors";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DependencyChip, StateBadge } from "@/components/ui/badges";

/** Plain-language list of why a task is blocked. Shared by cards, lists and the detail panel. */
export function useBlockerSummary(task: Task): string[] {
  const { index } = useApp();
  const out: string[] = [];
  if (task.blocker) out.push(task.blocker.reason);
  for (const dep of unresolvedDependencies(task, index)) out.push(`Waiting on ${dep.key}: ${dep.title}`);
  return out;
}

/** Subtask completion, shown as "2/5" with an icon. Renders nothing when there are no subtasks. */
export function SubtaskIndicator({ task, className }: { task: Task; className?: string }) {
  const { data } = useApp();
  const { done, total } = subtaskProgress(data.tasks, task.id);
  if (total === 0) return null;
  return (
    <span
      title={`${done} of ${total} subtasks done`}
      className={cn("inline-flex items-center gap-1 text-xs", done === total ? "text-success" : "text-muted", className)}
    >
      <ListChecks size={14} />
      <span className="tabular-nums">
        {done}/{total}
      </span>
      <span className="sr-only">subtasks done</span>
    </span>
  );
}

/** Blocked tag (with reason on hover) plus "Blocks N" when other open tasks wait on this one. */
export function DependencyIndicator({ task, showBadge = true }: { task: Task; showBadge?: boolean }) {
  const { data, index } = useApp();
  const reasons = useBlockerSummary(task);
  const state = getEffectiveState(task, index);
  const blocks = blockingTasks(data.tasks, task.id).filter((t) => t.status !== "done" && t.stage === "active").length;
  if (state !== "blocked" && blocks === 0) return null;
  return (
    <>
      {state === "blocked" && showBadge ? (
        <span title={reasons.join("\n")} className="inline-flex">
          <StateBadge state="blocked" />
        </span>
      ) : null}
      {blocks > 0 ? (
        <DependencyChip title={`${blocks} open ${blocks === 1 ? "task is" : "tasks are"} waiting on this one`}>
          Blocks {blocks}
        </DependencyChip>
      ) : null}
    </>
  );
}

export function BlockedInline({ task }: { task: Task }) {
  const { index } = useApp();
  const reasons = useBlockerSummary(task);
  if (getEffectiveState(task, index) !== "blocked") return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-xs text-signal">
      <Prohibit size={13} weight="bold" className="shrink-0" />
      <span className="truncate">{reasons[0]}</span>
    </span>
  );
}
