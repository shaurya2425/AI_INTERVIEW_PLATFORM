import { PageLoader } from "@/components/ui/loading-spinner";
import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";

import { getCallData } from "@/actions/call";
import CallRoom from "./components/CallRoom";

// Parent page remains lightweight.
// Runtime-dependent work happens inside CallContent.
export default function CallPage({ params }) {
  return (
    <Suspense fallback={<CallLoading />}>
      <CallContent params={params} />
    </Suspense>
  );
}

// Handles dynamic route parameters and authenticated data.
async function CallContent({ params }) {
  const { callId } = await params;

  const result = await getCallData(callId);

  if (result.error === "Unauthorized") {
    redirect("/");
  }

  if (result.error === "Call not found") {
    notFound();
  }

  if (result.error === "Forbidden") {
    redirect("/");
  }

  if (result.error) {
    throw new Error("Unable to load interview data");
  }

  const { token, currentUser, booking, isInterviewer } = result;

  return (
    <CallRoom
      callId={callId}
      token={token}
      apiKey={process.env.NEXT_PUBLIC_STREAM_API_KEY}
      currentUser={currentUser}
      booking={booking}
      isInterviewer={isInterviewer}
    />
  );
}

// Shown while interview data is being loaded.
function CallLoading() {
  return <PageLoader label="Loading interview room" className="min-h-screen" />;
}
