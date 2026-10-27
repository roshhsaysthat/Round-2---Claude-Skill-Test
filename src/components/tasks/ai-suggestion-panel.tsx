"use client";

import { CircleNotch, Sparkle, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Tag } from "@/components/ui/badges";
import { Button, IconButton } from "@/components/ui/button";
import { Banner } from "@/components/ui/feedback";
import { Checkbox, Field, Input, PillSelect, Textarea } from "@/components/ui/fields";
import { aiService } from "@/lib/ai";
import type { Priority } from "@/lib/types";
import { PRIORITY_LABEL, PRIORITY_ORDER } from "@/lib/utils";

export interface AcceptedSuggestion {
  title?: string;
  description?: string;
  priority?: Priority;
  subtasks: string[];
}

interface Item {
  id: number;
  text: string;
  on: boolean;
}

function ItemList({ items, onChange, label }: { items: Item[]; onChange: (next: Item[]) => void; label: string }) {
  const patch = (id: number, p: Partial<Item>): void => onChange(items.map((i) => (i.id === id ? { ...i, ...p } : i)));
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it) => (
        <li key={it.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={it.on}
            aria-label={`Include ${label}: ${it.text}`}
            onChange={(e) => patch(it.id, { on: e.target.checked })}
            className="size-4 shrink-0 accent-ink"
          />
          <Input
            aria-label={`${label} text`}
            value={it.text}
            onChange={(e) => patch(it.id, { text: e.target.value })}
            className="h-9"
            disabled={!it.on}
          />
          <IconButton aria-label={`Remove ${label}: ${it.text}`} size="sm" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
            <X size={14} />
          </IconButton>
        </li>
      ))}
      {items.length === 0 ? <li className="text-sm text-muted">None suggested.</li> : null}
    </ul>
  );
}

/**
 * "Help me create this task". Brief in, editable proposal out. Accepting only fills the normal
 * create-task form. It never creates or assigns anything, never sets a deadline and never resolves a blocker.
 */
export function AiSuggestionPanel({
  initialBrief = "",
  onAccept,
  onCancel,
}: {
  initialBrief?: string;
  onAccept: (accepted: AcceptedSuggestion) => void;
  onCancel: () => void;
}) {
  const [brief, setBrief] = useState(initialBrief);
  const [phase, setPhase] = useState<"brief" | "loading" | "review">("brief");
  const [error, setError] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [useTitle, setUseTitle] = useState(true);
  const [description, setDescription] = useState("");
  const [useDescription, setUseDescription] = useState(true);
  const [priority, setPriority] = useState<Priority>("medium");
  const [usePriority, setUsePriority] = useState(true);
  const [criteria, setCriteria] = useState<Item[]>([]);
  const [subtasks, setSubtasks] = useState<Item[]>([]);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const generate = async (): Promise<void> => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setError(null);
    setPhase("loading");
    try {
      const s = await aiService.suggest(brief, { signal: ctrl.signal });
      setTitle(s.title);
      setDescription(s.description);
      setPriority(s.priority);
      setUseTitle(true);
      setUseDescription(true);
      setUsePriority(true);
      setCriteria(s.acceptanceCriteria.map((text, id) => ({ id, text, on: true })));
      setSubtasks(s.subtasks.map((text, id) => ({ id, text, on: true })));
      setSelectError(null);
      setPhase("review");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message || "Suggestions couldn't be generated. Try again.");
      setPhase("brief");
    }
  };

  const accept = (): void => {
    const chosenCriteria = criteria.filter((c) => c.on && c.text.trim());
    const chosenSubtasks = subtasks.filter((s) => s.on && s.text.trim()).map((s) => s.text.trim());
    if (useTitle && !title.trim()) {
      setSelectError("The suggested title is empty. Add a title or untick it.");
      return;
    }
    if (!useTitle && !useDescription && !usePriority && chosenCriteria.length === 0 && chosenSubtasks.length === 0) {
      setSelectError("Select at least one suggestion to accept.");
      return;
    }
    let text = useDescription ? description.trim() : "";
    if (chosenCriteria.length) {
      text += `${text ? "\n\n" : ""}Acceptance criteria:\n${chosenCriteria.map((c) => `- [ ] ${c.text.trim()}`).join("\n")}`;
    }
    onAccept({
      title: useTitle ? title.trim() : undefined,
      description: text || undefined,
      priority: usePriority ? priority : undefined,
      subtasks: chosenSubtasks,
    });
  };

  return (
    <section aria-label="Help me create this task" className="rounded-lg border border-line-strong bg-canvas p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base">
          <Sparkle size={18} weight="fill" aria-hidden /> Help me create this task
        </h3>
        <div className="flex items-center gap-2">
          <Tag tint="lilac" title="No live AI model is called. Results come from a local simulation.">
            Simulated
          </Tag>
          <IconButton aria-label="Close AI assistant without creating anything" size="sm" onClick={onCancel}>
            <X size={14} />
          </IconButton>
        </div>
      </div>

      {phase !== "review" ? (
        <div className="flex flex-col gap-3">
          <Field label="What needs to happen?" hint="Describe it roughly. For example: Prepare the launch campaign for our new product.">
            {(p) => (
              <Textarea
                {...p}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                className="min-h-20 bg-surface"
                autoFocus
                disabled={phase === "loading"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void generate();
                  }
                }}
              />
            )}
          </Field>
          {error ? (
            <Banner tone="error" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          ) : null}
          <p className="text-xs text-muted">Suggestions come from a local simulation, not a live AI model. Nothing is saved until you create the task.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={phase === "loading"}
              aria-busy={phase === "loading"}
              icon={phase === "loading" ? <CircleNotch size={14} className="anim-spin" /> : <Sparkle size={14} />}
              onClick={() => void generate()}
            >
              {phase === "loading" ? "Thinking" : "Generate suggestions"}
            </Button>
          </div>
          <span role="status" className="sr-only">
            {phase === "loading" ? "Generating suggestions" : ""}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">Edit anything, untick what you don&apos;t want, then accept. You&apos;ll still review the task before it is created.</p>
          <div className="flex flex-col gap-2">
            <Checkbox label="Title" checked={useTitle} onChange={(e) => setUseTitle(e.target.checked)} className="font-medium" />
            <Input aria-label="Suggested title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!useTitle} className="bg-surface" />
          </div>
          <div className="flex flex-col gap-2">
            <Checkbox label="Description" checked={useDescription} onChange={(e) => setUseDescription(e.target.checked)} className="font-medium" />
            <Textarea
              aria-label="Suggested description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!useDescription}
              className="min-h-24 bg-surface"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Checkbox label="Priority" checked={usePriority} onChange={(e) => setUsePriority(e.target.checked)} className="font-medium" />
            <PillSelect
              label="Suggested priority"
              value={priority}
              disabled={!usePriority}
              onChange={(v) => setPriority(v as Priority)}
              options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="font-sans text-sm font-medium tracking-normal">Acceptance criteria</h4>
            <ItemList items={criteria} onChange={setCriteria} label="criterion" />
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="font-sans text-sm font-medium tracking-normal">Subtasks</h4>
            <ItemList items={subtasks} onChange={setSubtasks} label="subtask" />
          </div>
          {selectError ? (
            <p role="alert" className="text-sm text-danger">
              {selectError}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPhase("brief")}>
              Back to brief
            </Button>
            <Button variant="secondary" size="sm" onClick={onCancel}>
              Discard suggestions
            </Button>
            <Button variant="primary" size="sm" onClick={accept}>
              Accept selected
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
