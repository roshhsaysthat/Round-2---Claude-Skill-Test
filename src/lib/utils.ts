import type { Priority, Status, Tint, ProjectStatus } from "./types";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------- Dates ------------------------------- */
/* Dates are stored as "YYYY-MM-DD" (local calendar day). Timestamps are ISO. */

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr(now: Date = new Date()): string {
  return toDateStr(now);
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, days: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function diffDays(a: string, b: string): number {
  // days from b to a
  const ms = parseDate(a).getTime() - parseDate(b).getTime();
  return Math.round(ms / 86_400_000);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(s: string | null, withYear = false): string {
  if (!s) return "";
  const d = parseDate(s);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${withYear ? `, ${d.getFullYear()}` : ""}`;
}

/** Friendly relative label for a due date, plus a tone for styling. */
export function describeDue(
  due: string | null,
  today: string,
  done = false,
): { label: string; tone: "none" | "overdue" | "soon" | "normal" | "done" } {
  if (!due) return { label: "No due date", tone: "none" };
  if (done) return { label: formatDate(due), tone: "done" };
  const delta = diffDays(due, today);
  if (delta < 0) return { label: `${-delta}d overdue`, tone: "overdue" };
  if (delta === 0) return { label: "Due today", tone: "soon" };
  if (delta === 1) return { label: "Due tomorrow", tone: "soon" };
  if (delta <= 7) return { label: `Due ${formatDate(due)}`, tone: "soon" };
  return { label: formatDate(due), tone: "normal" };
}

export function formatRelative(iso: string, nowIso: string): string {
  const diff = new Date(nowIso).getTime() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(toDateStr(new Date(iso)));
}

/* ------------------------------ Labels ------------------------------- */

export const STATUS_ORDER: Status[] = ["todo", "in_progress", "in_review", "done"];

export const STATUS_LABEL: Record<Status, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
};

export const STATUS_TINT: Record<Status, Tint> = {
  todo: "stone",
  in_progress: "sky",
  in_review: "lilac",
  done: "sage",
};

export const PRIORITY_ORDER: Priority[] = ["urgent", "high", "medium", "low", "none"];

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No priority",
};

export const PRIORITY_WEIGHT: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planned: "Planned",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

export const PROJECT_STATUS_TINT: Record<ProjectStatus, Tint> = {
  planned: "ice",
  active: "sage",
  paused: "butter",
  completed: "stone",
};

export const LABEL_CATALOG: { name: string; tint: Tint }[] = [
  { name: "Feature", tint: "ice" },
  { name: "Bug", tint: "peach" },
  { name: "Design", tint: "lilac" },
  { name: "Marketing", tint: "butter" },
  { name: "Ops", tint: "sage" },
  { name: "Research", tint: "sky" },
  { name: "Docs", tint: "cream" },
  { name: "Tech debt", tint: "stone" },
  { name: "Customer", tint: "peach" },
];

export function labelTint(name: string): Tint {
  return LABEL_CATALOG.find((l) => l.name === name)?.tint ?? "stone";
}

export const TINTS: Tint[] = ["sky", "ice", "cream", "sage", "peach", "butter", "lilac", "stone"];

/** Deterministic pastel from a string (avatars, fallback colors). */
export function tintFor(seed: string): Tint {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % (TINTS.length - 1)];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
