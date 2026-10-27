import {
  CellSignalFull,
  CellSignalLow,
  CellSignalMedium,
  Calendar,
  CheckCircle,
  Circle,
  CircleHalf,
  Eye,
  Minus,
  PauseCircle,
  Prohibit,
  Tray,
  WarningCircle,
  LinkSimple,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { EffectiveState, Priority, Project, ProjectStatus, Status, Tint } from "@/lib/types";
import {
  PRIORITY_LABEL,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TINT,
  STATUS_LABEL,
  STATUS_TINT,
  cn,
  describeDue,
  labelTint,
} from "@/lib/utils";
import { TINT_BG } from "./avatar";

/** Pill label. Colour is always paired with text and usually an icon. */
export function Tag({
  tint = "stone",
  icon,
  children,
  className,
  title,
}: {
  tint?: Tint;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium text-ink",
        TINT_BG[tint],
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

const STATUS_ICON: Record<Status, ReactNode> = {
  todo: <Circle size={13} />,
  in_progress: <CircleHalf size={13} weight="fill" />,
  in_review: <Eye size={13} />,
  done: <CheckCircle size={13} weight="fill" />,
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Tag tint={STATUS_TINT[status]} icon={STATUS_ICON[status]} className={className}>
      {STATUS_LABEL[status]}
    </Tag>
  );
}

/** Display state. Backlog, On hold, Blocked and Done each get a distinct icon and tint. */
const STATE_META: Record<Exclude<EffectiveState, "active">, { label: string; tint: Tint; icon: ReactNode }> = {
  backlog: { label: "Backlog", tint: "ice", icon: <Tray size={13} /> },
  done: { label: "Done", tint: "sage", icon: <CheckCircle size={13} weight="fill" /> },
  on_hold: { label: "On hold", tint: "butter", icon: <PauseCircle size={13} weight="fill" /> },
  blocked: { label: "Blocked", tint: "peach", icon: <Prohibit size={13} weight="bold" className="text-signal" /> },
};

export function StateBadge({ state, className }: { state: Exclude<EffectiveState, "active">; className?: string }) {
  const m = STATE_META[state];
  return (
    <Tag tint={m.tint} icon={m.icon} className={className}>
      {m.label}
    </Tag>
  );
}

export function StatusDot({ tint }: { tint: Tint }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-pill", TINT_BG[tint])} />;
}

const PRIORITY_ICON: Record<Priority, ReactNode> = {
  urgent: <WarningCircle size={15} weight="fill" className="text-signal" />,
  high: <CellSignalFull size={15} />,
  medium: <CellSignalMedium size={15} />,
  low: <CellSignalLow size={15} />,
  none: <Minus size={15} className="text-muted" />,
};

export function PriorityIcon({ priority }: { priority: Priority }) {
  return <span className="inline-flex shrink-0">{PRIORITY_ICON[priority]}</span>;
}

export function PriorityIndicator({
  priority,
  showLabel = true,
  className,
}: {
  priority: Priority;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <span
      title={`Priority: ${PRIORITY_LABEL[priority]}`}
      className={cn("inline-flex items-center gap-1.5 text-xs", priority === "urgent" ? "font-medium text-signal" : "text-ink", className)}
    >
      <PriorityIcon priority={priority} />
      {showLabel ? <span>{PRIORITY_LABEL[priority]}</span> : <span className="sr-only">{PRIORITY_LABEL[priority]}</span>}
    </span>
  );
}

export function ProjectBadge({ project, className }: { project: Pick<Project, "key" | "name" | "tint"> | undefined; className?: string }) {
  if (!project) return null;
  return (
    <span title={project.name} className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs text-muted", className)}>
      <StatusDot tint={project.tint} />
      <span className="truncate">{project.name}</span>
    </span>
  );
}

export function ProjectStatusTag({ status }: { status: ProjectStatus }) {
  return <Tag tint={PROJECT_STATUS_TINT[status]}>{PROJECT_STATUS_LABEL[status]}</Tag>;
}

export function LabelTag({ name }: { name: string }) {
  return <Tag tint={labelTint(name)}>{name}</Tag>;
}

/** Due date chip. Overdue gets the orange "needs attention" signal plus an icon and text. */
export function DueDate({
  due,
  today,
  done,
  className,
}: {
  due: string | null;
  today: string;
  done?: boolean;
  className?: string;
}) {
  const d = describeDue(due, today, done);
  if (d.tone === "none") return <span className={cn("text-xs text-muted", className)}>No due date</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        d.tone === "overdue" ? "font-medium text-signal" : d.tone === "soon" ? "text-ink" : "text-muted",
        className,
      )}
    >
      {d.tone === "overdue" ? <WarningCircle size={14} weight="fill" /> : <Calendar size={14} />}
      {d.label}
    </span>
  );
}

export function DependencyChip({ children, tone = "neutral", title }: { children: ReactNode; tone?: "neutral" | "attention"; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        tone === "attention" ? "font-medium text-signal" : "text-muted",
      )}
    >
      <LinkSimple size={14} />
      {children}
    </span>
  );
}
