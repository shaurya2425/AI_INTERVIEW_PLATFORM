"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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

export function FeedbackModal({
  open,
  onOpenChange,
  feedback,
  intervieweeName,
}) {
  if (!feedback) return null;

  const rating = RATING_CONFIG[feedback.overallRating];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border border-amber-200/20 text-foreground sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <StarsBackgroundDemo />

        <DialogHeader className="relative">
          <DialogTitle className="font-serif text-2xl tracking-tight">
            <GrayTitle>AI Feedback Report</GrayTitle>
          </DialogTitle>

          {intervieweeName && (
            <p className="text-xs text-muted-foreground font-light mt-1">
              Performance analysis for {intervieweeName}
            </p>
          )}
        </DialogHeader>

        <div className="relative flex flex-col gap-5 mt-2">
          {/* Rating */}
          <div
            className={`rounded-2xl border ${rating.className} bg-linear-to-br ${rating.bg} to-transparent p-6 flex items-center justify-between`}
          >
            <div>
              <p className="text-[10px] uppercase tracking-widest">
                Overall rating
              </p>
              <p className="font-serif text-3xl">{rating.label}</p>
            </div>

            <span className="text-4xl">{rating.emoji}</span>
          </div>

          {/* Summary */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={13} className="text-brand" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Summary
              </p>
            </div>
            <p className="text-sm text-foreground">{feedback.summary}</p>
          </div>

          {/* Recommendation */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Recommendation
            </p>
            <p className="text-sm text-foreground">{feedback.recommendation}</p>
          </div>

          {/* Sections */}
          <div className="grid gap-3">
            {[
              {
                icon: <Brain size={14} className="text-brand" />,
                label: "Technical",
                value: feedback.technical,
              },
              {
                icon: <MessageSquare size={14} className="text-brand" />,
                label: "Communication",
                value: feedback.communication,
              },
              {
                icon: <TrendingUp size={14} className="text-brand" />,
                label: "Problem Solving",
                value: feedback.problemSolving,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-surface border border-border rounded-xl p-5"
              >
                <div className="flex items-center gap-2 mb-2">
                  {item.icon}
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {item.label}
                  </p>
                </div>
                <p className="text-sm text-foreground">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Strengths & Improvements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={13} className="text-success" />
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Strengths
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {feedback.strengths?.map((s, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="justify-start border-green-500/20 text-success whitespace-normal"
                  >
                    ✓ {s}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={13} className="text-brand" />
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  To improve
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {feedback.improvements?.map((imp, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="justify-start border-red-500/20 text-danger whitespace-normal"
                  >
                    ✓ {imp}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
