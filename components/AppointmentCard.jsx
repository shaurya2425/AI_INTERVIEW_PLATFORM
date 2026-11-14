"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Video, Sparkles } from "lucide-react";
import { FeedbackModal } from "./FeedbackModal";
import { getMeetingFeedback } from "@/actions/feedback";
import useFetch from "@/hooks/use-fetch";
import { formatDate, formatDuration, formatTime } from "@/lib/helpers";
import { RATING_LABEL, RATING_STYLES, STATUS_STYLES } from "@/lib/data";

export function AppointmentCard({ booking, mode, isPast = false }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { has } = useAuth();
  const { data: feedbackResult, loading: feedbackLoading, error: feedbackError, fn: loadFeedback } = useFetch(getMeetingFeedback);

  const {
    startTime,
    endTime,
    status,
    creditsCharged,
    streamCallId,
    recordingUrl,
    feedback: savedFeedback,
  } = booking;
  const feedback = feedbackResult?.feedback ?? savedFeedback;
  const canViewFeedback = Boolean(isPast || feedback || status !== "SCHEDULED");
  const feedbackMessage = feedbackError || feedbackResult?.message || (status === "CANCELLED"
    ? "This meeting was cancelled. No interview feedback is available."
    : "Feedback is not available yet. View feedback to check the meeting status and retrieve its report.");
  const statusLabel = feedback ? "Completed" : feedbackResult?.state === "missed"
    ? "Not held" : isPast && status === "SCHEDULED" ? "Ended" : status.charAt(0) + status.slice(1).toLowerCase();
  const openFeedback = () => {
    setFeedbackOpen(true);
    if (!feedback && !feedbackLoading) loadFeedback(booking.id);
  };

  const person =
    mode === "interviewer" ? booking.interviewee : booking.interviewer;

  const creditsLabel =
    mode === "interviewer"
      ? `+${creditsCharged} credits earned`
      : `−${creditsCharged} credits`;

  const creditsStyle =
    mode === "interviewer"
      ? "border-green-500/20 bg-green-500/10 text-success"
      : "border-amber-400/20 bg-amber-400/5 text-brand";

  const isUpcoming = status === "SCHEDULED";

  return (
    <>
      <FeedbackModal
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        feedback={feedback}
        message={feedbackMessage}
        loading={feedbackLoading}
        onRetry={() => loadFeedback(booking.id)}
        intervieweeName={
          mode === "interviewer" ? booking.interviewee?.name : undefined
        }
      />

      <article className="group relative bg-card border border-border transition-all duration-300 hover:-translate-y-0.5 rounded-2xl bg-linear-to-t from-transparent via-transparent to-amber-300/10 p-7 flex flex-col gap-6 self-start">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar className="w-14 h-14 border border-border rounded-2xl shrink-0">
              <AvatarImage
                src={person?.imageUrl}
                alt={person?.name}
                className="rounded-2xl"
              />
              <AvatarFallback className="rounded-2xl bg-amber-400/10 border border-amber-400/20 text-brand text-lg font-medium">
                {person?.name?.[0] ?? "?"}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-base font-medium text-foreground leading-tight truncate">
                {person?.name ?? "—"}
              </p>
              {person?.title && person?.company ? (
                <p className="text-xs text-muted-foreground truncate">
                  {person.title}
                  <span className="text-muted-foreground mx-1.5">·</span>
                  {person.company}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground truncate">
                  {person?.email}
                </p>
              )}
              {mode === "interviewee" && person?.categories?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {person.categories.slice(0, 3).map((cat) => (
                    <span
                      key={cat}
                      className="text-[10px] px-2 py-0.5 rounded-md border border-amber-400/20 bg-amber-400/5 text-brand leading-tight"
                    >
                      {cat.replace("_", " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge variant="outline" className={STATUS_STYLES[status]}>
              {statusLabel}
            </Badge>
            <Badge variant="outline" className={creditsStyle}>
              {creditsLabel}
            </Badge>
          </div>
        </div>

        <div className="h-px bg-muted" />

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar size={12} />
              <span className="text-[10px] font-semibold tracking-widest uppercase">
                Date
              </span>
            </div>
            <p className="text-sm text-foreground">{formatDate(startTime)}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock size={12} />
              <span className="text-[10px] font-semibold tracking-widest uppercase">
                Time
              </span>
            </div>
            <p className="text-sm text-foreground">
              {formatTime(startTime)}
              <span className="text-muted-foreground mx-1">–</span>
              {formatTime(endTime)}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Video size={12} />
              <span className="text-[10px] font-semibold tracking-widest uppercase">
                Duration
              </span>
            </div>
            <p className="text-sm text-foreground">
              {formatDuration(startTime, endTime)}
            </p>
          </div>
        </div>

        {(feedback?.summary || canViewFeedback) && (
          <div className="rounded-xl border border-border bg-surface px-4 py-3 flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">
              {feedback ? "AI Feedback" : "Meeting feedback"}
            </p>
            <p className="text-xs text-muted-foreground font-light leading-relaxed line-clamp-2">
              {feedback?.summary || feedbackMessage}
            </p>
          </div>
        )}

        {(streamCallId || recordingUrl || canViewFeedback) && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {!isPast && streamCallId && isUpcoming && (
              <Button variant="gold" size="sm" className="gap-2" asChild>
                <Link href={`/call/${streamCallId}`}>
                  <Video size={13} />
                  Join call
                </Link>
              </Button>
            )}

            {recordingUrl && has?.({ plan: "pro" }) && (
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a
                  href={recordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📹 Recording
                </a>
              </Button>
            )}

            {canViewFeedback && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-amber-400/20 text-brand hover:bg-amber-400/10 hover:border-amber-400/40"
                    onClick={openFeedback}
                  >
                    <Sparkles size={12} />
                    {feedback ? "Full Feedback" : "View feedback"}
                  </Button>
                  {feedback && <Badge
                    variant="outline"
                    className={RATING_STYLES[feedback.overallRating]}
                  >
                    ✦ {RATING_LABEL[feedback.overallRating]} performance
                  </Badge>}
                </>
              )}
          </div>
        )}
      </article>
    </>
  );
}
