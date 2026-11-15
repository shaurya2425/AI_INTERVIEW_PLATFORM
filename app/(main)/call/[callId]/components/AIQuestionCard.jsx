
"use client";

import { useState } from "react";
import {
  Check,
  Flame,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";

import AnswerReview from "./AnswerReview";
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
  onSkip,
  onGrill,
}) {
  const [showGrill, setShowGrill] = useState(false);

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
          {question.type === "MCQ" && Number.isInteger(question.correctOptionIndex) && question.correctOptionIndex >= 0 && <p className="mb-2 text-sm font-semibold">Correct answer: {String.fromCharCode(65 + question.correctOptionIndex)}</p>}
          <AIResponse content={question.answer} />
        </div>
      </details>

      {question.review && <AnswerReview question={question} />}
      {/* State */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {question.status === "EVALUATED"
            ? "Graded"
            : question.status === "SENT" ? "Sent / Awaiting answer" : question.status?.toLowerCase()}
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
        {["SUGGESTED", "SELECTED", "ASKED"].includes(question.status) && (
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

        {question.status !== "SKIPPED" &&
          (question.depth || 0) < 8 && (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setShowGrill((old) => !old);
              }}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-foreground hover:border-amber-400/40 disabled:opacity-50"
            >
              <Flame size={14} />
              {question.submission ? "Grill Further" : "Grill"}
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

    </article>
  );
}
