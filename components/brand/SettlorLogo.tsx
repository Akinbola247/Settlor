import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { APP } from "@/lib/settlor-config";

const SIZE_PX = { sm: 32, md: 36, lg: 40, xl: 48 } as const;

export type LogoSize = keyof typeof SIZE_PX | number;

function resolveSize(size: LogoSize): number {
  return typeof size === "number" ? size : SIZE_PX[size];
}

type MarkProps = {
  size?: LogoSize;
  className?: string;
};

export function SettlorLogoMark({ size = "md", className }: MarkProps) {
  const px = resolveSize(size);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--color-sidebar)] ring-1 ring-white/10",
        className
      )}
      style={{ width: px, height: px }}
      aria-hidden
    >
      <Image
        src="/settlor-icon.svg"
        alt=""
        width={px}
        height={px}
        className="h-full w-full object-cover"
      />
    </span>
  );
}

type LogoProps = {
  href?: string | null;
  className?: string;
  size?: LogoSize;
  showWordmark?: boolean;
  variant?: "default" | "light";
};

export default function SettlorLogo({
  href = "/",
  className,
  size = "md",
  showWordmark = true,
  variant = "default",
}: LogoProps) {
  const inner = (
    <>
      <SettlorLogoMark size={size} />
      {showWordmark && (
        <span
          className={cn(
            "font-display text-xl font-bold tracking-tight",
            variant === "light" ? "text-white" : "text-[var(--color-ink)]",
            size === "sm" && "text-lg",
            (size === "lg" || size === "xl") && "text-2xl"
          )}
        >
          {APP.name}
        </span>
      )}
    </>
  );

  const rowClass = cn("flex items-center gap-2.5", className);

  if (href) {
    return (
      <Link href={href} className={cn(rowClass, "transition opacity-95 hover:opacity-100")}>
        {inner}
      </Link>
    );
  }

  return <div className={rowClass}>{inner}</div>;
}
