"use client";

import type { DragEvent, KeyboardEvent } from "react";
import { AssigneeAvatar } from "@/components/ui/avatar";
import { DueDate, PriorityIcon, ProjectBadge } from "@/components/ui/badges";
import { useApp } from "@/lib/app-context";
import { getEffectiveState } from "@/lib/lifecycle";
import type { Task } from "@/lib/types";
import { PRIORITY_LABEL, STATUS_LABEL, cn } from "@/lib/utils";
import { BlockedInline, DependencyIndicator, SubtaskIndicator } from "./task-indicators";

/**
 * The one task card. Used by the Kanban board and anywhere a compact task summary is needed.
 * It is a focusable button-like surface so keyboard users can open it, and (when draggable)
 * move it between columns with Alt + Arrow keys.
 */
export function TaskCard({
  task,
  onOpen,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  describedBy,
}: {
  task: Task;
  onOpen: (task: Task) => void;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: (e: DragEvent<HTMLDivElement>, task: Task) => void;
  onDragEnd?: () => void;
  onMove?: (task: Task, direction: -1 | 1) => void;
  describedBy?: string;
}) {
  const { data, index, today } = useApp();
  const project = data.projects.find((p) => p.id === task.projectId);
  const assignee = data.users.find((u) => u.id === task.assigneeId);
  const state = getEffectiveState(task, index);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(task);
    } else if (e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft") && onMove) {
      e.preventDefault();
      onMove(task, e.key === "ArrowRight" ? 1 : -1);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      aria-describedby={describedBy}
      aria-label={`${task.key}: ${task.title}. ${STATUS_LABEL[task.status]}. ${PRIORITY_LABEL[task.priority]} priority${
        state === "blocked" ? ". Blocked" : ""
      }`}
      onClick={() => onOpen(task)}
      onKeyDown={onKeyDown}
      onDragStart={(e) => onDragStart?.(e, task)}
      onDragEnd={onDragEnd}
      className={cn(
        "group flex cursor-pointer flex-col gap-2.5 rounded-md bg-surface p-3 text-left shadow-elev-1 transition-shadow duration-150",
        "hover:shadow-elev-2 active:cursor-grabbing",
        dragging && "opacity-40",
        state === "done" && "bg-surface/70",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-muted">{task.key}</span>
        <PriorityIcon priority={task.priority} />
        <span className="sr-only">{PRIORITY_LABEL[task.priority]} priority</span>
      </div>
      <p className={cn("line-clamp-3 text-sm font-medium leading-snug", state === "done" && "text-muted line-through decoration-line-strong")}>
        {task.title}
      </p>
      <ProjectBadge project={project} />
      {state === "blocked" ? <BlockedInline task={task} /> : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <DueDate due={task.dueDate} today={today} done={state === "done"} />
        <SubtaskIndicator task={task} />
        <DependencyIndicator task={task} />
        <span className="ml-auto">
          <AssigneeAvatar user={assignee} />
        </span>
      </div>
    </div>
  );
}
