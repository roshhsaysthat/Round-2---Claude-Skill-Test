"use client";

import { CheckSquare, FolderSimple, GearSix, House, Tray } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

/**
 * Primary navigation for the main workspace destinations.
 * "On hold" and "Blocked" deliberately live inside My Tasks, not here.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { me } = useApp();

  const items: NavItem[] = [
    { href: "/", label: "Home", icon: <House size={18} /> },
    { href: "/my-tasks", label: "My Tasks", icon: <CheckSquare size={18} /> },
    { href: "/projects", label: "Projects", icon: <FolderSimple size={18} /> },
    { href: "/backlog", label: "Backlog", icon: <Tray size={18} /> },
    { href: "/settings", label: "Settings", icon: <GearSix size={18} /> },
  ];

  const isActive = (href: string): boolean => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-3 pb-5 pt-1">
        <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-md bg-ink font-display text-sm text-surface">
          T
        </span>
        <span className="font-display text-xl tracking-[-0.045em]">Taskflow</span>
      </div>
      <nav aria-label="Primary" className="flex-1">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-pill px-3.5 text-sm transition-colors duration-150 [@media(pointer:coarse)]:h-11",
                    active ? "bg-ink font-medium text-surface" : "text-muted hover:bg-sunken hover:text-ink",
                  )}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-4 flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
        <Avatar name={me.name} size="md" />
        <div className="min-w-0 text-sm leading-tight">
          <p className="truncate font-medium">{me.name}</p>
          <p className="truncate text-xs text-muted">{me.role}</p>
        </div>
      </div>
    </div>
  );
}
