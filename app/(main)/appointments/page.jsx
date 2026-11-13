
import { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getIntervieweeAppointments } from "@/actions/appointments";
import { AppointmentCard } from "@/components/AppointmentCard";
import PageHeader from "@/components/reusables";
import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";

export default function MyAppointmentsPage() {
  return (
    <main className="min-h-screen bg-background">
      <PageHeader
        label="My appointments"
        gray="Your interview"
        gold="sessions"
        description="All your upcoming and past mock interviews in one place."
      />

      <div className="max-w-6xl mx-auto px-8 lg:px-0 py-8">
        <Suspense fallback={<AppointmentsLoading />}>
          <AppointmentsContent />
        </Suspense>
      </div>
    </main>
  );
}

async function AppointmentsContent() {
  const user = await currentUser();

  if (!user) redirect("/");

  const appointments = await getIntervieweeAppointments();
  const now = new Date();

  const scheduled = appointments.filter(
    (a) =>
      a.status === "SCHEDULED" &&
      new Date(a.startTime) > now
  );

  const past = appointments.filter(
    (a) =>
      a.status !== "SCHEDULED" ||
      new Date(a.endTime) <= now
  );

  return (
    <div className="flex flex-col gap-14">
      {/* Empty state */}
      {appointments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-28 gap-5 text-center">
          <span className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-3xl">
            <CalendarDays size={28} className="text-brand" />
          </span>

          <div>
            <p className="text-base text-muted-foreground font-light">
              No sessions booked yet.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Browse expert interviewers and book your first session.
            </p>
          </div>

          <Button variant="gold" asChild>
            <Link href="/explore">Browse interviewers →</Link>
          </Button>
        </div>
      )}

      {/* Upcoming */}
      {scheduled.length > 0 && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">
              Upcoming ({scheduled.length})
            </p>
            <div className="flex-1 h-px bg-muted" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {scheduled.map((b) => (
              <AppointmentCard
                key={b.id}
                booking={b}
                mode="interviewee"
              />
            ))}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">
              Past ({past.length})
            </p>
            <div className="flex-1 h-px bg-muted" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {past.map((b) => (
              <AppointmentCard
                key={b.id}
                booking={b}
                mode="interviewee"
                isPast={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AppointmentsLoading() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <p className="text-muted-foreground">
        Loading your appointments...
      </p>
    </div>
  );
}
