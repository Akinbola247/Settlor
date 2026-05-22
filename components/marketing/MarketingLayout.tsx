import MarketingNavbar from "./MarketingNavbar";
import MarketingFooter from "./MarketingFooter";

type Props = {
  children: React.ReactNode;
};

export default function MarketingLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <MarketingNavbar />
      <div className="pt-16">{children}</div>
      <MarketingFooter />
    </div>
  );
}
