import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  href?: string;
  className?: string;
  variant?: "default" | "light";
};

export default function Logo({ href = "/", className, variant = "default" }: Props) {
  const inner = (
    <>
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold shadow-sm",
          variant === "light"
            ? "bg-white text-orange-600"
            : "bg-[var(--color-brand)] text-white"
        )}
      >
        ₿
      </span>
      <span
        className={cn(
          "font-serif text-xl font-bold tracking-tight",
          variant === "light" ? "text-white" : "text-[var(--color-ink)]"
        )}
      >
        iPayX
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn("flex items-center gap-2.5 transition opacity-90 hover:opacity-100", className)}>
        {inner}
      </Link>
    );
  }

  return <div className={cn("flex items-center gap-2.5", className)}>{inner}</div>;
}
