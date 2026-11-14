
"use client";

import { useState } from "react";
import {
  ChevronDown,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

import {
  INTERVIEW_CATALOG,
  SUBJECT_OPTIONS,
  DIFFICULTY_OPTIONS,
  WEB_OPTIONS,
  getTopicOptions,
  getQuestionTypeOptions,
} from "@/lib/interviewCatalog";

const selectClass = `
  h-10 w-full min-w-0 rounded-lg
  border border-border bg-background
  px-3 text-sm text-foreground
  outline-none transition-colors
  focus:border-amber-400/50
  focus:ring-2 focus:ring-amber-400/10
  disabled:opacity-50
`;

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>

      <select
        value={String(value)}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className={selectClass}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function AIBuddyFilters({
  value,
  onChange,
  onGenerate,
  disabled = false,
}) {
  const [expanded, setExpanded] = useState(false);

  function patch(changes) {
    onChange({
      ...value,
      ...changes,
    });
  }

  function changeSubject(subject) {
    if (!INTERVIEW_CATALOG[subject]) return;

    patch({
      subject,
      topic: "ALL",
      questionType: "ANY",
    });
  }

  const subjectLabel =
    INTERVIEW_CATALOG[value.subject]?.label ||
    value.subject;

  const topicLabel =
    value.topic === "ALL"
      ? "All topics"
      : value.topic;

  const typeLabel =
    getQuestionTypeOptions(value.subject)
      .find((item) => item.value === value.questionType)
      ?.label || "Any type";

  return (
    <section className="shrink-0 border-b border-border pb-3">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() =>
          setExpanded((previous) => !previous)
        }
        aria-expanded={expanded}
        aria-controls="ai-buddy-curation"
        className="
          flex min-h-12 w-full items-center
          justify-between gap-3 rounded-xl
          border border-border bg-surface
          px-3 py-2.5 text-left
          transition-colors
          hover:bg-muted/40
        "
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="
              flex size-9 shrink-0 items-center
              justify-center rounded-lg
              bg-amber-400/10 text-brand
            "
          >
            <SlidersHorizontal size={16} />
          </span>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Question Curation
            </p>

            <p className="truncate text-xs text-muted-foreground">
              {expanded
                ? "Customize questions for the interview"
                : `${subjectLabel} · ${topicLabel}`}
            </p>
          </div>
        </div>

        <ChevronDown
          size={17}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expandable configuration */}
      {expanded && (
        <div
          id="ai-buddy-curation"
          className="
            mt-3 space-y-3 rounded-xl
            border border-border bg-surface
            p-3
          "
        >
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Subject"
              value={value.subject}
              options={SUBJECT_OPTIONS}
              disabled={disabled}
              onChange={changeSubject}
            />

            <SelectField
              label="Topic"
              value={value.topic}
              options={getTopicOptions(value.subject)}
              disabled={disabled}
              onChange={(topic) =>
                patch({ topic })
              }
            />

            <SelectField
              label="Question type"
              value={value.questionType}
              options={getQuestionTypeOptions(
                value.subject
              )}
              disabled={disabled}
              onChange={(questionType) =>
                patch({ questionType })
              }
            />

            <SelectField
              label="Difficulty"
              value={value.difficulty}
              options={DIFFICULTY_OPTIONS}
              disabled={disabled}
              onChange={(difficulty) =>
                patch({ difficulty })
              }
            />

            <SelectField
              label="Questions"
              value={value.questionCount}
              options={[1, 2, 3, 4, 5].map((n) => ({
                value: String(n),
                label: String(n),
              }))}
              disabled={disabled}
              onChange={(count) =>
                patch({
                  questionCount: Number(count),
                })
              }
            />

            <SelectField
              label="Web research"
              value={value.webResearch}
              options={WEB_OPTIONS}
              disabled={disabled}
              onChange={(webResearch) =>
                patch({ webResearch })
              }
            />
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            {subjectLabel} · {topicLabel} · {typeLabel}
          </p>

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setExpanded(false);
              onGenerate();
            }}
            className="
              flex h-10 w-full items-center
              justify-center gap-2 rounded-lg
              bg-amber-400 px-4
              text-sm font-semibold text-zinc-950
              transition-opacity
              hover:opacity-90
              disabled:opacity-50
            "
          >
            <Sparkles size={16} />
            Suggest Questions
          </button>
        </div>
      )}
    </section>
  );
}
