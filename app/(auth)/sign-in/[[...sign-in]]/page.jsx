import { PageLoader } from "@/components/ui/loading-spinner";

import { Suspense } from "react";
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <Suspense fallback={<PageLoader label="Loading sign in" />}>
      <SignIn />
    </Suspense>
  );
}
