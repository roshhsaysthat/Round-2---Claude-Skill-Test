"use client";

import { LinkBreak } from "@phosphor-icons/react";
import { IconButton } from "@/components/ui/button";
import { StateBadge, StatusBadge } from "@/components/ui/badges";
import { requestOpenTask, useApp } from "@/lib/app-context";
import { getEffectiveState, linkableTasks } from "@/lib/lifecycle";
import { blockingTasks } from "@/lib/selectors";
import type { Task } from "@/lib/types";
import { TaskPicker } from "./pickers";

function Row({ task, onUnlink }: { task: Task; onUnlink?: () => void }) {
  const { index } = useApp();
  const state = getEffectiveState(task, index);
  return (
    <li className="flex items-center gap-2 border-b border-line py-1.5 last:border-b-0">
      <button
        type="button"
        onClick={() => requestOpenTask(task.id)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1 text-left text-sm hover:underline"
      >
        <span className="shrink-0 text-xs tabular-nums text-muted">{task.key}</span>
        <span className="truncate">{task.title}</span>
      </button>
      {state === "done" || state === "backlog" ? <StateBadge state={state} /> : <StatusBadge status={task.status} />}
      {onUnlink ? (
        <IconButton aria-label={`Remove dependency on ${task.key}`} size="sm" onClick={onUnlink}>
          <LinkBreak />
        </IconButton>
      ) : null}
    </li>
  );
}

/**
 * Both sides of the dependency relationship. "Blocked by" is editable; "Blocking" is derived
 * from other tasks' links, so there is a single record of each relationship.
 */
export function DependencyList({ task }: { task: Task }) {
  const { data, index, actions } = useApp();
  const blockedBy = task.blockedBy.map((id) => index.get(id)).filter((t): t is Task => !!t);
  const blocking = blockingTasks(data.tasks, task.id);
  const candidates = linkableTasks(index, task.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h4 className="mb-1 font-sans text-[13px] font-medium tracking-normal">Blocked by</h4>
        {blockedBy.length ? (
          <ul>
            {blockedBy.map((t) => (
              <Row key={t.id} task={t} onUnlink={() => actions.unlinkDependency(task.id, t.id)} />
            ))}
          </ul>
        ) : (
          <p className="mb-1 text-sm text-muted">This task doesn&apos;t depend on anything.</p>
        )}
        <div className="mt-2">
          <TaskPicker candidates={candidates} onPick={(t) => actions.linkDependency(task.id, t.id)} />
        </div>
      </div>
      <div>
        <h4 className="mb-1 font-sans text-[13px] font-medium tracking-normal">Blocking</h4>
        {blocking.length ? (
          <ul>
            {blocking.map((t) => (
              <Row key={t.id} task={t} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No other task is waiting on this one.</p>
        )}
      </div>
    </div>
  );
}
