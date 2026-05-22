import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  accent?: boolean;
  className?: string;
};

export default function StatCard({
  label,
  value,
  delta,
  deltaPositive,
  accent,
  className,
}: Props) {
  if (accent) {
    return (
      <div className={cn("stat-card-accent", className)}>
        <p className="text-sm font-medium text-orange-100">{label}</p>
        <p className="font-serif text-3xl font-bold tracking-tight">{value}</p>
        {delta && (
          <p className="text-xs font-semibold text-orange-100">{delta}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("stat-card", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </p>
      <p className="font-serif text-3xl font-bold tracking-tight">{value}</p>
      {delta && (
        <p
          className={cn(
            "text-xs font-semibold",
            deltaPositive ? "text-emerald-600" : "text-red-500"
          )}
        >
          {delta}
        </p>
      )}
    </div>
  );
}
