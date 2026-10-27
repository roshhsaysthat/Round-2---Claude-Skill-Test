import { CaretRight } from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The one two-tone heading per page: soft grey lead-in, ink finish. */
export function TwoToneTitle({ soft, strong }: { soft: string; strong: string }) {
  return (
    <h1 className="text-[clamp(1.75rem,3.2vw,2.5rem)] leading-[1.05]">
      <span className="text-soft">{soft}</span> {strong}
    </h1>
  );
}

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-muted">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="inline-flex items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="rounded-sm hover:text-ink hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "text-ink" : undefined}>
                  {c.label}
                </span>
              )}
              {!last ? <CaretRight aria-hidden size={11} /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  className?: string;
}) {
  return (
    <header className={cn("mb-6", className)}>
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {title}
          {description ? <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Page({ children, wide, className }: { children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <div className={cn("mx-auto w-full px-4 py-6 sm:px-6", wide ? "max-w-none" : "max-w-[1240px]", className)}>{children}</div>
  );
}

/** A titled region of a page. Uses a hairline, not a card, to separate. */
export function Section({
  title,
  action,
  children,
  className,
  id,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section aria-labelledby={headingId} className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-xl">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
