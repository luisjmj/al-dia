import * as Icons from "lucide-react";
import type { ReactNode } from "react";
import { categoryById } from "../lib/seed";

// Icono dinámico por nombre de lucide
export function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Cmp = (Icons as Record<string, any>)[name] ?? Icons.Tag;
  return <Cmp className={className} />;
}

export function CategoryBadge({ id }: { id: string }) {
  const c = categoryById(id);
  return (
    <span
      className="chip"
      style={{ backgroundColor: `${c.color}22`, color: c.color }}
    >
      <Icon name={c.icon} className="w-3.5 h-3.5" />
      {c.label}
    </span>
  );
}

export function ProgressBar({
  value,
  color = "rgb(var(--brand))",
}: {
  value: number; // 0..1
  color?: string;
}) {
  return (
    <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${Math.min(100, Math.max(0, value * 100))}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        {icon && (
          <span
            className="w-8 h-8 rounded-lg grid place-items-center"
            style={{
              backgroundColor: accent ? `${accent}22` : "rgb(var(--surface-2))",
              color: accent ?? "rgb(var(--muted))",
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="text-2xl font-extrabold tracking-tight">{value}</div>
      {sub && <div className="text-sm">{sub}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-surface flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-text">
            <Icons.X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="card p-10 text-center">
      <div className="text-text font-semibold">{title}</div>
      {hint && <div className="text-sm text-muted mt-1">{hint}</div>}
    </div>
  );
}
