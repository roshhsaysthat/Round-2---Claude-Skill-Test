"use client";

import { FolderSimple, Warning } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ProjectStatusTag, Tag } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/feedback";
import { DateInput, Field, Input, SelectField, Textarea } from "@/components/ui/fields";
import { Modal } from "@/components/ui/overlay";
import { useApp } from "@/lib/app-context";
import { projectStats } from "@/lib/selectors";
import { TEMPLATES, type Template } from "@/lib/templates";
import type { Project, ProjectStatus } from "@/lib/types";
import { PROJECT_STATUS_LABEL, formatDate, pluralize } from "@/lib/utils";
import { TINT_BG } from "@/components/ui/avatar";

export function ProjectCard({ project }: { project: Project }) {
  const { data, today } = useApp();
  const s = projectStats(data, project.id, today);
  const owner = data.users.find((u) => u.id === project.ownerId);
  return (
    <li className="relative flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-elev-1 transition-shadow hover:shadow-elev-2">
      <div className="flex items-start gap-3">
        <span aria-hidden className={`inline-flex size-10 shrink-0 items-center justify-center rounded-md ${TINT_BG[project.tint]}`}>
          <FolderSimple size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg">
            <Link href={`/projects/${project.id}`} className="after:absolute after:inset-0 after:content-[''] hover:underline">
              {project.name}
            </Link>
          </h3>
          <p className="text-xs text-muted">{project.key}</p>
        </div>
        <ProjectStatusTag status={project.status} />
      </div>
      {project.description ? <p className="line-clamp-2 text-sm text-muted">{project.description}</p> : null}
      <Meter value={s.done} max={Math.max(s.total - s.backlog, 1)} label={`${s.progress}% complete`} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>{s.progress}% done</span>
        <span>{pluralize(s.open, "open task")}</span>
        {s.overdue > 0 ? (
          <span className="inline-flex items-center gap-1 text-signal">
            <Warning size={12} weight="fill" aria-hidden /> {s.overdue} overdue
          </span>
        ) : null}
        {s.blocked > 0 ? <span>{s.blocked} blocked</span> : null}
        <span className="ml-auto inline-flex items-center gap-1.5">
          {owner ? <Avatar name={owner.name} size="xs" /> : null}
          {project.targetDate ? `Target ${formatDate(project.targetDate)}` : "No target date"}
        </span>
      </div>
    </li>
  );
}

const STATUSES: ProjectStatus[] = ["planned", "active", "paused", "completed"];

/** Create or edit a project. Pass `project` to edit. */
export function ProjectFormDialog({ open, onClose, project, onSaved }: { open: boolean; onClose: () => void; project?: Project; onSaved?: (id: string) => void }) {
  return (
    <Modal open={open} onClose={onClose} title={project ? "Edit project" : "New project"} size="md" footer={
      <>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="project-form">{project ? "Save changes" : "Create project"}</Button>
      </>
    }>
      <ProjectForm project={project} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

function ProjectForm({ project, onClose, onSaved }: { project?: Project; onClose: () => void; onSaved?: (id: string) => void }) {
  const { data, me, actions } = useApp();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [ownerId, setOwnerId] = useState(project?.ownerId ?? me.id);
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "active");
  const [startDate, setStartDate] = useState(project?.startDate ?? "");
  const [targetDate, setTargetDate] = useState(project?.targetDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = (): void => {
    setFormError(null);
    if (!name.trim()) return setError("Give the project a name.");
    if (startDate && targetDate && targetDate < startDate) return setFormError("The target date can't be before the start date.");
    const input = { name, description, ownerId, status, startDate: startDate || null, targetDate: targetDate || null };
    const res = project ? actions.updateProject(project.id, input) : actions.createProject(input);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    onSaved?.((res.value as string | undefined) ?? project?.id ?? "");
    onClose();
  };

  return (
    <form id="project-form" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-4">
      <Field label="Name" required error={error}>
        {(p) => <Input {...p} data-autofocus value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setError(null); }} />}
      </Field>
      <Field label="Description">
        {(p) => <Textarea {...p} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Owner">
          {(p) => (
            <SelectField {...p} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </SelectField>
          )}
        </Field>
        <Field label="Status">
          {(p) => (
            <SelectField {...p} value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              {STATUSES.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>)}
            </SelectField>
          )}
        </Field>
        <Field label="Start date">{(p) => <DateInput {...p} value={startDate} onChange={(e) => setStartDate(e.target.value)} />}</Field>
        <Field label="Target date">{(p) => <DateInput {...p} value={targetDate} min={startDate || undefined} onChange={(e) => setTargetDate(e.target.value)} />}</Field>
      </div>
      {formError ? <p role="alert" className="text-sm text-danger">{formError}</p> : null}
    </form>
  );
}

/** Pick one of three templates, preview it, then create a whole project or a single task from it. Result stays editable. */
export function TemplateDialog({ open, onClose, defaultProjectId, onCreated }: { open: boolean; onClose: () => void; defaultProjectId?: string; onCreated?: (kind: "project" | "task", id: string) => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Start from a template" description="Preview what a template contains, then create it. Everything can be edited afterwards." size="lg">
      <TemplateBody onClose={onClose} defaultProjectId={defaultProjectId} onCreated={onCreated} />
    </Modal>
  );
}

function TemplateBody({ onClose, defaultProjectId, onCreated }: { onClose: () => void; defaultProjectId?: string; onCreated?: (kind: "project" | "task", id: string) => void }) {
  const { data, me, today, actions } = useApp();
  const [tpl, setTpl] = useState<Template>(TEMPLATES[0]);
  const [mode, setMode] = useState<"project" | "task">("project");
  const [name, setName] = useState(TEMPLATES[0].project.name);
  const [startDate, setStartDate] = useState(today);
  const [projectId, setProjectId] = useState(defaultProjectId ?? data.projects[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const choose = (t: Template): void => {
    setTpl(t);
    setName(t.project.name);
    setError(null);
  };

  const create = (): void => {
    if (mode === "project") {
      if (!name.trim()) return setError("Give the new project a name.");
      const res = actions.createProjectFromTemplate(tpl.id, { name, ownerId: me.id, startDate });
      if (!res.ok) return setError(res.error);
      onCreated?.("project", res.value as string);
    } else {
      if (!projectId) return setError("Choose a project for the task.");
      const res = actions.createTaskFromTemplate(tpl.id, { projectId });
      if (!res.ok) return setError(res.error);
      onCreated?.("task", res.value as string);
    }
    onClose();
  };

  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="Template" className="grid gap-2 sm:grid-cols-3">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={t.id === tpl.id}
            onClick={() => choose(t)}
            className={`rounded-lg border p-3 text-left transition-colors ${TINT_BG[t.tint]} ${t.id === tpl.id ? "border-ink" : "border-transparent hover:border-line-strong"}`}
          >
            <span className="block font-medium">{t.name}</span>
            <span className="mt-1 block text-xs text-ink/70">{t.blurb}</span>
          </button>
        ))}
      </div>

      <div>
        <h3 className="mb-2 font-sans text-sm font-medium tracking-normal">Preview</h3>
        {mode === "project" ? (
          <ol className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg bg-canvas p-3 text-sm scroll-thin">
            {tpl.items.map((it) => (
              <li key={it.ref} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">{it.title}</span>
                {it.subtasks?.length ? <Tag>{pluralize(it.subtasks.length, "subtask")}</Tag> : null}
                {it.dependsOn?.length ? <Tag tint="peach">Depends on {it.dependsOn.length}</Tag> : null}
                <span className="text-xs text-muted">Day {it.dueOffset}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="rounded-lg bg-canvas p-3 text-sm">
            <p className="font-medium">{tpl.task.title}</p>
            <p className="mt-1 text-muted">{tpl.task.description}</p>
            <ul className="mt-2 list-disc pl-5 text-muted">
              {tpl.task.subtasks.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        )}
      </div>

      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">Create as</legend>
        {(["project", "task"] as const).map((m) => (
          <label key={m} className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name="tpl-mode" checked={mode === m} onChange={() => { setMode(m); setError(null); }} className="accent-ink" />
            {m === "project" ? "New project with all tasks" : "Single task in an existing project"}
          </label>
        ))}
      </fieldset>

      {mode === "project" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project name" required>{(p) => <Input {...p} value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setError(null); }} />}</Field>
          <Field label="Start date" hint="Due dates are set relative to this.">{(p) => <DateInput {...p} value={startDate} onChange={(e) => setStartDate(e.target.value)} />}</Field>
        </div>
      ) : (
        <Field label="Project">
          {(p) => (
            <SelectField {...p} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {data.projects.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
            </SelectField>
          )}
        </Field>
      )}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={create}>{mode === "project" ? "Create project" : "Create task"}</Button>
      </div>
    </div>
  );
}
