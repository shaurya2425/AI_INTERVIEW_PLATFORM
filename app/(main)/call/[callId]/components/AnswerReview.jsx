"use client";

import AIResponse, { CodeView } from "./AIResponse";
import { useState } from "react";
import { approveInterviewGrade, retryInterviewEvaluation } from "@/actions/interviewQuestions";
import { useInterviewQuestions } from "./InterviewQuestionMessage";

const grades = ["POOR", "AVERAGE", "GOOD", "EXCELLENT"];
export default function AnswerReview({ question }) {
  const { callId, questions, acceptQuestion, refresh } = useInterviewQuestions();
  const review = question.review;
  const [grade, setGrade] = useState("");
  const [notes, setNotes] = useState(null);
  const [correctionWithHint, setCorrectionWithHint] = useState(review?.correctionWithHint || false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!review) return null;
  const assessment = review.assessment;
  const selected = grade || review.approvedGrade || assessment?.suggestedGrade || "";
  async function perform(retry, acceptedGrade) {
    setBusy(true); setMessage("");
    try {
      const result = retry ? await retryInterviewEvaluation({ callId, questionId: question.persistedId }) :
        await approveInterviewGrade({ callId, questionId: question.persistedId, submissionRevision: question.submission?.revision || 1, correctionWithHint, grade: acceptedGrade || selected, notes: notes ?? review.notes ?? "" });
      if (!result.success) { setMessage(result.error); return; }
      if (result.question) acceptQuestion(result.question);
      if (retry) {
        const saved = questions.find(q => q.id === question.persistedId);
        if (saved) acceptQuestion({ ...saved, review: { ...saved.review, status: "PENDING", error: null } });
      }
      setMessage(retry ? "Evaluation requested. You can keep interviewing or grade manually." : "Approved grade saved.");
      if (!retry) void refresh();
    } catch { setMessage("Could not confirm this action. Refresh and retry."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 text-sm">
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full border border-border bg-background px-2.5 py-1 text-muted-foreground">Private review</span>
      <span role="status" className="text-brand">{review.approvedGrade ? "Grade approved" : ["PENDING", "RUNNING"].includes(review.status) ? "Evaluating answer..." : "Awaiting approval"}</span>
    </div>
    <details className="text-muted-foreground"><summary className="cursor-pointer text-xs">Full question</summary><div className="mt-2"><AIResponse content={question.question} /></div></details>
    <div><p className="mb-2 font-medium">Candidate response</p>
      {question.submission?.language ? <CodeView code={question.submission.answer || ""} language={question.submission.language} /> : <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-background p-3"><p className="whitespace-pre-wrap break-words leading-6">{question.submission?.answer || (question.submission?.optionIndex != null ? question.options?.[question.submission.optionIndex] : "No answer text")}</p></div>}
    </div>
    {review.error && <p role="alert" className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-xs leading-5 text-danger">AI evaluation unavailable. Retry or grade manually. {review.error}</p>}
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl border border-border bg-background p-3"><p className="text-xs text-muted-foreground">AI suggestion</p><p className="mt-1 font-semibold">{assessment?.suggestedGrade || "Pending"}</p><p className="mt-1 text-xs text-muted-foreground">{review.suggestedScore != null ? review.suggestedScore + " / 100" : "Not assessed yet"}</p></div>
      <div className="rounded-xl border border-brand/20 bg-amber-400/5 p-3"><p className="text-xs text-muted-foreground">Approved grade</p><p className="mt-1 font-semibold">{review.approvedGrade || "Not graded"}</p><p className="mt-1 text-xs text-muted-foreground">{review.approvedScore != null ? review.approvedScore + " / 100" : "Your decision is final"}</p></div>
    </div>
    {assessment && <details className="rounded-xl border border-border bg-background p-3">
      <summary className="cursor-pointer font-medium">Assessment details</summary>
      <div className="mt-3 space-y-3 text-sm leading-6">
        <p>{assessment.reasoning}</p>
        <p className="text-xs text-muted-foreground">Result: {assessment.result} | Confidence: {assessment.confidence || "Not recorded"}</p>
        {assessment.uncertainty && <p className="text-muted-foreground">{assessment.uncertainty}</p>}
        {[["strengths", "Strengths"], ["weaknesses", "Areas to improve"], ["mistakes", "Mistakes"], ["missingConcepts", "Missing concepts"]].map(([key, label]) => assessment[key]?.length > 0 && <div key={key}><p className="font-medium">{label}</p><ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{assessment[key].map((item, i) => <li key={i}>{item}</li>)}</ul></div>)}
        {assessment.recommendedFollowUp && <p><span className="font-medium">Follow-up: </span>{assessment.recommendedFollowUp}</p>}
        {assessment.method === "AI_STATIC_REVIEW" && <p className="text-xs text-muted-foreground">Static review only. Code and SQL have not been executed.</p>}
        {review.calculation && <p className="text-xs text-muted-foreground">Weight: {review.calculation.questionWeight} | Weighted contribution: {review.calculation.weightedScore}</p>}
      </div>
    </details>}
    <div className="flex flex-wrap gap-2">
      {assessment && <button type="button" disabled={busy} onClick={() => perform(false, assessment.suggestedGrade)} className="workspace-secondary">Accept AI grade</button>}
      {review.status !== "COMPLETE" && <button type="button" disabled={busy} onClick={() => perform(true)} className="workspace-secondary">Retry evaluation</button>}
    </div>
    <div className="space-y-3 border-t border-border pt-4">
      <label className="block space-y-1.5"><span className="font-medium">{assessment ? "Approve or override" : "Grade manually"}</span><select aria-label="Approved grade" value={selected} onChange={e => setGrade(e.target.value)} disabled={busy} className="workspace-field">
        <option value="">Choose a grade</option>{grades.map((g, i) => <option key={g} value={g}>{g[0] + g.slice(1).toLowerCase()} | {[0, 40, 75, 100][i]}</option>)}</select></label>
      <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Private interviewer notes</span><textarea value={notes ?? review.notes ?? ""} onChange={e => setNotes(e.target.value)} maxLength={6000} rows={3} placeholder="Record your reasoning or follow-up ideas..." className="workspace-field resize-y" /></label>
      {question.type !== "MCQ" && question.submission?.revision > 1 && <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={correctionWithHint} onChange={e => setCorrectionWithHint(e.target.checked)} disabled={busy} />This revision corrects a mistake using my hint (5-point deduction, capped per question). Leave unchecked for independent corrections.</label>}
      <button type="button" disabled={busy || !selected} onClick={() => perform(false)} className="workspace-primary w-full">{busy ? "Saving..." : "Save approved grade"}</button>
    </div>
    {message && <p role="status" className="rounded-lg border border-border bg-background p-3 text-xs leading-5">{message}</p>}
  </section>;
}
