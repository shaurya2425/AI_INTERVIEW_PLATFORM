
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import {
  Sparkles,
  TrendingUp,
  MessageSquare,
  Brain,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { GrayTitle } from "@/components/reusables";
import { RATING_CONFIG } from "@/lib/data";
import StarsBackgroundDemo from "./demo-component-stars-background";

function FeedbackSection({ icon, title, children }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
      </div>

      <div className="text-sm text-foreground leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function FeedbackList({
  items = [],
  variant = "strength",
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Insufficient evidence to assess this area.
      </p>
    );
  }

  const isStrength = variant === "strength";

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, index) => (
        <li
          key={index}
          className={`flex items-start gap-3 rounded-lg border p-3 text-sm leading-relaxed ${
            isStrength
              ? "border-green-500/20 bg-green-500/5"
              : "border-red-500/20 bg-red-500/5"
          }`}
        >
          {isStrength ? (
            <CheckCircle2
              size={16}
              className="mt-0.5 shrink-0 text-success"
            />
          ) : (
            <AlertCircle
              size={16}
              className="mt-0.5 shrink-0 text-danger"
            />
          )}

          <span className="flex-1 whitespace-pre-wrap break-words text-foreground">
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function FeedbackModal({
  open,
  onOpenChange,
  feedback,
  intervieweeName,
  message,
  loading = false,
  onRetry,
}) {
  // ----------------------------------------------------------
  // NO REPORT AVAILABLE
  // ----------------------------------------------------------

  if (!feedback) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-background border-border text-foreground sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Meeting feedback
            </DialogTitle>
          </DialogHeader>

          <p
            role="status"
            className="text-sm text-muted-foreground leading-relaxed"
          >
            {loading
              ? "Checking the meeting and preparing available feedback..."
              : message || "Feedback is not available yet."}
          </p>

          {onRetry && (
            <Button
              variant="outline"
              disabled={loading}
              onClick={onRetry}
            >
              {loading ? "Generating..." : "Generate feedback / retry"}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // ----------------------------------------------------------
  // REPORT DATA
  // ----------------------------------------------------------

  const rating = RATING_CONFIG[feedback.overallRating] || {
    label: "Insufficient Evidence",
    className: "border-border",
    bg: "from-surface",
    emoji: "—",
  };

  const report = feedback.report;

  const score = report?.scoring?.overallScore;
  const dualScoring = report?.scoring?.evaluatedPolicyVersion;
  const overallEvaluatedScore = report?.scoring?.overallEvaluatedScore;
  const formattedOverallScore = typeof overallEvaluatedScore === "number" && Number.isFinite(overallEvaluatedScore)
    ? `${overallEvaluatedScore.toFixed(1)} / 100` : "Unassessed";

  const formattedScore =
    typeof score === "number" && Number.isFinite(score)
      ? `${score.toFixed(1)} / 100`
      : "Unavailable";

  const weaknesses = Array.isArray(report?.weaknesses)
    ? report.weaknesses
    : [];

  const strengths = Array.isArray(feedback.strengths)
    ? feedback.strengths
    : [];

  const improvements = Array.isArray(feedback.improvements)
    ? feedback.improvements
    : [];

  const limitations = Array.isArray(report?.limitations)
    ? report.limitations
    : [];

  const isIncomplete =
    report?.state === "INCOMPLETE" ||
    limitations.length > 0;

  // ----------------------------------------------------------
  // FEEDBACK MODAL
  // ----------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border border-amber-200/20 text-foreground sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <StarsBackgroundDemo />

        <DialogHeader className="relative">
          <DialogTitle className="font-serif text-2xl tracking-tight">
            <GrayTitle>
              AI Feedback Report
            </GrayTitle>
          </DialogTitle>

          {intervieweeName && (
            <p className="text-xs text-muted-foreground font-light mt-1">
              Performance analysis for {intervieweeName}
            </p>
          )}
        </DialogHeader>

        <div className="relative flex flex-col gap-5 mt-2">

          {/* STATUS MESSAGE */}

          {(message || loading) && (
            <p
              role="status"
              className="text-sm text-muted-foreground leading-relaxed"
            >
              {loading
                ? "Checking for updated evidence..."
                : message}
            </p>
          )}

          {/* INCOMPLETE REPORT WARNING */}

          {isIncomplete && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle
                  size={15}
                  className="text-amber-500 shrink-0"
                />

                <p className="text-xs font-medium text-foreground">
                  Assessment limitations
                </p>
              </div>

              {limitations.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground leading-relaxed">
                  {limitations.map((limitation, index) => (
                    <li key={index}>
                      {limitation}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Some assessment evidence is unavailable.
                  Interpret this report with caution.
                </p>
              )}
            </div>
          )}

          {/* OVERALL RATING */}

          <div
            className={`rounded-2xl border ${rating.className} bg-linear-to-br ${rating.bg} to-transparent p-6 flex items-center justify-between gap-4`}
          >
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest">
                {dualScoring ? "Overall evaluated rating" : "Saved rating (legacy report)"}
              </p>

              <p className="font-serif text-3xl mt-1">
                {rating.label}
              </p>

              {report && (
                <p className="mt-2 text-sm">
                  Approved score: {formattedScore}

                  {report.scoring?.state === "PROVISIONAL"
                    ? " (provisional)"
                    : ""}
                </p>
              )}
              {dualScoring && (
                <div className="mt-2 text-sm space-y-1">
                  <p>Overall Evaluated Score: {formattedOverallScore}
                    {report.scoring.evaluatedState === "PROVISIONAL" ? " (provisional — includes AI suggestions or partial coverage)" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Approved: {report.scoring.approvedCount} · Evaluated: {report.scoring.evaluatedCount}/{report.scoring.totalCount}
                    {" · Coverage: "}{Math.round((report.scoring.coverage || 0) * 100)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Approved grades take priority. Unanswered or uncertain questions are unassessed, not zero.</p>
                </div>
              )}

              {report?.assessmentConfidence && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Assessment confidence:{" "}
                  <span className="font-medium">
                    {report.assessmentConfidence}
                  </span>
                </p>
              )}

              {report?.ratingPolicy && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {report.ratingPolicy}
                </p>
              )}
            </div>

            <span
              className="text-4xl shrink-0"
              aria-hidden="true"
            >
              {rating.emoji}
            </span>
          </div>

          {/* PERFORMANCE SUMMARY */}

          <FeedbackSection
            icon={
              <Sparkles
                size={15}
                className="text-brand"
              />
            }
            title="Performance Summary"
          >
            <p className="whitespace-pre-wrap">
              {feedback.summary ||
                "Insufficient evidence for a performance summary."}
            </p>
          </FeedbackSection>

          {/* RECOMMENDATION */}

          <FeedbackSection
            icon={
              <AlertCircle
                size={15}
                className="text-brand"
              />
            }
            title="Recommendation"
          >
            <p className="whitespace-pre-wrap">
              {feedback.recommendation ||
                "Further assessment is recommended."}
            </p>
          </FeedbackSection>

          {/* TECHNICAL, COMMUNICATION, PROBLEM SOLVING */}

          <div className="grid gap-3">

            <FeedbackSection
              icon={
                <Brain
                  size={15}
                  className="text-brand"
                />
              }
              title="Technical Assessment"
            >
              <p className="whitespace-pre-wrap">
                {feedback.technical ||
                  "Not assessed."}
              </p>
            </FeedbackSection>

            <FeedbackSection
              icon={
                <MessageSquare
                  size={15}
                  className="text-brand"
                />
              }
              title="Communication Assessment"
            >
              <p className="whitespace-pre-wrap">
                {feedback.communication ||
                  "Not assessed."}
              </p>
            </FeedbackSection>

            <FeedbackSection
              icon={
                <TrendingUp
                  size={15}
                  className="text-brand"
                />
              }
              title="Problem-Solving Assessment"
            >
              <p className="whitespace-pre-wrap">
                {feedback.problemSolving ||
                  "Not assessed."}
              </p>
            </FeedbackSection>

          </div>

          {/* STRENGTHS */}

          <FeedbackSection
            icon={
              <CheckCircle2
                size={15}
                className="text-success"
              />
            }
            title="Strengths"
          >
            <FeedbackList
              items={strengths}
              variant="strength"
            />
          </FeedbackSection>

          {/* WEAKNESSES */}

          <FeedbackSection
            icon={
              <AlertCircle
                size={15}
                className="text-danger"
              />
            }
            title="Weaknesses and Misconceptions"
          >
            <FeedbackList
              items={weaknesses}
              variant="weakness"
            />
          </FeedbackSection>

          {/* AREAS FOR IMPROVEMENT */}

          <FeedbackSection
            icon={
              <TrendingUp
                size={15}
                className="text-brand"
              />
            }
            title="Areas for Improvement"
          >
            <FeedbackList
              items={improvements}
              variant="improvement"
            />
          </FeedbackSection>

          {/* IMPORTANT ASSESSMENT NOTE */}

          <p className="text-xs text-muted-foreground leading-relaxed">
            This AI-assisted report summarizes available
            interview evidence, interviewer-approved grades,
            and separately labeled AI suggestions. Ratings are advisory and do not
            constitute an automatic hiring decision.
            Code and SQL execution are not independently
            verified by this report.
          </p>

          {/* RETRY FEEDBACK */}

          {onRetry && (
            <Button
              variant="outline"
              disabled={loading}
              onClick={onRetry}
            >
              {loading
                ? "Checking..."
                : !dualScoring ? "Update saved report to version 4" : "Check for updated feedback"}
            </Button>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
