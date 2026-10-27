import { UserCircle } from "@phosphor-icons/react";
import type { Tint, User } from "@/lib/types";
import { cn, initials, tintFor } from "@/lib/utils";

export const TINT_BG: Record<Tint, string> = {
  sky: "bg-sky",
  ice: "bg-ice",
  stone: "bg-stone",
  cream: "bg-cream",
  sage: "bg-sage",
  peach: "bg-peach",
  butter: "bg-butter",
  lilac: "bg-lilac",
};

const SIZE = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
} as const;

export function Avatar({ name, size = "sm", className }: { name: string; size?: keyof typeof SIZE; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-pill font-medium text-ink",
        TINT_BG[tintFor(name)],
        SIZE[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Assignee display: avatar for a person, a dashed placeholder when nobody owns the task. */
export function AssigneeAvatar({ user, size = "sm" }: { user: User | null | undefined; size?: keyof typeof SIZE }) {
  if (!user) {
    return (
      <span
        title="Unassigned"
        role="img"
        aria-label="Unassigned"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-pill border border-dashed border-line-strong text-muted",
          SIZE[size],
        )}
      >
        <UserCircle size={size === "xs" ? 12 : 16} />
      </span>
    );
  }
  return (
    <span title={user.name} role="img" aria-label={user.name} className="inline-flex">
      <Avatar name={user.name} size={size} />
    </span>
  );
}

export function UserChip({ user, className }: { user: User | null | undefined; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <AssigneeAvatar user={user} />
      <span className="truncate">{user?.name ?? "Unassigned"}</span>
    </span>
  );
}
