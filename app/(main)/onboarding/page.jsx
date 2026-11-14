import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { PageLoader } from "@/components/ui/loading-spinner";
import OnboardingForm from "./OnboardingForm";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading onboarding" />}>
      <OnboardingContent />
    </Suspense>
  );
}

async function OnboardingContent() {
  await auth.protect();
  return <OnboardingForm />;
}
