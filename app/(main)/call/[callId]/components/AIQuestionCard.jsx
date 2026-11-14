
"use client";

import { useState } from "react";
import {
  Check,
  Flame,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";

import AIResponse from "./AIResponse";
import AIGrillComposer from "./AIGrillComposer";

const GRADES = [
  { value: 1, label: "Poor" },
  { value: 2, label: "Average" },
  { value: 3, label: "Good" },
  { value: 4, label: "Excellent" },
];

export default function AIQuestionCard({
  question,
  isActive,
  loading,
  onSelect,
  onAsked,
  onSkip,
  onFocus,
  onGrill,
  onGrade,
}) {
  const [showGrill, setShowGrill] = useState(false);
  const [showGrade, setShowGrade] = useState(false);

  const [grade, setGrade] = useState(
    question.grade || null
  );

  const [candidateAnswer, setCandidateAnswer] = useState(
    question.candidateAnswer || ""
  );

  const [notes, setNotes] = useState(
    question.notes || ""
  );

  const canGrade =
    question.status === "ASKED" ||
    question.status === "EVALUATED";

  return (
    <article
      className={`min-w-0 space-y-3 rounded-xl border bg-surface p-4 transition-colors ${
        isActive
          ? "border-amber-400/50"
          : "border-border"
      }`}
    >
      {/* Metadata */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
            {question.topic}
          </span>

          <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
            {question.difficulty}
          </span>

          {question.type && (
            <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
              {question.type.replaceAll("_", " ")}
            </span>
          )}
        </div>

        {isActive && (
          <span className="text-xs font-medium text-brand">
            Active
          </span>
        )}
      </div>

      {/* Question */}
      <div className="text-[15px] font-medium leading-6 text-foreground">
        <AIResponse content={question.question} />
      </div>

      {question.options?.length > 0 && (
        <div className="space-y-2">
          {question.options.map((option, index) => (
            <div
              key={index}
              className="rounded-lg border border-border px-3 py-2 text-sm text-foreground"
            >
              {String.fromCharCode(65 + index)}. {option}
            </div>
          ))}
        </div>
      )}

      {/* Reference answer */}
      <details className="group">
        <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-brand">
          Reference answer
          <ChevronDown
            size={14}
            className="transition-transform group-open:rotate-180"
          />
        </summary>

        <div className="mt-3 border-t border-border pt-3">
          <AIResponse content={question.answer} />
        </div>
      </details>

      {/* State */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {question.status === "EVALUATED"
            ? "Graded"
            : question.status?.toLowerCase()}
        </span>

        {question.depth > 0 && (
          <span>· Follow-up {question.depth}</span>
        )}

        {question.status === "EVALUATED" && (
          <span className="flex items-center gap-1 text-brand">
            <CheckCircle2 size={13} />
            {GRADES.find((g) => g.value === question.grade)
              ?.label || ""}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {question.status === "SUGGESTED" && (
          <>
            <button
              type="button"
              onClick={() => onSelect(question)}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-amber-400 px-3 text-sm font-semibold text-zinc-950"
            >
              <Check size={14} />
              Select
            </button>

            <button
              type="button"
              onClick={() => onSkip(question)}
              className="h-9 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:text-foreground"
            >
              Skip
            </button>
          </>
        )}

        {question.status === "SELECTED" && (
          <button
            type="button"
            onClick={() => onAsked(question)}
            className="h-9 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 text-sm font-medium text-brand"
          >
            Mark asked
          </button>
        )}

        {!["SKIPPED", "SUGGESTED"].includes(
          question.status
        ) && (
          <button
            type="button"
            onClick={() => onFocus(question)}
            className="h-9 rounded-lg border border-border px-3 text-sm text-foreground"
          >
            Focus
          </button>
        )}

        {question.status !== "SKIPPED" &&
          (question.depth || 0) < 8 && (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setShowGrill((old) => !old);
                setShowGrade(false);
              }}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-foreground hover:border-amber-400/40 disabled:opacity-50"
            >
              <Flame size={14} />
              Grill
            </button>
          )}

        {canGrade && (
          <button
            type="button"
            onClick={() => {
              setShowGrade((old) => !old);
              setShowGrill(false);
            }}
            className="h-9 rounded-lg border border-border px-3 text-sm text-foreground hover:border-amber-400/40"
          >
            Grade
          </button>
        )}
      </div>

      {/* Grill form */}
      {showGrill && (
        <AIGrillComposer
          disabled={loading}
          onCancel={() => setShowGrill(false)}
          onSubmit={({ hint, depth }) => {
            setShowGrill(false);
            onGrill(question, hint, depth);
          }}
        />
      )}

      {/* Grade form */}
      {showGrade && canGrade && (
        <div className="space-y-3 rounded-xl border border-border bg-background p-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Candidate response
            </label>

            <textarea
              rows={3}
              value={candidateAnswer}
              onChange={(e) =>
                setCandidateAnswer(e.target.value)
              }
              placeholder="Candidate's answer or transcript excerpt..."
              className="w-full resize-y rounded-lg border border-border bg-surface p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-amber-400/30"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Interviewer assessment
            </label>

            <div className="grid grid-cols-2 gap-2">
              {GRADES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setGrade(item.value)}
                  className={`h-10 rounded-lg border px-2 text-sm font-medium ${
                    grade === item.value
                      ? "border-amber-400/50 bg-amber-400/10 text-brand"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Interviewer notes
            </label>

            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Strengths, misconceptions, areas to investigate..."
              className="w-full resize-y rounded-lg border border-border bg-surface p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-amber-400/30"
            />
          </div>

          <button
            type="button"
            disabled={!grade}
            onClick={() => {
              onGrade(question, {
                grade,
                candidateAnswer,
                notes,
              });

              setShowGrade(false);
            }}
            className="h-10 w-full rounded-lg bg-amber-400 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            Save evaluation
          </button>
        </div>
      )}
    </article>
  );
}
