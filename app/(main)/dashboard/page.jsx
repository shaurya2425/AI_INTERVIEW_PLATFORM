import { PageLoader } from "@/components/ui/loading-spinner";

import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";

import PageHeader from "@/components/reusables";

import {
  getAvailability,
  getInterviewerAppointments,
  getInterviewerStats,
  getWithdrawalHistory,
} from "@/actions/dashboard";

import { getCurrentUser } from "@/actions/user";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import AvailabilitySection from "./components/AvailabilitySection";
import AppointmentsSection from "./components/AppointmentSection";
import EarningsSection from "./components/EarningSection";

import {
  ClipboardList,
  Clock,
  Wallet,
} from "lucide-react";

// Lightweight parent page
export default function InterviewerDashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}

// All request-dependent operations happen inside Suspense
async function DashboardContent() {
  await auth.protect();

  const dbUser = await getCurrentUser();

  const [
    availability,
    appointments,
    stats,
    withdrawalHistory,
  ] = await Promise.all([
    getAvailability(),
    getInterviewerAppointments(),
    getInterviewerStats(),
    getWithdrawalHistory(),
  ]);

  return (
    <main className="min-h-screen w-full bg-background">
      {/* Page Header */}
      <PageHeader
        label="Interviewer dashboard"
        gray="Welcome back,"
        gold={dbUser.name?.split(" ")[0] ?? "Interviewer"}
        description={
          dbUser.title && dbUser.company
            ? `${dbUser.title} · ${dbUser.company}`
            : undefined
        }
        right={
          <div>
            <p className="text-xs text-muted-foreground">
              Credit balance
            </p>

            <p className="text-right font-serif text-3xl leading-none bg-linear-to-br from-gold-start to-gold-end bg-clip-text text-transparent">
              {stats?.creditBalance ?? 0}
            </p>
          </div>
        }
      />

      {/* Dashboard Content */}
      <div className="mx-auto w-full max-w-6xl px-6 py-8 md:px-8">
        <Tabs
          defaultValue="earnings"
          className="!flex !w-full !flex-col gap-8"
        >
          {/* Horizontal Tabs */}
          <TabsList className="grid h-auto min-h-10 w-full grid-cols-3 bg-card border border-border rounded-xl p-1">
            <TabsTrigger
              value="earnings"
              className="flex items-center justify-center gap-2 py-3"
            >
              <Wallet size={16} className="text-brand" />
              Earnings
            </TabsTrigger>

            <TabsTrigger
              value="appointments"
              className="flex items-center justify-center gap-2 py-3"
            >
              <ClipboardList size={16} className="text-brand" />
              Appointments
            </TabsTrigger>

            <TabsTrigger
              value="availability"
              className="flex items-center justify-center gap-2 py-3"
            >
              <Clock size={16} className="text-brand" />
              Availability
            </TabsTrigger>
          </TabsList>

          {/* Earnings */}
          <TabsContent
            value="earnings"
            className="mt-0 w-full min-w-0"
          >
            <EarningsSection
              stats={stats}
              history={withdrawalHistory}
            />
          </TabsContent>

          {/* Appointments */}
          <TabsContent
            value="appointments"
            className="mt-0 w-full min-w-0"
          >
            <AppointmentsSection
              appointments={appointments}
            />
          </TabsContent>

          {/* Availability */}
          <TabsContent
            value="availability"
            className="mt-0 w-full min-w-0"
          >
            <AvailabilitySection
              initial={availability}
            />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function DashboardLoading() {
  return <PageLoader label="Loading your dashboard" className="min-h-screen" />;
}
