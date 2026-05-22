import Link from "next/link";
import { cn } from "@/lib/utils";

export const IPAYX_ICON_SRC = "/ipayx-icon-orange.svg";

const SIZE_PX = { sm: 32, md: 36, lg: 40, xl: 48 } as const;

export type LogoSize = keyof typeof SIZE_PX | number;

function resolveSize(size: LogoSize): number {
  return typeof size === "number" ? size : SIZE_PX[size];
}

type MarkProps = {
  size?: LogoSize;
  className?: string;
};

/** Orange iPayX icon only */
export function IPayXLogoMark({ size = "md", className }: MarkProps) {
  const px = resolveSize(size);
  return (
    <img
      src={IPAYX_ICON_SRC}
      alt=""
      width={px}
      height={px}
      className={cn("shrink-0 rounded-xl", className)}
      aria-hidden
    />
  );
}

type LogoProps = {
  href?: string | null;
  className?: string;
  size?: LogoSize;
  showWordmark?: boolean;
  variant?: "default" | "light";
};

/** Icon + iPayX wordmark (default brand lockup) */
export default function IPayXLogo({
  href = "/",
  className,
  size = "md",
  showWordmark = true,
  variant = "default",
}: LogoProps) {
  const inner = (
    <>
      <IPayXLogoMark size={size} />
      {showWordmark && (
        <span
          className={cn(
            "font-serif text-xl font-bold tracking-tight",
            variant === "light" ? "text-white" : "text-[var(--color-ink)]",
            size === "sm" && "text-lg",
            (size === "lg" || size === "xl") && "text-2xl"
          )}
        >
          iPayX
        </span>
      )}
    </>
  );

  const rowClass = cn("flex items-center gap-2.5", className);

  if (href) {
    return (
      <Link href={href} className={cn(rowClass, "transition opacity-90 hover:opacity-100")}>
        {inner}
      </Link>
    );
  }

  return <div className={rowClass}>{inner}</div>;
}
