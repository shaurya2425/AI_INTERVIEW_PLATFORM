"use client";

import { useState } from "react";
import { approveInterviewGrade, retryInterviewEvaluation } from "@/actions/interviewQuestions";
import { useInterviewQuestions } from "./InterviewQuestionMessage";

const grades = ["POOR", "AVERAGE", "GOOD", "EXCELLENT"];
export default function AnswerReview({ question }) {
  const { callId, questions, acceptQuestion, refresh } = useInterviewQuestions();
  const review = question.review;
  const [grade, setGrade] = useState("");
  const [notes, setNotes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!review) return null;
  const assessment = review.assessment;
  const selected = grade || review.approvedGrade || assessment?.suggestedGrade || "";
  async function perform(retry, acceptedGrade) {
    setBusy(true); setMessage("");
    try {
      const result = retry ? await retryInterviewEvaluation({ callId, questionId: question.persistedId }) :
        await approveInterviewGrade({ callId, questionId: question.persistedId, grade: acceptedGrade || selected, notes: notes ?? review.notes ?? "" });
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
  return <section className="space-y-3 rounded-lg border border-border p-3 text-sm">
    <p className="font-semibold">Private interviewer review</p>
    <p>Candidate submission{question.submission?.language ? ` (${question.submission.language})` : ""}</p>
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words">{question.submission?.answer}</pre>
    <p role="status">Assessment: {review.status.toLowerCase()}{review.approvedGrade ? ` · Approved: ${review.approvedGrade}` : " · Awaiting interviewer approval"}</p>
    {review.error && <p role="alert">{review.error}</p>}
    {assessment && <div className="space-y-2">
      <p>Score: {review.suggestedScore ?? assessment.score ?? "?"}/100 ? Confidence: {assessment.confidence || "Not recorded"}</p>
      <p>{assessment.uncertainty}</p>
      <p>Result: {assessment.result} · Suggested grade: {assessment.suggestedGrade}</p>
      <p>{assessment.reasoning}</p>
      {["strengths", "weaknesses", "mistakes", "missingConcepts"].map(key => <div key={key}>
        <p className="font-medium">{key === "missingConcepts" ? "Missing concepts" : key}</p>
        <ul className="list-disc pl-5">{(assessment[key] || []).map((item, i) => <li key={i}>{item}</li>)}</ul>
      </div>)}
      <p>Recommended follow-up: {assessment.recommendedFollowUp}</p>
      {assessment.method === "AI_STATIC_REVIEW" && <p className="text-xs text-muted-foreground">Static review only. Code and SQL have not been executed or tested.</p>}
    </div>}
    {review.status !== "COMPLETE" && <button type="button" disabled={busy} onClick={() => perform(true)} className="underline disabled:opacity-50">Retry / recover evaluation</button>}
    {assessment && <button type="button" disabled={busy} onClick={() => perform(false, assessment.suggestedGrade)} className="rounded border border-border px-3 py-2">Accept Grade</button>}
    {review.calculation && <p>Approved score: {review.approvedScore}/100 ? Weight: {review.calculation.questionWeight} ? Weighted contribution: {review.calculation.weightedScore}</p>}
    <label className="block">Adjust Grade
      <select value={selected} onChange={e => setGrade(e.target.value)} className="ml-2 rounded border border-border bg-background p-2">
        <option value="">Choose grade</option>
        {grades.map(g => <option key={g} value={g}>{g[0] + g.slice(1).toLowerCase()}</option>)}
      </select>
    </label>
    <label className="block">Add Interviewer Notes
      <textarea value={notes ?? review.notes ?? ""} onChange={e => setNotes(e.target.value)} maxLength={6000} rows={3} className="mt-1 w-full rounded border border-border bg-background p-2" />
    </label>
    <button type="button" disabled={busy || !selected} onClick={() => perform(false)} className="rounded bg-amber-400 px-3 py-2 font-semibold text-zinc-950 disabled:opacity-50">{busy ? "Saving…" : "Save approved grade"}</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
