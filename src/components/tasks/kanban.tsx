"use client";

import { Plus } from "@phosphor-icons/react";
import { useMemo, useState, type DragEvent } from "react";
import { IconButton } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/badges";
import { useApp, useUi } from "@/lib/app-context";
import { sortTasks } from "@/lib/selectors";
import type { CreateStatusChoice, Status, Task } from "@/lib/types";
import { STATUS_LABEL, STATUS_ORDER, STATUS_TINT, cn } from "@/lib/utils";
import { TaskCard } from "./task-card";

const DRAG_TYPE = "application/x-taskflow-task";
const HELP_ID = "kanban-help";

function KanbanColumn({
  status,
  tasks,
  dragId,
  isOver,
  onOver,
  onLeave,
  onDrop,
  onOpen,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  status: Status;
  tasks: Task[];
  dragId: string | null;
  isOver: boolean;
  onOver: (s: Status) => void;
  onLeave: (s: Status) => void;
  onDrop: (e: DragEvent, s: Status) => void;
  onOpen: (t: Task) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, t: Task) => void;
  onDragEnd: () => void;
  onMove: (t: Task, dir: -1 | 1) => void;
}) {
  const ui = useUi();
  const headingId = `col-${status}`;
  return (
    <section
      aria-labelledby={headingId}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onOver(status);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onLeave(status);
      }}
      onDrop={(e) => onDrop(e, status)}
      className={cn(
        "flex w-[min(82vw,300px)] shrink-0 snap-start flex-col rounded-lg bg-sunken p-2 transition-colors duration-150 sm:w-72 lg:w-auto lg:min-w-0 lg:flex-1",
        isOver && "bg-ice outline-2 -outline-offset-2 outline-ink",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
        <h3 id={headingId} className="flex items-center gap-2 font-sans text-sm font-medium tracking-normal">
          <StatusDot tint={STATUS_TINT[status]} />
          {STATUS_LABEL[status]}
          <span className="rounded-pill bg-surface px-2 text-xs tabular-nums text-muted">{tasks.length}</span>
        </h3>
        {status !== "done" ? (
          <IconButton
            aria-label={`Create task in ${STATUS_LABEL[status]}`}
            size="sm"
            onClick={() => ui.openCreate({ status: status as CreateStatusChoice })}
          >
            <Plus />
          </IconButton>
        ) : null}
      </div>
      <div className="scroll-thin flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-0.5 pb-1">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            draggable
            dragging={dragId === t.id}
            onOpen={onOpen}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onMove={onMove}
            describedBy={HELP_ID}
          />
        ))}
        {tasks.length === 0 ? (
          <p className="rounded-md border border-dashed border-line-strong px-3 py-6 text-center text-xs text-muted">
            {dragId ? "Drop here" : status === "done" ? "Finished tasks appear here" : "No tasks"}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Kanban board over the shared task records. Dropping a card calls the same setStatus
 * action used by the List and the detail panel, so every view updates at once.
 * Rejected moves (e.g. a blocked task dropped into Done) show an error and the card stays put.
 */
export function KanbanBoard({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const { data, actions } = useApp();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Status | null>(null);

  const columns = useMemo(() => {
    const out: Record<Status, Task[]> = { todo: [], in_progress: [], in_review: [], done: [] };
    for (const t of sortTasks(tasks, "priority", "asc", data)) out[t.status].push(t);
    out.done.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    return out;
  }, [tasks, data]);

  const move = (task: Task, to: Status): void => {
    if (task.status === to) return;
    actions.setStatus(task.id, to);
  };

  const onDrop = (e: DragEvent, status: Status): void => {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_TYPE) || dragId;
    setDragId(null);
    setOver(null);
    const task = data.tasks.find((t) => t.id === id);
    if (task) move(task, status);
  };

  return (
    <>
      <p id={HELP_ID} className="sr-only">
        Press Enter to open the task. Press Alt with the left or right arrow to move it to another column.
      </p>
      <div className="scroll-thin relative -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {STATUS_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={columns[status]}
            dragId={dragId}
            isOver={over === status}
            onOver={setOver}
            onLeave={(s) => setOver((o) => (o === s ? null : o))}
            onDrop={onDrop}
            onOpen={onOpen}
            onDragStart={(e, t) => {
              e.dataTransfer.setData(DRAG_TYPE, t.id);
              e.dataTransfer.effectAllowed = "move";
              setDragId(t.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOver(null);
            }}
            onMove={(t, dir) => {
              const i = STATUS_ORDER.indexOf(t.status) + dir;
              if (i >= 0 && i < STATUS_ORDER.length) move(t, STATUS_ORDER[i]);
            }}
          />
        ))}
      </div>
    </>
  );
}
