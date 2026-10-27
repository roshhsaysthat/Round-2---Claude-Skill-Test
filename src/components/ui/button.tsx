"use client";

import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-ink text-surface hover:bg-ink/85",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-sunken",
  ghost: "bg-transparent text-ink hover:bg-sunken",
  danger: "bg-surface text-danger border border-danger/40 hover:bg-danger/5",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
};

const BASE =
  "inline-flex shrink-0 select-none items-center justify-center rounded-pill font-medium whitespace-nowrap " +
  "transition-[background-color,transform,opacity] duration-150 ease-ds active:scale-[0.97] " +
  "disabled:pointer-events-none disabled:opacity-45 [@media(pointer:coarse)]:min-h-11";

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra?: string): string {
  return cn(BASE, VARIANT[variant], SIZE[size], extra);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  trailing?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = "secondary", size = "md", icon, trailing, className, children, type = "button", ref, ...rest }: ButtonProps) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
      {trailing}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  size?: "sm" | "md";
  variant?: "ghost" | "secondary";
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({ size = "md", variant = "ghost", className, children, type = "button", ref, ...rest }: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        BASE,
        variant === "ghost" ? VARIANT.ghost : VARIANT.secondary,
        size === "sm" ? "size-8" : "size-10",
        "text-[18px] [@media(pointer:coarse)]:min-w-11",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
