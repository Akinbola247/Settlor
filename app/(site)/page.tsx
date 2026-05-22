import { OAuthReturnRedirect } from "@/components/auth/AuthRedirects";
import LandingPage from "@/components/marketing/LandingPage";
import { getPlatformMetrics } from "@/lib/platform-metrics";

export const revalidate = 60;

export default async function HomePage() {
  const metrics = await getPlatformMetrics();

  return (
    <>
      <OAuthReturnRedirect />
      <LandingPage metrics={metrics} />
    </>
  );
}
