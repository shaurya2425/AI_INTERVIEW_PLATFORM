import { PageLoader } from "@/components/ui/loading-spinner";

import { Suspense } from "react";
import { db } from "@/lib/prisma";
import { getDisplayName } from "@/lib/user-name";
import { notFound } from "next/navigation";
import PayoutReviewClient from "./components/PayoutReviewClient";
import {
  GoldTitle,
  GrayTitle,
  SectionLabel,
} from "@/components/reusables";

export default function PayoutReviewPage({ params }) {
  return (
    <Suspense fallback={<PayoutLoading />}>
      <PayoutReviewContent params={params} />
    </Suspense>
  );
}

async function PayoutReviewContent({ params }) {
  const { id } = await params;

  const payout = await db.payout.findUnique({
    where: { id },
    include: {
      interviewer: {
        select: { name: true, email: true },
      },
    },
  });

  if (!payout) notFound();

  return (
    <main className="min-h-screen bg-background text-foreground antialiased px-6 flex items-center justify-center">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <SectionLabel>Admin</SectionLabel>
          <h1 className="font-serif text-4xl tracking-tighter mt-1">
            <GrayTitle>Review </GrayTitle>
            <GoldTitle>Withdrawal</GoldTitle>
          </h1>
        </div>

        <PayoutReviewClient
          payout={{
            id: payout.id,
            credits: payout.credits,
            netAmount: payout.netAmount,
            platformFee: payout.platformFee,
            paymentMethod: payout.paymentMethod,
            paymentDetail: payout.paymentDetail,
            status: payout.status,
            interviewerName: getDisplayName(payout.interviewer.name),
            interviewerEmail: payout.interviewer.email,
          }}
        />
      </div>
    </main>
  );
}

function PayoutLoading() {
  return <PageLoader label="Loading payout details" className="min-h-screen" />;
}
