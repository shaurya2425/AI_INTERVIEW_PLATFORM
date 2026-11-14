import { PageLoader } from "@/components/ui/loading-spinner";

import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";

import { getInterviewers } from "@/actions/explore";
import PageHeader from "@/components/reusables";
import ExploreGrid from "./components/ExploreGrid";

export default function ExplorePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Page header */}
      <PageHeader
        label="Explore"
        gray="Find your"
        gold="expert interviewer"
        description="Browse senior engineers from top companies."
      />

      {/* Dynamic content */}
      <div className="max-w-6xl mx-auto px-8 xl:px-0 py-10">
        <Suspense fallback={<ExploreLoading />}>
          <ExploreContent />
        </Suspense>
      </div>
    </main>
  );
}

async function ExploreContent() {
  await auth.protect();
  const interviewers = await getInterviewers();

  return <ExploreGrid interviewers={interviewers} />;
}

function ExploreLoading() {
  return <PageLoader label="Loading interviewers" className="min-h-[300px]" />;
}
