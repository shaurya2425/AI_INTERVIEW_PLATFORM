"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InterviewQuestionProvider, useInterviewQuestions } from "@/app/(main)/call/[callId]/components/InterviewQuestionMessage";
import AnswerReview from "@/app/(main)/call/[callId]/components/AnswerReview";

function Reviews() {
  const { questions, scoring, error, refresh } = useInterviewQuestions();
  return <div className="space-y-4">
    <p>Approved score: {scoring?.overallScore == null ? "Unavailable" : scoring.overallScore.toFixed(1) + "/100"} {scoring?.state === "PROVISIONAL" ? "(provisional)" : ""}</p>
    <p className="text-xs text-muted-foreground">Grill is bonus-only. This is your private grading workspace; the comprehensive feedback report is still preparing.</p>
    <Button variant="outline" onClick={refresh}>Refresh reviews</Button>
    {error && <p role="alert">{error}</p>}
    {questions.filter(q => q.status !== "PENDING").map(q => <article key={q.id} className="space-y-2 rounded border border-border p-3">
      <p className="font-medium">{q.question}</p>
      <p className="text-xs">{q.topic} · {q.difficulty}{q.depth > 0 ? " · Grill follow-up" : ""}</p>
      <details><summary>Private reference answer</summary><p className="whitespace-pre-wrap">{q.referenceAnswer}</p></details>
      {q.review ? <AnswerReview question={{ ...q, persistedId: q.id }} /> : <p>Unanswered — not scored.</p>}
    </article>)}
  </div>;
}

export default function InterviewReviewDialog({ callId }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Review answers & grades</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Private interview reviews</DialogTitle></DialogHeader>
        {open && <InterviewQuestionProvider callId={callId} isInterviewer userId="private-review"><Reviews /></InterviewQuestionProvider>}
      </DialogContent>
    </Dialog>
  </>;
}
