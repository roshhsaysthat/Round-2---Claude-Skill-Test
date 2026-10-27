"use client";

import { ArrowRight, CheckCircle, ClockCountdown, Lightning, Pause, Plus, Prohibit, Warning } from "@phosphor-icons/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ProjectCard } from "@/components/projects/project-parts";
import { Page, PageHeader, Section, TwoToneTitle } from "@/components/shell/page";
import { DueDate, PriorityIndicator } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Tabs } from "@/components/ui/tabs";
import { requestOpenTask, useApp, useUi } from "@/lib/app-context";
import { homeMetrics, recentActivity, type Scope } from "@/lib/selectors";
import type { Task } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

function StatCard({ href, label, value, icon, tint, attention }: { href: string; label: string; value: number; icon: ReactNode; tint: string; attention?: boolean }) {
  return (
    <li>
      <Link
        href={href}
        className={cn("group flex h-full flex-col gap-3 rounded-lg p-4 transition-transform hover:-translate-y-0.5", tint)}
      >
        <span className="flex items-center justify-between text-ink/80">
          <span aria-hidden>{icon}</span>
          <ArrowRight aria-hidden size={14} className="opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
        <span className={cn("font-display text-4xl font-medium tracking-[-0.045em] tabular-nums", attention && value > 0 && "text-signal")}>{value}</span>
        <span className="text-sm font-medium">{label}</span>
      </Link>
    </li>
  );
}

function TaskRow({ t }: { t: Task }) {
  const { today } = useApp();
  return (
    <li>
      <button type="button" onClick={() => requestOpenTask(t.id)} className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-sunken">
        <PriorityIndicator priority={t.priority} />
        <span className="shrink-0 text-xs tabular-nums text-muted">{t.key}</span>
        <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
        <DueDate due={t.dueDate} today={today} />
      </button>
    </li>
  );
}

export function HomeScreen() {
  const { data, me, today, now } = useApp();
  const ui = useUi();
  const [scope, setScope] = useState<Scope>("me");
  const m = homeMetrics(data, scope, today);
  const sc = scope === "all" ? "&scope=all" : "";
  const activity = recentActivity(data, 8, scope);
  const first = me.name.split(" ")[0];
  const overdue = [...m.overdue].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const projects = data.projects.filter((p) => p.status !== "completed").slice(0, 3);

  return (
    <Page>
      <PageHeader
        title={<TwoToneTitle soft={`Good to see you, ${first}.`} strong="Here is the work." />}
        description={scope === "me" ? "Your tasks across every project." : "Every task across the team."}
        actions={
          <>
            <Tabs<Scope> label="Scope" idPrefix="home-scope" value={scope} onChange={setScope} items={[{ value: "me", label: "Mine" }, { value: "all", label: "Everyone" }]} />
            <Button variant="primary" size="lg" icon={<Plus size={16} />} onClick={() => ui.openCreate()}>
              Create task
            </Button>
          </>
        }
      />

      <ul aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard href={`/my-tasks?view=kanban${sc}`} label="Active" value={m.active.length} icon={<Lightning size={20} />} tint="bg-sky" />
        <StatCard href={`/my-tasks?view=list&status=done${sc}`} label="Completed" value={m.completed.length} icon={<CheckCircle size={20} />} tint="bg-sage" />
        <StatCard href={`/my-tasks?view=list&due=overdue${sc}`} label="Overdue" value={m.overdue.length} icon={<Warning size={20} />} tint="bg-peach" attention />
        <StatCard href={`/my-tasks?view=list&due=upcoming${sc}`} label="Due in 7 days" value={m.upcoming.length} icon={<ClockCountdown size={20} />} tint="bg-butter" />
        <StatCard href={`/my-tasks?view=onhold${sc}`} label="On hold" value={m.onHold.length} icon={<Pause size={20} />} tint="bg-stone" />
        <StatCard href={`/my-tasks?view=blocked${sc}`} label="Blocked" value={m.blocked.length} icon={<Prohibit size={20} />} tint="bg-lilac" />
      </ul>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <Section title="Needs attention" id="attention">
          {overdue.length === 0 && m.upcoming.length === 0 ? (
            <EmptyState icon={<CheckCircle />} title="Nothing urgent" body="No overdue tasks and nothing due in the next 7 days." />
          ) : (
            <div className="flex flex-col gap-4">
              {overdue.length > 0 ? (
                <div>
                  <h3 className="mb-1 font-sans text-[13px] font-medium tracking-normal text-signal">Overdue ({overdue.length})</h3>
                  <ul>{overdue.slice(0, 5).map((t) => <TaskRow key={t.id} t={t} />)}</ul>
                </div>
              ) : null}
              {m.upcoming.length > 0 ? (
                <div>
                  <h3 className="mb-1 font-sans text-[13px] font-medium tracking-normal">Coming up ({m.upcoming.length})</h3>
                  <ul>{m.upcoming.slice(0, 5).map((t) => <TaskRow key={t.id} t={t} />)}</ul>
                </div>
              ) : null}
            </div>
          )}
        </Section>

        <Section title="Recent activity" id="activity">
          {activity.length === 0 ? (
            <EmptyState title="No activity yet" body="Changes to tasks will appear here." />
          ) : (
            <ul className="flex flex-col">
              {activity.map((a) => {
                const actor = data.users.find((u) => u.id === a.actorId);
                const task = a.taskId ? data.tasks.find((t) => t.id === a.taskId) : undefined;
                return (
                  <li key={a.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      disabled={!task}
                      onClick={() => task && requestOpenTask(task.id)}
                      className="flex w-full items-baseline gap-2 rounded-md px-2 py-2.5 text-left text-sm enabled:hover:bg-sunken"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{actor?.name ?? "Someone"}</span> {a.text}
                        {task ? <span className="text-muted"> · {task.key}</span> : null}
                      </span>
                      <time dateTime={a.at} className="shrink-0 text-xs text-muted">{formatRelative(a.at, now)}</time>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Projects" id="projects" className="mt-10" action={<Link href="/projects" className="text-sm underline underline-offset-4">All projects</Link>}>
        <ul className="grid gap-3 md:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </ul>
      </Section>
    </Page>
  );
}
