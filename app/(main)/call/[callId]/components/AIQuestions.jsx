
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  RotateCcw,
  ArrowDown,
  MessageSquare,
} from "lucide-react";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { generateInterviewQuestions } from "@/actions/aiQuestions";
import {
  makeDefaultPreferences,
  INTERVIEW_CATALOG,
} from "@/lib/interviewCatalog";

import AIResponse from "./AIResponse";
import AIQuestionCard from "./AIQuestionCard";
import AIBuddyFilters from "./AIBuddyFilters";

const createId = () => crypto.randomUUID();

export default function AIQuestionsPanel({
  callId,
  sessionId,
  categories = [],
}) {
  const defaultSubject =
    categories.find((category) =>
      Object.hasOwn(INTERVIEW_CATALOG, category)
    ) || "DSA";

  const storageKey = `prept-ai-buddy:${sessionId || callId}`;

  const [preferences, setPreferences] = useState(() =>
    makeDefaultPreferences(defaultSubject)
  );

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [activeQuestionId, setActiveQuestionId] =
    useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedKey, setLoadedKey] = useState(null);

  const [showScrollBottom, setShowScrollBottom] =
    useState(false);

  const busyRef = useRef(false);
  const scrollRef = useRef(null);
  const composerRef = useRef(null);

  const ready = loadedKey === storageKey;

  // ==============================================
  // LOAD SESSION HISTORY
  // ==============================================

  useEffect(() => {
    // Restore browser storage after the first paint; cancel stale session loads.
    const frame = requestAnimationFrame(() => {
      let saved = null;

      try {
        saved = JSON.parse(
          localStorage.getItem(storageKey) || "null"
        );
      } catch {
        saved = null;
      }

      setMessages(
        Array.isArray(saved?.messages)
          ? saved.messages
          : []
      );

      setActiveQuestionId(
        saved?.activeQuestionId || null
      );

      const defaults = makeDefaultPreferences(
        defaultSubject
      );

      setPreferences({
        ...defaults,
        ...(saved?.preferences || {}),
        mode: "FREE_FLOW",
      });

      setInput("");
      setError("");
      setLoadedKey(storageKey);
    });

    return () => cancelAnimationFrame(frame);
  }, [storageKey, defaultSubject]);

  // ==============================================
  // SAVE SESSION HISTORY
  // ==============================================

  useEffect(() => {
    if (!ready) return;

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          messages,
          activeQuestionId,
          preferences,
        })
      );
    } catch {
      // Continue without persistence.
    }
  }, [
    ready,
    storageKey,
    messages,
    activeQuestionId,
    preferences,
  ]);

  // ==============================================
  // QUESTION STATE
  // ==============================================

  const questions = messages.flatMap(
    (message) => message.cards || []
  );

  const activeQuestion =
    questions.find(
      (question) => question.id === activeQuestionId
    ) || null;

  const askedCount = questions.filter(
    (question) =>
      question.status === "ASKED" ||
      question.status === "EVALUATED"
  ).length;

  const gradedCount = questions.filter(
    (question) =>
      question.status === "EVALUATED"
  ).length;

  function updateQuestion(id, changes) {
    setMessages((previous) =>
      previous.map((message) => {
        if (
          !message.cards?.some(
            (question) => question.id === id
          )
        ) {
          return message;
        }

        return {
          ...message,
          cards: message.cards.map((question) =>
            question.id === id
              ? { ...question, ...changes }
              : question
          ),
        };
      })
    );
  }

  function buildHistory() {
    return questions.map((question) => ({
      id: question.id,
      category: question.category,
      topic: question.topic,
      type: question.type,
      question: question.question,
      status: question.status,
      grade: question.grade,
      candidateAnswer:
        question.candidateAnswer || "",
      notes: question.notes || "",
      parentId: question.parentId || "",
      depth: question.depth || 0,
    }));
  }

  // ==============================================
  // CHAT REQUEST
  // ==============================================

  async function send({
    text = "",
    mode = "AUTO",
    parent = null,
    forceQuestions = false,
    guided = false,
  } = {}) {
    if (!ready || busyRef.current) return;

    const instruction = text.trim();

    if (
      !instruction &&
      !forceQuestions &&
      mode !== "GRILL"
    ) {
      return;
    }

    if (instruction.length > 1200) {
      setError(
        "Keep your message under 1200 characters."
      );
      return;
    }

    busyRef.current = true;
    setLoading(true);
    setError("");

    const focusedQuestion =
      parent || activeQuestion;

    const requestPreferences = {
      ...preferences,
      mode: guided ? "GUIDED" : "FREE_FLOW",
      ...(guided
        ? {}
        : {
            topic: "ALL",
            questionType: "ANY",
            difficulty: "MIXED",
          }),
    };

    // Explicit Grill always retains parent context.
    const displayText =
      mode === "GRILL"
        ? `Grill: ${focusedQuestion?.question || "Question"}${
            instruction ? `\nFocus: ${instruction}` : ""
          }`
        : guided
          ? `Suggest ${requestPreferences.questionCount} ${
              requestPreferences.difficulty.toLowerCase()
            } ${
              requestPreferences.questionType === "ANY"
                ? ""
                : requestPreferences.questionType.toLowerCase()
            } questions on ${
              requestPreferences.topic === "ALL"
                ? requestPreferences.subject
                : requestPreferences.topic
            }`
          : instruction;

    const userMessage = {
      id: createId(),
      role: "user",
      text: displayText,
      cards: [],
    };

    const nextMessages = [
      ...messages,
      userMessage,
    ];

    setMessages(nextMessages);

    if (!guided && mode !== "GRILL") {
      setInput("");
    }

    try {
      const result =
        await generateInterviewQuestions({
          callId,
          preferences: requestPreferences,
          instruction: guided
            ? displayText
            : instruction,
          mode,
          forceQuestions,
          history: buildHistory(),
          messages: nextMessages.map((message) => ({
            role: message.role,
            text: message.text,
          })),
          activeQuestion: focusedQuestion,
        });

      if (!result || result.error) {
        throw new Error(
          result?.error ||
            "Unable to get an AI response."
        );
      }

      const cards = Array.isArray(result.questions)
        ? result.questions.map((question) => ({
            ...question,
            status: "SUGGESTED",
            grade: null,
            candidateAnswer: "",
            notes: "",
          }))
        : [];

      setMessages((previous) => [
        ...previous,
        {
          id: createId(),
          role: "assistant",
          text:
            result.message ||
            (cards.length
              ? "Here are some interview questions."
              : "I couldn't generate a response."),
          cards,
          sources: result.sources || [],
          metadata: result.metadata || null,
        },
      ]);
    } catch (err) {
      setError(
        err?.message ||
          "AI Buddy couldn't complete the request."
      );
    } finally {
      setLoading(false);
      busyRef.current = false;
    }
  }

  // ==============================================
  // QUESTION ACTIONS
  // ==============================================

  function handleGrill(question, hint, depth) {
    setActiveQuestionId(question.id);

    const depthPrompt = {
      CLARIFY:
        "Clarify the underlying fundamentals.",
      DEEPER:
        "Explore this concept in more technical depth.",
      CHALLENGE:
        "Challenge the candidate with advanced edge cases and tradeoffs.",
    }[depth] || "Explore the concept further.";

    send({
      mode: "GRILL",
      parent: question,
      text: `${depthPrompt} ${hint}`.trim(),
    });
  }

  function handleGrade(question, evaluation) {
    if (
      !["ASKED", "EVALUATED"].includes(
        question.status
      )
    ) {
      setError(
        "Mark the question as asked before grading."
      );
      return;
    }

    updateQuestion(question.id, {
      status: "EVALUATED",
      grade: evaluation.grade,
      candidateAnswer:
        evaluation.candidateAnswer,
      notes: evaluation.notes,
    });

    setActiveQuestionId(question.id);
    setError("");
  }

  function clearChat() {
    if (loading) return;

    if (
      !window.confirm(
        "Clear AI Buddy's conversation and evaluations for this interview?"
      )
    ) {
      return;
    }

    setMessages([]);
    setActiveQuestionId(null);
    setInput("");
    setError("");
  }

  // ==============================================
  // KEYBOARD SUPPORT
  // ==============================================

  function onMessageKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();

      if (!loading && ready && input.trim()) {
        send({ text: input });
      }
    }
  }

  // ==============================================
  // SCROLL MANAGEMENT
  // ==============================================

  function scrollToBottom() {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }

  function handleScroll(event) {
    const element = event.currentTarget;

    const remaining =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;

    setShowScrollBottom(
      remaining > 180
    );
  }

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, loading]);

  // ==============================================
  // RENDER
  // ==============================================

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">

      {/* Compact header */}
      <header className="flex shrink-0 items-center justify-between gap-3 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="
              flex size-9 shrink-0 items-center
              justify-center rounded-lg
              bg-amber-400/10 text-brand
            "
          >
            <Sparkles size={18} />
          </span>

          <div>
            <h2 className="text-base font-semibold text-foreground">
              AI Buddy
            </h2>

            <p className="text-xs text-muted-foreground">
              Your private interview assistant
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={clearChat}
          disabled={loading}
          aria-label="Clear conversation"
          title="Clear conversation"
          className="
            flex size-9 items-center
            justify-center rounded-lg
            border border-border
            text-muted-foreground
            hover:text-foreground
            disabled:opacity-50
          "
        >
          <RotateCcw size={15} />
        </button>
      </header>

      {/* Collapsible question curation */}
      <AIBuddyFilters
        value={preferences}
        onChange={setPreferences}
        disabled={loading}
        onGenerate={() =>
          send({
            forceQuestions: true,
            guided: true,
          })
        }
      />

      {/* Small session status */}
      <div className="flex shrink-0 items-center justify-between gap-2 py-2.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MessageSquare size={13} />
          <span>
            {askedCount} asked · {gradedCount} graded
          </span>
        </div>

        {activeQuestion && (
          <button
            type="button"
            onClick={() =>
              setActiveQuestionId(null)
            }
            className="
              max-w-[58%] truncate
              text-xs text-brand
              hover:underline
            "
            title={activeQuestion.question}
          >
            {activeQuestion.topic} ×
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="
            mb-2 shrink-0 rounded-lg
            border border-red-400/20
            bg-red-400/5 px-3 py-2
            text-sm text-danger
          "
        >
          {error}
        </div>
      )}

      {/* Chat: takes remaining available height */}
      <div className="relative min-h-0 flex-1">

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="
            h-full min-h-0
            space-y-4
            overflow-y-auto
            overscroll-contain
            px-1 pr-2
            [scrollbar-width:thin]
            [scrollbar-color:var(--border)_transparent]
            [&::-webkit-scrollbar]:w-1.5
            [&::-webkit-scrollbar-thumb]:rounded-full
            [&::-webkit-scrollbar-thumb]:bg-border
            [&::-webkit-scrollbar-track]:bg-transparent
          "
        >

          {/* Empty chat state */}
          {messages.length === 0 && (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
              <span
                className="
                  flex size-12 items-center
                  justify-center rounded-2xl
                  border border-border
                  bg-surface
                "
              >
                <MessageSquare
                  size={22}
                  className="text-brand"
                />
              </span>

              <div>
                <h3 className="text-base font-semibold text-foreground">
                  How can I help?
                </h3>

                <p className="mt-2 max-w-[290px] text-sm leading-6 text-muted-foreground">
                  Ask for interview questions,
                  explanations, code solutions,
                  or deeper follow-ups.
                </p>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <div
              key={message.id}
              className="min-w-0 space-y-3"
            >
              <div
                className={`min-w-0 rounded-xl px-3.5 py-3 ${
                  message.role === "user"
                    ? "ml-6 bg-amber-400/10"
                    : "border border-border bg-surface"
                }`}
              >
                {message.role === "assistant" ? (
                  <AIResponse
                    content={message.text}
                  />
                ) : (
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                    {message.text}
                  </p>
                )}
              </div>

              {/* Inline question cards */}
              {message.cards?.map((question) => (
                <AIQuestionCard
                  key={question.id}
                  question={question}
                  isActive={
                    activeQuestionId === question.id
                  }
                  loading={loading}
                  onSelect={(q) => {
                    updateQuestion(q.id, {
                      status: "SELECTED",
                    });

                    setActiveQuestionId(q.id);
                  }}
                  onAsked={(q) => {
                    updateQuestion(q.id, {
                      status: "ASKED",
                    });

                    setActiveQuestionId(q.id);
                  }}
                  onSkip={(q) => {
                    updateQuestion(q.id, {
                      status: "SKIPPED",
                    });

                    if (
                      activeQuestionId === q.id
                    ) {
                      setActiveQuestionId(null);
                    }
                  }}
                  onFocus={(q) =>
                    setActiveQuestionId(q.id)
                  }
                  onGrill={handleGrill}
                  onGrade={handleGrade}
                />
              ))}

              {/* Web research citations */}
              {message.sources?.length > 0 && (
                <div className="rounded-xl border border-border p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    Sources
                  </p>

                  <div className="space-y-2">
                    {message.sources.map(
                      (source, index) => (
                        <a
                          key={`${source.url}-${index}`}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block break-words text-sm text-brand underline underline-offset-2"
                        >
                          {source.title}
                        </a>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* AI loading indicator */}
          {loading && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-3 text-sm text-muted-foreground">
              <LoadingSpinner
                label="AI Buddy is thinking"
                className="size-4"
              />
              AI Buddy is thinking...
            </div>
          )}

        </div>

        {/* Scroll to latest */}
        {showScrollBottom && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to latest message"
            className="
              absolute bottom-3 right-3
              flex size-9 items-center
              justify-center rounded-full
              border border-border
              bg-background text-foreground
              shadow-md
            "
          >
            <ArrowDown size={16} />
          </button>
        )}
      </div>

      {/* Quick prompts: single compact row */}
      <div
        className="
          flex shrink-0 gap-2
          overflow-x-auto py-3
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {[
          "Next question",
          "Harder",
          "Easier",
          "Explain selected",
        ].map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={loading || !ready}
            onClick={() =>
              send({ text: prompt })
            }
            className="
              shrink-0 rounded-full
              border border-border
              px-3 py-1.5
              text-xs font-medium
              text-muted-foreground
              transition-colors
              hover:border-amber-400/40
              hover:text-foreground
              disabled:opacity-50
            "
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Fixed chat composer */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          send({ text: input });
        }}
        className="shrink-0 border-t border-border pt-3"
      >
        <div
          className="
            rounded-2xl border border-border
            bg-surface p-2
            transition-colors
            focus-within:border-amber-400/50
            focus-within:ring-2
            focus-within:ring-amber-400/10
          "
        >
          <textarea
            ref={composerRef}
            rows={2}
            maxLength={1200}
            value={input}
            disabled={loading || !ready}
            onChange={(event) =>
              setInput(event.target.value)
            }
            onKeyDown={onMessageKeyDown}
            placeholder="Message AI Buddy..."
            className="
              max-h-36 min-h-12 w-full
              resize-none bg-transparent
              px-2 py-2
              text-sm leading-6 text-foreground
              outline-none
              placeholder:text-muted-foreground
              disabled:opacity-50
            "
          />

          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <span className="text-[11px] text-muted-foreground">
              Enter to send · Shift+Enter for newline
            </span>

            <button
              type="submit"
              disabled={
                loading ||
                !ready ||
                !input.trim()
              }
              aria-label="Send message"
              title="Send message"
              className="
                flex size-10 shrink-0
                items-center justify-center
                rounded-xl bg-amber-400
                text-zinc-950
                transition-all
                hover:opacity-90
                active:scale-95
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
