"use client";

import { CaretDown, CaretUp, FolderSimple, ListChecks, Plus, Sparkle, TextAlignLeft, User, X, CellSignalFull, CircleHalf } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox, Input, PillDate, PillSelect, Textarea } from "@/components/ui/fields";
import { Modal } from "@/components/ui/overlay";
import { pushToast } from "@/lib/store";
import { useApp, useUi, type CreateDefaults } from "@/lib/app-context";
import { linkableTasks } from "@/lib/lifecycle";
import type { CreateStatusChoice, Priority, Task } from "@/lib/types";
import { PRIORITY_LABEL, PRIORITY_ORDER } from "@/lib/utils";
import { AiSuggestionPanel, type AcceptedSuggestion } from "./ai-suggestion-panel";
import { LabelPicker, TaskPicker } from "./pickers";

const FORM_ID = "create-task-form";
let lastProjectId: string | null = null;

const STATUS_OPTIONS: { value: CreateStatusChoice; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "in_review", label: "In review" },
];

function CreateForm({ defaults, onClose }: { defaults: CreateDefaults; onClose: () => void }) {
  const { data, index, me, actions } = useApp();

  const initialProject =
    defaults.projectId ??
    (lastProjectId && data.projects.some((p) => p.id === lastProjectId) ? lastProjectId : undefined) ??
    data.projects.find((p) => p.status === "active")?.id ??
    data.projects[0]?.id ??
    "";
  const initialStatus: CreateStatusChoice = defaults.status ?? "todo";

  const [title, setTitle] = useState(defaults.title ?? "");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [status, setStatus] = useState<CreateStatusChoice>(initialStatus);
  const [priority, setPriority] = useState<Priority>("none");
  const [assigneeId, setAssigneeId] = useState<string>(defaults.assigneeId === undefined ? (initialStatus === "backlog" ? "" : me.id) : (defaults.assigneeId ?? ""));
  const [projectId, setProjectId] = useState(initialProject);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [blockedBy, setBlockedBy] = useState<string[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [aiOpen, setAiOpen] = useState(defaults.openAi ?? false);
  const [another, setAnother] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const candidates = linkableTasks(index, "__new__").filter((t) => !blockedBy.includes(t.id));
  const linked = blockedBy.map((id) => index.get(id)).filter((t): t is Task => !!t);

  const addSubtask = (): void => {
    const t = subtaskDraft.trim();
    if (!t) return;
    setSubtasks((s) => [...s, t]);
    setSubtaskDraft("");
  };

  const applySuggestion = (a: AcceptedSuggestion): void => {
    if (a.title) setTitle(a.title);
    if (a.title) setTitleError(null);
    if (a.description) {
      setDescription(a.description);
      setShowDescription(true);
    }
    if (a.priority) setPriority(a.priority);
    if (a.subtasks.length) {
      setSubtasks((s) => [...s, ...a.subtasks.filter((t) => !s.includes(t))]);
      setShowMore(true);
    }
    setAiOpen(false);
    pushToast({ kind: "info", text: "Suggestions added. Review them, then create the task." });
    titleRef.current?.focus();
  };

  const submit = (): void => {
    if (!title.trim()) {
      setTitleError("Give the task a title.");
      titleRef.current?.focus();
      return;
    }
    const pending = subtaskDraft.trim();
    const res = actions.createTask({
      title,
      description,
      projectId,
      assigneeId: assigneeId || null,
      priority,
      status,
      dueDate,
      labels,
      blockedBy,
      subtasks: pending ? [...subtasks, pending] : subtasks,
    });
    if (!res.ok) return;
    lastProjectId = projectId;
    if (another) {
      setTitle("");
      setDescription("");
      setSubtasks([]);
      setSubtaskDraft("");
      setBlockedBy([]);
      setAiOpen(false);
      titleRef.current?.focus();
    } else {
      onClose();
    }
  };

  return (
    <form
      id={FORM_ID}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          submit();
        }
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <label htmlFor="create-title" className="sr-only">
          Task title
        </label>
        <input
          id="create-title"
          ref={titleRef}
          data-autofocus
          value={title}
          maxLength={200}
          placeholder="Task title"
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? "create-title-error" : undefined}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleError(null);
          }}
          className="w-full border-0 border-b-2 border-line bg-transparent pb-2 font-display text-2xl font-medium tracking-[-0.045em] placeholder:text-soft focus:border-ink focus-visible:outline-0 aria-[invalid=true]:border-danger"
        />
        {titleError ? (
          <p id="create-title-error" role="alert" className="mt-1.5 text-xs text-danger">
            {titleError}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-muted">Only a title is required. Press Enter to create.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Task properties">
        <PillSelect
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as CreateStatusChoice)}
          icon={<CircleHalf size={14} />}
          options={STATUS_OPTIONS}
        />
        <PillSelect
          label="Priority"
          value={priority}
          onChange={(v) => setPriority(v as Priority)}
          icon={<CellSignalFull size={14} />}
          muted={priority === "none"}
          display={priority === "none" ? "Priority" : undefined}
          options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
        />
        <PillSelect
          label="Assignee"
          value={assigneeId}
          onChange={setAssigneeId}
          icon={<User size={14} />}
          muted={!assigneeId}
          display={assigneeId ? undefined : "Assignee"}
          options={[{ value: "", label: "Unassigned" }, ...data.users.map((u) => ({ value: u.id, label: u.name }))]}
        />
        <PillSelect
          label="Project"
          value={projectId}
          onChange={setProjectId}
          icon={<FolderSimple size={14} />}
          options={data.projects.map((p) => ({ value: p.id, label: p.name }))}
        />
        <PillDate label="Due date" value={dueDate} onChange={setDueDate} />
        <LabelPicker value={labels} onChange={setLabels} />
      </div>

      {showDescription ? (
        <Textarea
          aria-label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add context, goals and acceptance criteria"
          className="min-h-28"
          maxLength={8000}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {!showDescription ? (
          <Button size="sm" variant="ghost" icon={<TextAlignLeft size={15} />} onClick={() => setShowDescription(true)}>
            Add description
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          icon={<ListChecks size={15} />}
          trailing={showMore ? <CaretUp size={12} /> : <CaretDown size={12} />}
          aria-expanded={showMore}
          aria-controls="create-more"
          onClick={() => setShowMore((v) => !v)}
        >
          Subtasks and dependencies
          {subtasks.length + blockedBy.length > 0 ? ` (${subtasks.length + blockedBy.length})` : ""}
        </Button>
        {!aiOpen ? (
          <Button size="sm" variant="secondary" icon={<Sparkle size={15} />} onClick={() => setAiOpen(true)} className="ml-auto">
            Help me create this task
          </Button>
        ) : null}
      </div>

      {showMore ? (
        <div id="create-more" className="flex flex-col gap-4 rounded-lg bg-canvas p-3">
          <div className="flex flex-col gap-2">
            <h3 className="font-sans text-sm font-medium tracking-normal">Subtasks</h3>
            {subtasks.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {subtasks.map((s, i) => (
                  <li key={`${s}-${i}`} className="flex items-center gap-2 text-sm">
                    <span aria-hidden className="size-3.5 shrink-0 rounded-sm border border-line-strong" />
                    <span className="min-w-0 flex-1 truncate">{s}</span>
                    <IconButton aria-label={`Remove subtask ${s}`} size="sm" onClick={() => setSubtasks((l) => l.filter((_, j) => j !== i))}>
                      <X size={14} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex gap-2">
              <Input
                aria-label="New subtask title"
                placeholder="Add a subtask and press Enter"
                value={subtaskDraft}
                onChange={(e) => setSubtaskDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !(e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
                maxLength={200}
                className="bg-surface"
              />
              <Button size="md" icon={<Plus size={14} />} onClick={addSubtask}>
                Add
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-sans text-sm font-medium tracking-normal">Blocked by</h3>
            {linked.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {linked.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <span className="shrink-0 text-xs tabular-nums text-muted">{t.key}</span>
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <IconButton aria-label={`Remove dependency on ${t.key}`} size="sm" onClick={() => setBlockedBy((l) => l.filter((x) => x !== t.id))}>
                      <X size={14} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : null}
            <div>
              <TaskPicker candidates={candidates} onPick={(t) => setBlockedBy((l) => [...l, t.id])} />
            </div>
          </div>
        </div>
      ) : null}

      {aiOpen ? (
        <AiSuggestionPanel
          initialBrief={title}
          onAccept={applySuggestion}
          onCancel={() => {
            setAiOpen(false);
            titleRef.current?.focus();
          }}
        />
      ) : null}

      <Checkbox label="Create another after this one" checked={another} onChange={(e) => setAnother(e.target.checked)} />
    </form>
  );
}

/**
 * Linear-style quick create. Title is focused on open and is the only required field.
 * The form remounts on every open, so there is never stale state, and AI suggestions
 * flow through this exact form and the same createTask action as manual creation.
 */
export function CreateTaskDialog() {
  const ui = useUi();
  const { open, defaults } = ui.createState;
  return (
    <Modal
      open={open}
      onClose={ui.closeCreate}
      title="New task"
      size="lg"
      position="top"
      footer={
        <>
          <span className="mr-auto hidden text-xs text-muted sm:inline">Esc to cancel · Ctrl or Cmd + Enter to create</span>
          <Button variant="ghost" onClick={ui.closeCreate}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary">
            Create task
          </Button>
        </>
      }
    >
      <CreateForm defaults={defaults} onClose={ui.closeCreate} />
    </Modal>
  );
}
