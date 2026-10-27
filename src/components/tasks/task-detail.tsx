"use client";

import { ArrowLeft, Copy, Trash, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ProjectBadge, StateBadge, StatusBadge } from "@/components/ui/badges";
import { Banner, ErrorState } from "@/components/ui/feedback";
import { Button, IconButton } from "@/components/ui/button";
import { Field, PillDate, PillSelect, Textarea } from "@/components/ui/fields";
import { Drawer } from "@/components/ui/overlay";
import { OPEN_TASK_EVENT, requestOpenTask, useApp, useQueryState } from "@/lib/app-context";
import { getEffectiveState } from "@/lib/lifecycle";
import type { Priority, Status, Task } from "@/lib/types";
import { PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL, formatRelative } from "@/lib/utils";
import { DependencyList } from "./dependency-list";
import { BlockerList, HoldNotice, StateActions } from "./hold-blocked";
import { LabelPicker } from "./pickers";
import { SubtaskList } from "./subtask-list";

function DetailSection({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="border-t border-line px-5 py-4">
      <h3 id={id} className="mb-3 text-base">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Property({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="py-1 text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 py-0.5">{children}</dd>
    </>
  );
}

function MentionText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(@\w+)/g).map((part, i) =>
        part.startsWith("@") ? (
          <strong key={i} className="font-medium">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function Comments({ task }: { task: Task }) {
  const { data, actions, now } = useApp();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (): void => {
    if (!body.trim()) {
      setError("Write something before posting a comment.");
      return;
    }
    const res = actions.addComment(task.id, body);
    if (res.ok) {
      setBody("");
      setError(null);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      {task.comments.length === 0 ? <p className="text-sm text-muted">No comments yet. Use @name to mention a teammate.</p> : null}
      <ul className="flex flex-col gap-4">
        {task.comments.map((c) => {
          const author = data.users.find((u) => u.id === c.authorId);
          return (
            <li key={c.id} className="flex gap-3">
              <Avatar name={author?.name ?? "?"} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{author?.name ?? "Unknown"}</span>{" "}
                  <span className="text-xs text-muted">{formatRelative(c.createdAt, now)}</span>
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">
                  <MentionText text={c.body} />
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-2"
      >
        <Field label="Add a comment" hideLabel error={error}>
          {(p) => (
            <Textarea
              {...p}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Write a comment. Mention teammates with @name"
              className="min-h-20"
              maxLength={2000}
            />
          )}
        </Field>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted">Ctrl or Cmd + Enter to post</span>
          <Button type="submit" variant="primary" size="sm">
            Comment
          </Button>
        </div>
      </form>
    </div>
  );
}

function Activity({ task }: { task: Task }) {
  const { data, now } = useApp();
  const events = data.activity
    .filter((a) => a.taskId === task.id)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 25);
  if (events.length === 0) return <p className="text-sm text-muted">No activity yet.</p>;
  return (
    <ol className="flex flex-col gap-2.5">
      {events.map((a) => {
        const actor = data.users.find((u) => u.id === a.actorId);
        return (
          <li key={a.id} className="flex items-start gap-2.5 text-sm">
            <Avatar name={actor?.name ?? "?"} size="xs" className="mt-0.5" />
            <p className="min-w-0 flex-1">
              <span className="font-medium">{actor?.name ?? "Someone"}</span> {a.text}
              <span className="ml-2 text-xs text-muted">{formatRelative(a.at, now)}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data, index, actions, now } = useApp();
  const rootRef = useRef<HTMLDivElement>(null);
  const state = getEffectiveState(task, index);
  const parent = task.parentId ? index.get(task.parentId) : undefined;
  const project = data.projects.find((p) => p.id === task.projectId);

  // Local drafts for text fields. They resync when the stored value changes elsewhere.
  const [title, setTitle] = useState(task.title);
  const [seenTitle, setSeenTitle] = useState(task.title);
  if (task.title !== seenTitle) {
    setSeenTitle(task.title);
    setTitle(task.title);
  }
  const [desc, setDesc] = useState(task.description);
  const [seenDesc, setSeenDesc] = useState(task.description);
  if (task.description !== seenDesc) {
    setSeenDesc(task.description);
    setDesc(task.description);
  }
  const [titleError, setTitleError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    rootRef.current?.closest<HTMLElement>(".scroll-thin")?.scrollTo({ top: 0 });
  }, [task.id]);

  const commitTitle = (): void => {
    if (title.trim() === task.title) {
      setTitle(task.title);
      setTitleError(null);
      return;
    }
    if (!title.trim()) {
      setTitleError("A task needs a title.");
      return;
    }
    const res = actions.updateTask(task.id, { title });
    if (res.ok) setTitleError(null);
  };

  const statusValue = task.stage === "backlog" ? "backlog" : task.status;
  const statusOptions = [
    ...(parent ? [] : [{ value: "backlog", label: "Backlog" }]),
    { value: "todo", label: STATUS_LABEL.todo },
    { value: "in_progress", label: STATUS_LABEL.in_progress },
    { value: "in_review", label: STATUS_LABEL.in_review },
    { value: "done", label: STATUS_LABEL.done, disabled: task.stage === "backlog" },
  ];
  const onStatus = (v: string): void => {
    if (v === "backlog") actions.moveToBacklog(task.id);
    else if (task.stage === "backlog") actions.activateTask(task.id, v as Exclude<Status, "done">);
    else actions.setStatus(task.id, v as Status);
  };

  return (
    <div ref={rootRef}>
      <div className="px-5 pb-4 pt-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {state !== "active" ? <StateBadge state={state} /> : null}
          {state === "blocked" || state === "on_hold" || state === "backlog" ? <StatusBadge status={task.status} /> : null}
        </div>
        <Field label="Title" hideLabel error={titleError}>
          {(p) => (
            <input
              {...p}
              value={title}
              maxLength={200}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleError(null);
              }}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                } else if (e.key === "Escape" && title !== task.title) {
                  e.stopPropagation();
                  e.preventDefault();
                  setTitle(task.title);
                  setTitleError(null);
                }
              }}
              className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 -mx-2 font-display text-[1.6rem] font-medium leading-tight tracking-[-0.045em] hover:border-line focus:border-ink aria-[invalid=true]:border-danger"
            />
          )}
        </Field>
      </div>

      <div className="flex flex-col gap-3 px-5 pb-5">
        {task.hold ? <HoldNotice task={task} /> : null}
        {state === "blocked" ? <BlockerList task={task} /> : null}
        <StateActions task={task} />
      </div>

      <section aria-label="Properties" className="border-t border-line px-5 py-4">
        <dl className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5">
          <Property label="Status">
            <PillSelect label="Status" value={statusValue} onChange={onStatus} options={statusOptions} />
          </Property>
          <Property label="Priority">
            <PillSelect
              label="Priority"
              value={task.priority}
              onChange={(v) => actions.updateTask(task.id, { priority: v as Priority })}
              options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
            />
          </Property>
          <Property label="Assignee">
            <PillSelect
              label="Assignee"
              value={task.assigneeId ?? ""}
              muted={!task.assigneeId}
              onChange={(v) => actions.updateTask(task.id, { assigneeId: v || null })}
              options={[{ value: "", label: "Unassigned" }, ...data.users.map((u) => ({ value: u.id, label: u.name }))]}
            />
          </Property>
          <Property label="Reporter">
            <PillSelect
              label="Reporter"
              value={task.reporterId}
              onChange={(v) => actions.updateTask(task.id, { reporterId: v })}
              options={data.users.map((u) => ({ value: u.id, label: u.name }))}
            />
          </Property>
          <Property label="Project">
            <PillSelect
              label="Project"
              value={task.projectId}
              disabled={!!parent}
              onChange={(v) => actions.updateTask(task.id, { projectId: v })}
              options={data.projects.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Property>
          <Property label="Due date">
            <PillDate label="Due date" value={task.dueDate} min={task.startDate ?? undefined} onChange={(v) => actions.updateTask(task.id, { dueDate: v })} />
          </Property>
          <Property label="Start date">
            <PillDate label="Start date" value={task.startDate} onChange={(v) => actions.updateTask(task.id, { startDate: v })} />
          </Property>
          <Property label="Labels">
            <LabelPicker value={task.labels} onChange={(labels) => actions.updateTask(task.id, { labels })} />
          </Property>
        </dl>
      </section>

      <section aria-labelledby="desc-h" className="border-t border-line px-5 py-4">
        <h3 id="desc-h" className="mb-2 text-base">
          Description
        </h3>
        <Textarea
          aria-label="Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => {
            if (desc.trim() !== task.description) actions.updateTask(task.id, { description: desc });
          }}
          placeholder="Add context, goals and acceptance criteria"
          className="min-h-32"
          maxLength={8000}
        />
        <p className="mt-1 text-xs text-muted">Saves when you click away. Updated {formatRelative(task.updatedAt, now)}.</p>
      </section>

      {parent ? (
        <DetailSection id="parent-h" title="Parent task">
          <button
            type="button"
            onClick={() => requestOpenTask(parent.id)}
            className="inline-flex items-center gap-2 rounded-sm text-sm hover:underline"
          >
            <ArrowLeft size={14} aria-hidden />
            <span className="text-xs tabular-nums text-muted">{parent.key}</span>
            {parent.title}
          </button>
        </DetailSection>
      ) : (
        <DetailSection id="subtasks-h" title="Subtasks">
          <SubtaskList parent={task} />
        </DetailSection>
      )}

      <DetailSection id="deps-h" title="Dependencies">
        <DependencyList task={task} />
      </DetailSection>

      <DetailSection id="comments-h" title={`Comments (${task.comments.length})`}>
        <Comments task={task} />
      </DetailSection>

      <DetailSection id="activity-h" title="Activity">
        <Activity task={task} />
      </DetailSection>

      <section aria-label="Task actions" className="border-t border-line px-5 py-4">
        {confirmDelete ? (
          <Banner
            tone="warning"
            action={
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  autoFocus
                  onClick={() => {
                    const res = actions.deleteTask(task.id);
                    if (res.ok) onClose();
                  }}
                >
                  Delete task
                </Button>
              </div>
            }
          >
            Delete {task.key}? Its subtasks and comments go with it. You can undo right after.
          </Banner>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button icon={<Copy size={16} />} onClick={() => actions.duplicateTask(task.id)}>
              Duplicate
            </Button>
            <Button variant="danger" icon={<Trash size={16} />} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          Created {formatRelative(task.createdAt, now)} by {data.users.find((u) => u.id === task.reporterId)?.name ?? "Unknown"}
          {project ? ` in ${project.name}` : ""}.
        </p>
      </section>
    </div>
  );
}

function DetailHeader({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data } = useApp();
  const project = data.projects.find((p) => p.id === task.projectId);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-sm font-medium tabular-nums">{task.key}</span>
        <ProjectBadge project={project} />
      </div>
      <IconButton aria-label="Close task details" size="sm" onClick={onClose}>
        <X />
      </IconButton>
    </div>
  );
}

/**
 * Hosts the task detail drawer for the whole app. The open task lives in the URL (?task=ID),
 * so closing returns to the exact same page, filters and scroll position, and links are shareable.
 */
export function TaskDetailHost() {
  const [params, set] = useQueryState();
  const { index } = useApp();
  const id = params.get("task");
  const task = id ? index.get(id) : undefined;

  useEffect(() => {
    const onOpen = (e: Event): void => set({ task: (e as CustomEvent<string>).detail });
    window.addEventListener(OPEN_TASK_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TASK_EVENT, onOpen);
  }, [set]);

  const close = (): void => set({ task: null });

  return (
    <Drawer
      open={!!id}
      onClose={close}
      title={task ? `${task.key} ${task.title}` : "Task details"}
      header={task ? <DetailHeader task={task} onClose={close} /> : undefined}
    >
      {id ? (
        task ? (
          <TaskDetail key={task.id} task={task} onClose={close} />
        ) : (
          <ErrorState
            title="This task isn't available"
            body="It may have been deleted. Nothing else was changed."
            action={<Button onClick={close}>Close</Button>}
          />
        )
      ) : null}
    </Drawer>
  );
}
