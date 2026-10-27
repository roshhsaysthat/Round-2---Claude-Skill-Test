"use client";

import { Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { AssigneeAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/feedback";
import { Input } from "@/components/ui/fields";
import { requestOpenTask, useApp } from "@/lib/app-context";
import { subtaskProgress, subtasksOf } from "@/lib/selectors";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Subtasks are real task records, so completing one updates the parent's progress everywhere at once. */
export function SubtaskList({ parent }: { parent: Task }) {
  const { data, actions } = useApp();
  const subs = subtasksOf(data.tasks, parent.id);
  const { done, total } = subtaskProgress(data.tasks, parent.id);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const locked = parent.stage === "backlog";

  const add = (): void => {
    if (!title.trim()) {
      setError("Type a subtask first.");
      return;
    }
    const res = actions.addSubtask(parent.id, title);
    if (res.ok) {
      setTitle("");
      setError(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {total > 0 ? <Meter value={done} max={total} label={`${done} of ${total} subtasks done`} /> : null}
      {subs.length > 0 ? (
        <ul className="flex flex-col">
          {subs.map((s) => (
            <li key={s.id} className="flex items-center gap-2 border-b border-line py-1 last:border-b-0">
              <label className="inline-flex min-h-9 items-center px-1 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 [@media(pointer:coarse)]:justify-center">
                <input
                  type="checkbox"
                  checked={s.status === "done"}
                  disabled={locked}
                  onChange={(e) => actions.setStatus(s.id, e.target.checked ? "done" : "todo")}
                  className="size-4 cursor-pointer accent-ink disabled:cursor-not-allowed"
                />
                <span className="sr-only">Mark &ldquo;{s.title}&rdquo; {s.status === "done" ? "not done" : "done"}</span>
              </label>
              <button
                type="button"
                onClick={() => requestOpenTask(s.id)}
                className={cn(
                  "min-w-0 flex-1 truncate rounded-sm py-1.5 text-left text-sm hover:underline",
                  s.status === "done" && "text-muted line-through decoration-line-strong",
                )}
              >
                {s.title}
              </button>
              <AssigneeAvatar user={data.users.find((u) => u.id === s.assigneeId)} size="xs" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No subtasks yet. Break the work into steps you can check off.</p>
      )}
      {locked && total > 0 ? <p className="text-xs text-muted">Subtasks can be completed once the task is in active work.</p> : null}
      <form
        className="flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="min-w-0 flex-1">
          <Input
            aria-label="New subtask title"
            aria-invalid={error ? true : undefined}
            placeholder="Add a subtask and press Enter"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            maxLength={200}
          />
          {error ? (
            <p role="alert" className="mt-1 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <Button type="submit" icon={<Plus size={14} />}>
          Add
        </Button>
      </form>
    </div>
  );
}
