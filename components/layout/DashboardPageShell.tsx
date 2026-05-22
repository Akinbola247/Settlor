import { cn } from "@/lib/utils";

type Size = "narrow" | "default" | "wide" | "full";

const WIDTH: Record<Size, string> = {
  narrow: "max-w-2xl",
  default: "max-w-4xl",
  wide: "max-w-5xl",
  full: "max-w-6xl",
};

type Props = {
  children: React.ReactNode;
  size?: Size;
  /** Center page title block */
  centeredHeader?: boolean;
  className?: string;
};

export default function DashboardPageShell({
  children,
  size = "default",
  centeredHeader = false,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        WIDTH[size],
        centeredHeader && "[&>header]:text-center",
        className
      )}
    >
      {children}
    </div>
  );
}
