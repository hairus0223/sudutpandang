"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PanelSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2.5", className)}>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/70">
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-[11px] text-white/45">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-1 rounded-lg bg-white/5 p-1",
        className
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "min-h-[36px] flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition",
            value === opt.id
              ? "bg-violet-600 text-white shadow-sm"
              : "text-white/70 hover:bg-white/10 hover:text-white"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function ChipButton({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-medium transition whitespace-nowrap",
        active
          ? "bg-green-600 text-white"
          : "bg-white/10 text-white/80 hover:bg-white/20",
        className
      )}
    >
      {children}
    </button>
  );
}

export const panelShellClass =
  "flex h-full flex-col overflow-hidden border-white/10 bg-neutral-950/80";

export const panelScrollClass = "flex-1 overflow-y-auto overflow-x-hidden p-3";
