"use client";

import { Pause, Play, Prohibit, X } from "@phosphor-icons/react";
import { useState } from "react";
import { AssigneeAvatar } from "@/components/ui/avatar";
import { DueDate, ProjectBadge, StateBadge, StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/fields";
import { useApp } from "@/lib/app-context";
import {
  checkHold,
  checkMarkBlocked,
  getEffectiveState,
  linkableTasks,
  unresolvedDependencies,
} from "@/lib/lifecycle";
import type { Task } from "@/lib/types";
import { formatRelative } from "@/lib/utils";
import { TaskPicker } from "./pickers";

/* ----------------------------- Hold ----------------------------- */

export function HoldNotice({ task, onOpen }: { task: Task; onOpen?: (t: Task) => void }) {
  const { actions, data, now } = useApp();
  if (!task.hold) return null;
  const by = data.users.find((u) => u.id === task.hold?.byId)?.name ?? "Someone";
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-butter px-4 py-3">
      <div className="min-w-0 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          <Pause size={15} weight="fill" aria-hidden /> On hold
        </p>
        <p className="mt-0.5">{task.hold.reason || "No reason was given."}</p>
        <p className="mt-1 text-xs text-ink/70">
          Paused {formatRelative(task.hold.at, now)} by {by}. Work is deliberately paused, not blocked.
        </p>
      </div>
      <div className="flex gap-2">
        {onOpen ? (
          <Button size="sm" variant="secondary" onClick={() => onOpen(task)}>
            Open
          </Button>
        ) : null}
        <Button size="sm" variant="primary" icon={<Play size={14} weight="fill" />} onClick={() => actions.resumeTask(task.id)}>
          Resume
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------- Blockers ---------------------------- */

/** Every open impediment on a task with its own Resolve button. Shared by the drawer and the Blocked tab. */
export function BlockerList({ task }: { task: Task }) {
  const { actions, index, data, now } = useApp();
  const deps = unresolvedDependencies(task, index);
  const count = deps.length + (task.blocker ? 1 : 0);
  if (count === 0) return null;
  const by = task.blocker ? data.users.find((u) => u.id === task.blocker?.byId)?.name : undefined;

  return (
    <div className="rounded-lg bg-peach/50 p-3">
      <ul className="flex flex-col gap-2">
        {task.blocker ? (
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface px-3 py-2">
            <div className="min-w-0 text-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-signal">
                <Prohibit size={13} weight="bold" aria-hidden /> External blocker
              </p>
              <p>{task.blocker.reason}</p>
              <p className="text-xs text-muted">
                Reported {formatRelative(task.blocker.at, now)}
                {by ? ` by ${by}` : ""}
              </p>
            </div>
            <Button size="sm" onClick={() => actions.resolveBlocker(task.id, { kind: "manual" })}>
              Resolve
            </Button>
          </li>
        ) : null}
        {deps.map((dep) => (
          <li key={dep.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface px-3 py-2">
            <div className="min-w-0 text-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-signal">
                <Prohibit size={13} weight="bold" aria-hidden /> Waiting on a task
              </p>
              <p className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-xs tabular-nums text-muted">{dep.key}</span>
                <span className="truncate">{dep.title}</span>
                <StatusBadge status={dep.status} />
              </p>
            </div>
            <Button size="sm" onClick={() => actions.resolveBlocker(task.id, { kind: "dependency", dependencyId: dep.id })}>
              Resolve
            </Button>
          </li>
        ))}
      </ul>
      {count > 1 ? (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="primary" onClick={() => actions.resolveBlocker(task.id, { kind: "all" })}>
            Resolve all and resume work
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------- Hold / block forms ------------------------- */

/** Inline (non-modal) forms for pausing or blocking a task, so dialogs never stack on the drawer. */
export function StateActions({ task }: { task: Task }) {
  const { actions, index } = useApp();
  const [mode, setMode] = useState<"hold" | "block" | null>(null);
  const [reason, setReason] = useState("");
  const [dependencyId, setDependencyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canHold = checkHold(task);
  const canBlock = checkMarkBlocked(task);
  const state = getEffectiveState(task, index);
  if (state === "done" || state === "backlog") return null;

  const reset = (): void => {
    setMode(null);
    setReason("");
    setDependencyId(null);
    setError(null);
  };
  const dep = dependencyId ? index.get(dependencyId) : undefined;

  if (mode === "hold") {
    return (
      <form
        className="flex flex-col gap-3 rounded-lg border border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const res = actions.holdTask(task.id, reason);
          if (res.ok) reset();
        }}
      >
        <Field label="Why is this being paused?" hint="Optional. Visible to everyone on the task.">
          {(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus placeholder="Waiting on a decision, out of scope this sprint..." />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={reset}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" icon={<Pause size={14} weight="fill" />}>
            Put on hold
          </Button>
        </div>
      </form>
    );
  }

  if (mode === "block") {
    const candidates = linkableTasks(index, task.id);
    return (
      <form
        className="flex flex-col gap-3 rounded-lg border border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!reason.trim() && !dependencyId) {
            setError("Add a reason, link a blocking task, or both.");
            return;
          }
          const res = actions.markBlocked(task.id, { reason, dependencyId: dependencyId ?? undefined });
          if (res.ok) reset();
        }}
      >
        <Field label="What is blocking this task?" error={error} hint="Use a reason for outside impediments. Link a task when another task must finish first.">
          {(p) => (
            <Textarea
              {...p}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
              maxLength={500}
              autoFocus
              className="min-h-16"
              placeholder="Waiting for legal review, vendor hasn't replied..."
            />
          )}
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          {dep ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-sunken py-1 pl-3 pr-1 text-[13px]">
              <span className="tabular-nums text-muted">{dep.key}</span>
              <span className="max-w-48 truncate">{dep.title}</span>
              <button
                type="button"
                aria-label={`Remove link to ${dep.key}`}
                onClick={() => setDependencyId(null)}
                className="inline-flex size-6 items-center justify-center rounded-pill hover:bg-line"
              >
                <X size={12} />
              </button>
            </span>
          ) : null}
          <TaskPicker
            candidates={candidates}
            triggerLabel={dep ? "Change blocking task" : "Link a blocking task"}
            label="Choose the blocking task"
            onPick={(t) => {
              setDependencyId(t.id);
              setError(null);
            }}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={reset}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" icon={<Prohibit size={14} weight="bold" />}>
            Mark blocked
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canHold.ok ? (
        <Button size="sm" icon={<Pause size={14} />} onClick={() => setMode("hold")}>
          Put on hold
        </Button>
      ) : null}
      {canBlock.ok ? (
        <Button size="sm" icon={<Prohibit size={14} />} onClick={() => setMode("block")}>
          {task.blocker || unresolvedDependencies(task, index).length ? "Add another blocker" : "Mark blocked"}
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------- My Tasks: On hold / Blocked ------------------------- */

function RowHeader({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { data, today, index } = useApp();
  const assignee = data.users.find((u) => u.id === task.assigneeId);
  const project = data.projects.find((p) => p.id === task.projectId);
  const state = getEffectiveState(task, index);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs text-muted">
          <span className="tabular-nums">{task.key}</span>
          <ProjectBadge project={project} />
        </p>
        <button type="button" onClick={() => onOpen(task)} className="mt-0.5 rounded-sm text-left font-display text-lg leading-tight tracking-[-0.03em] hover:underline">
          {task.title}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <StateBadge state={state === "on_hold" ? "on_hold" : "blocked"} />
        <DueDate due={task.dueDate} today={today} />
        <AssigneeAvatar user={assignee} />
      </div>
    </div>
  );
}

export function HeldTaskList({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<Pause />}
        title="Nothing is on hold"
        body="Paused work shows up here. Put a task on hold from its detail panel when work is deliberately stopped, which is different from being blocked."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {tasks.map((t) => (
        <li key={t.id} className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-elev-1">
          <RowHeader task={t} onOpen={onOpen} />
          <HoldNotice task={t} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}

export function BlockedTaskList({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<Prohibit />}
        title="No blocked tasks"
        body="Tasks that can't move because of an unfinished dependency or an outside impediment appear here, with a way to resolve each blocker."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {tasks.map((t) => (
        <li key={t.id} className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-elev-1">
          <RowHeader task={t} onOpen={onOpen} />
          <BlockerList task={t} />
        </li>
      ))}
    </ul>
  );
}
