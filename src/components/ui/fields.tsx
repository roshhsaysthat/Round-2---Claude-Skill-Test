"use client";

import { CalendarBlank, CaretDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import {
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn, formatDate } from "@/lib/utils";

/* ---------------------------------- Field --------------------------------- */

/** Label + control + hint/error wiring. The label is always present (visually hidden when compact). */
export function Field({
  label,
  hint,
  error,
  hideLabel,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  hideLabel?: boolean;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-[13px] font-medium text-ink", hideLabel && "sr-only")}>
        {label}
        {required ? <span aria-hidden className="text-signal"> *</span> : null}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL =
  "w-full rounded-md border border-line-strong bg-surface text-ink placeholder:text-muted " +
  "transition-colors duration-150 hover:border-ink/40 focus:border-ink disabled:opacity-50 aria-[invalid=true]:border-danger";

export function Input({ className, ref, ...rest }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(CONTROL, "h-10 px-3 text-sm", className)} {...rest} />;
}

export function Textarea({ className, ref, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cn(CONTROL, "min-h-24 resize-y px-3 py-2 text-sm leading-relaxed", className)} {...rest} />;
}

/** Native select styled with tokens. Compact variant is for table cells and filter bars. */
export function SelectField({
  className,
  compact,
  children,
  ref,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean; ref?: Ref<HTMLSelectElement> }) {
  return (
    <span className={cn("relative inline-flex w-full min-w-0", className)}>
      <select
        ref={ref}
        className={cn(
          CONTROL,
          "cursor-pointer appearance-none pr-8 text-ink",
          compact ? "h-8 rounded-sm pl-2 text-[13px]" : "h-10 pl-3 text-sm",
        )}
        {...rest}
      >
        {children}
      </select>
      <CaretDown aria-hidden size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
    </span>
  );
}

export function DateInput({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <Input type="date" className={cn("min-w-0", className)} {...rest} />;
}

export function Checkbox({
  label,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  return (
    <label className={cn("inline-flex min-h-6 cursor-pointer items-center gap-2 text-sm text-ink [@media(pointer:coarse)]:min-h-11", className)}>
      <input type="checkbox" className="size-4 shrink-0 cursor-pointer accent-ink" {...rest} />
      <span>{label}</span>
    </label>
  );
}

/* ------------------------------- Search field ------------------------------ */

export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder = "Search",
  label = "Search",
  className,
  inputRef,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  inputRef?: Ref<HTMLInputElement>;
  autoFocus?: boolean;
}) {
  return (
    <form
      role="search"
      className={cn("relative flex w-full items-center", className)}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(value);
      }}
    >
      <MagnifyingGlass aria-hidden size={16} className="pointer-events-none absolute left-3 text-muted" />
      <input
        ref={inputRef}
        type="search"
        aria-label={label}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            e.stopPropagation();
            onChange("");
          }
        }}
        className={cn(CONTROL, "h-10 rounded-pill pl-9 pr-9 text-sm [&::-webkit-search-cancel-button]:hidden")}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-1.5 inline-flex size-7 items-center justify-center rounded-pill text-muted hover:bg-sunken hover:text-ink"
        >
          <X size={14} />
        </button>
      ) : null}
    </form>
  );
}

/* ----------------------------- Pills (inline pickers) ---------------------- */

const PILL =
  "relative inline-flex h-8 max-w-full items-center gap-1.5 rounded-pill border bg-surface px-3 text-[13px] text-ink " +
  "transition-colors duration-150 hover:border-ink/40 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink " +
  "[@media(pointer:coarse)]:h-11";

/** Chip-style picker. A native select sits invisibly on top, so it stays fully keyboard and screen reader accessible. */
export function PillSelect({
  label,
  value,
  onChange,
  options,
  icon,
  display,
  className,
  muted,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  icon?: ReactNode;
  display?: ReactNode;
  className?: string;
  /** Style as "not set yet". */
  muted?: boolean;
  disabled?: boolean;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <span className={cn(PILL, muted ? "border-line text-muted" : "border-line-strong", disabled && "opacity-50", className)}>
      {icon}
      <span className="truncate">{display ?? current?.label ?? label}</span>
      <CaretDown aria-hidden size={11} className="shrink-0 text-muted" />
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

/** Chip-style date picker backed by a native date input. Includes a clear button when set. */
export function PillDate({
  label,
  value,
  onChange,
  min,
  className,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  min?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span className={cn("inline-flex items-center", className)}>
      <span className={cn(PILL, value ? "border-line-strong pr-2" : "border-line text-muted", value && "rounded-r-none border-r-0")}>
        <CalendarBlank aria-hidden size={14} />
        <span>{value ? formatDate(value) : label}</span>
        <input
          ref={ref}
          type="date"
          aria-label={label}
          value={value ?? ""}
          min={min}
          onChange={(e) => onChange(e.target.value || null)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          onClick={(e) => {
            try {
              e.currentTarget.showPicker?.();
            } catch {
              // showPicker can throw if the input isn't user-activated. The native control still works.
            }
          }}
        />
      </span>
      {value ? (
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => onChange(null)}
          className="inline-flex h-8 items-center rounded-r-pill border border-l-0 border-line-strong bg-surface pl-1 pr-2 text-muted hover:text-ink [@media(pointer:coarse)]:h-11"
        >
          <X size={12} />
        </button>
      ) : null}
    </span>
  );
}
