
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  RefreshCw,
  ListChecks,
  ShieldCheck,
  ArrowDown,
  MessageSquare,
} from "lucide-react";

import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { generateInterviewQuestions } from "@/actions/aiQuestions";
import useBuddyHistory from "./useBuddyHistory";
import AnswerReview from "./AnswerReview";

import { sendInterviewQuestion } from "@/actions/interviewQuestions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useInterviewQuestions } from "./InterviewQuestionMessage";
import AIResponse from "./AIResponse";
import AIQuestionCard from "./AIQuestionCard";
import AIBuddyFilters from "./AIBuddyFilters";

const createId = () => crypto.randomUUID();

export default function AIQuestionsPanel({
  callId,
  sessionId,
  intervieweeName = "Candidate",
}) {
  const [tab, setTab] = useState("questions");
  const [focusedReview, setFocusedReview] = useState(null);
  const delivery = useInterviewQuestions();
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const [sendingQuestion, setSendingQuestion] = useState(false);
  const [deliveryError, setDeliveryError] = useState("");
  const deliveryLock = useRef(false);

  async function confirmQuestion() {
    if (!pendingQuestion || deliveryLock.current) return;
    deliveryLock.current = true;
    setSendingQuestion(true);
    setDeliveryError("");
    try {
      const result = await sendInterviewQuestion({ callId, question: pendingQuestion });
      if (!result.success) { setDeliveryError(result.error); void delivery?.refresh(); return; }
      delivery?.acceptQuestion(result.question);
      updateQuestion(pendingQuestion.id, { status: result.question.status });
      setActiveQuestionId(pendingQuestion.id);
      setPendingQuestion(null);
    } catch { setDeliveryError("Delivery could not be confirmed. Retry safely without creating a duplicate."); }
    finally { deliveryLock.current = false; setSendingQuestion(false); }
  }

  function withDelivery(question) {
    const saved = delivery?.questions.find(item => item.sourceId === question.id);
    if (!saved) return question;
    return { ...question, persistedId: saved.id, review: saved.review, submission: saved.submission,
      answer: saved.referenceAnswer, correctOptionIndex: saved.correctOptionIndex, depth: saved.depth,
      status: saved.review?.approvedGrade ? "EVALUATED" : saved.status,
      grade: ["POOR", "AVERAGE", "GOOD", "EXCELLENT"].indexOf(saved.review?.approvedGrade) + 1 || null,
      notes: saved.review?.notes || "", candidateAnswer: saved.submission?.answer || "" };
  }

  const { messages, setMessages, preferences, setPreferences, activeQuestionId, setActiveQuestionId,
    input, setInput, ready, syncing, historyError, setHistoryError, storageWarning, syncHistory } = useBuddyHistory(callId, sessionId, delivery?.userId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const busyRef = useRef(false);
  const retryRef = useRef(null);
  const [canRetry, setCanRetry] = useState(false);
  const followLatestRef = useRef(true);
  const [warning, setWarning] = useState("");
  const scrollRef = useRef(null);
  const composerRef = useRef(null);

  // ==============================================
  // QUESTION STATE
  // ==============================================

  const questionMap = new Map();
  for (const message of messages) for (const question of message.cards || []) questionMap.set(question.id, withDelivery(question));
  for (const saved of delivery?.questions || []) {
    if (!questionMap.has(saved.sourceId)) questionMap.set(saved.sourceId, withDelivery({ ...saved, id: saved.sourceId, answer: saved.referenceAnswer }));
  }
  const questions = [...questionMap.values()];
  const reviews = questions.filter(q => q.submission).sort((a, b) => Number(Boolean(a.review?.approvedGrade)) - Number(Boolean(b.review?.approvedGrade)));
  const pendingReviews = reviews.filter(q => !q.review?.approvedGrade).length;

  const activeQuestion =
    questions.find(
      (question) => question.id === activeQuestionId
    ) || null;

  const askedCount = questions.filter(
    (question) =>
      ["ASKED", "SENT", "ANSWERED"].includes(question.status) ||
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
    grillLevel = "DEEPER",
    retry = false,
  } = {}) {
    if (!ready || syncing || historyError || busyRef.current) return;

    const instruction = text.trim();

    if (
      !retry && !instruction &&
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
    setCanRetry(false);
    followLatestRef.current = true;
    setWarning("");
    setError("");

    const focusedQuestion =
      parent || activeQuestion;

    const requestPreferences = {
      ...preferences,
      mode: guided ? "GUIDED" : "FREE_FLOW",
    };

    // Explicit Grill always retains parent context.
    const displayText =
      mode === "GRILL"
        ? `Grill: ${focusedQuestion?.question || "Question"}${
            instruction ? `\nFocus: ${instruction}` : ""
          }`
        : guided && !instruction
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
      createdAt: new Date().toISOString(),
      text: displayText,
      cards: [],
    };

    const nextMessages = retry ? messages : [...messages, userMessage];

    setMessages(nextMessages);

    if (!retry && mode !== "GRILL") {
      setInput("");
    }

    try {
      const request = retry ? retryRef.current : {
          callId,
          requestId: userMessage.id,
          preferences: requestPreferences,
          instruction: instruction || displayText,
          mode,
          forceQuestions,
          history: buildHistory(),
          messages: nextMessages.map((message) => ({
            role: message.role,
            text: message.text,
          })),
          activeQuestion: focusedQuestion,
          grillLevel,
        };
      retryRef.current = request;
      const result = await generateInterviewQuestions(request);

      if (!result || result.error) {
        throw new Error(
          result?.error ||
            "Unable to get an AI response."
        );
      }

      retryRef.current = null;
      if (result.persistenceError) setHistoryError(result.persistenceError);
      setWarning(result.warning || "");
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
        ...previous.filter(message => message.id !== result.messageId),
        {
          id: result.messageId || createId(),
          createdAt: new Date().toISOString(),
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
      setCanRetry(Boolean(retryRef.current));
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
      grillLevel: depth,
      parent: question,
      text: `${depthPrompt} ${hint}`.trim(),
    });
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
        send({ text: input, forceQuestions: tab === "questions" });
      }
    }
  }

  // ==============================================
  // SCROLL MANAGEMENT
  // ==============================================

  function scrollToBottom() {
    followLatestRef.current = true;
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

    followLatestRef.current = remaining <= 180;
    setShowScrollBottom(remaining > 180);
  }

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !followLatestRef.current) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, loading, tab]);

  // ==============================================
  // RENDER
  // ==============================================

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">

      <Dialog open={!!pendingQuestion} onOpenChange={(open) => { if (!open && !deliveryLock.current) setPendingQuestion(null); }}>
        <DialogContent showCloseButton={!sendingQuestion} className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send question to {intervieweeName}?</DialogTitle>
            <DialogDescription>Confirm to save this question and deliver it in the interview Chat. The reference answer and private notes stay hidden.</DialogDescription>
          </DialogHeader>
          {pendingQuestion && <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{pendingQuestion.topic} · {pendingQuestion.difficulty} · {pendingQuestion.type}</p>
            <AIResponse content={pendingQuestion.question} />
            {pendingQuestion.options?.map((option, index) => <p key={index} className="rounded border border-border p-2 text-sm">{String.fromCharCode(65 + index)}. {option}</p>)}
          </div>}
          {deliveryError && <p role="alert" className="text-sm text-danger">{deliveryError}</p>}
          <DialogFooter>
            <button type="button" disabled={sendingQuestion} onClick={() => setPendingQuestion(null)} className="rounded-lg border border-border px-4 py-2 disabled:opacity-50">Cancel</button>
            <button type="button" disabled={sendingQuestion} onClick={confirmQuestion} className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-zinc-950 disabled:opacity-50">{sendingQuestion ? "Sending..." : deliveryError ? "Retry send" : "Confirm and send"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-amber-400/10 text-brand"><Sparkles size={18} /></span>
          <div><h2 className="text-sm font-semibold">AI Buddy</h2><p className="text-xs text-muted-foreground">Private interview workspace</p></div>
        </div>
        <button type="button" onClick={() => delivery?.refresh()} disabled={delivery?.refreshing} title="Sync questions and evaluations" aria-label="Sync questions and evaluations" className="workspace-icon-button">
          <RefreshCw size={16} className={delivery?.refreshing ? "animate-spin" : ""} />
        </button>
      </header>
      <div role="tablist" aria-label="AI Buddy workspace" className="grid shrink-0 grid-cols-3 gap-1 border-b border-border bg-surface/50 p-2">
        {[["questions", "Questions", ListChecks], ["evaluations", "Evaluations", ShieldCheck], ["ask", "Ask AI", MessageSquare]].map(([id, label, Icon]) => (
          <button key={id} id={`buddy-tab-${id}`} type="button" role="tab" tabIndex={tab === id ? 0 : -1} aria-selected={tab === id} aria-controls={`buddy-panel-${id}`} onClick={() => setTab(id)}
            onKeyDown={event => {
              const tabs = ["questions", "evaluations", "ask"];
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[2] : tabs[(tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 2)) % tabs.length];
              setTab(next); document.getElementById(`buddy-tab-${next}`)?.focus();
            }}
            className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors ${tab === id ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}>
            <Icon size={15} className="hidden min-[400px]:block" />{label}
            {id === "evaluations" && pendingReviews > 0 && <span className="rounded-full bg-amber-400/15 px-1.5 text-xs text-brand">{pendingReviews}</span>}
          </button>
        ))}
      </div>
      {(historyError || delivery?.error) && (
        <div role="alert" className="shrink-0 border-b border-danger/20 bg-danger/5 px-4 py-2 text-xs leading-5 text-danger">
          {historyError || delivery?.error}
          <button
            type="button"
            disabled={syncing || delivery?.refreshing}
            onClick={() => {
              if (historyError) void syncHistory();
              else void delivery?.refresh();
            }}
            className="ml-2 font-semibold underline disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Retry sync"}
          </button>
        </div>
      )}
      <div hidden={tab !== "questions"} role="tabpanel" id="buddy-panel-questions" aria-labelledby="buddy-tab-questions" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <AIBuddyFilters value={preferences} onChange={setPreferences} disabled={loading || !ready || syncing || Boolean(historyError)} onGenerate={() => send({ text: input, forceQuestions: true, guided: true })} />
        <div className="mb-3 mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{questions.length} questions · {askedCount} sent</span><span>{gradedCount} graded</span>
        </div>
        {!questions.length && <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
          <ListChecks size={22} className="mx-auto mb-3 text-brand" />
          <p className="text-sm font-medium">No questions yet</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Ask AI Buddy to suggest questions, or choose a topic in Question Curation.</p>
          <button type="button" disabled={loading || !ready || syncing || Boolean(historyError)} onClick={() => send({ forceQuestions: true, guided: true })} className="workspace-primary mt-4">Suggest questions</button>
        </div>}
        <div className="space-y-3">{questions.map(question => <AIQuestionCard key={question.id} question={question} isActive={activeQuestionId === question.id} loading={loading || sendingQuestion || syncing || Boolean(historyError)}
          onSelect={q => { setDeliveryError(""); setPendingQuestion(q); }}
          onSkip={q => updateQuestion(q.id, { status: "SKIPPED" })} onGrill={handleGrill}
          onReview={q => {
            setFocusedReview(q.id); setTab("evaluations");
            requestAnimationFrame(() => document.getElementById(`review-${q.id}`)?.scrollIntoView({ block: "nearest" }));
          }} />)}</div>
      </div>
      <div hidden={tab !== "evaluations"} role="tabpanel" id="buddy-panel-evaluations" aria-labelledby="buddy-tab-evaluations" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <section className="mb-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-end justify-between gap-3"><div><p className="text-xs text-muted-foreground">Interview score</p><p className="mt-1 text-2xl font-semibold tabular-nums">{delivery?.scoring?.overallScore == null ? "—" : delivery.scoring.overallScore.toFixed(1)}<span className="ml-1 text-sm font-normal text-muted-foreground">/ 100</span></p></div><span className="text-xs text-muted-foreground">{delivery?.scoring?.state === "PROVISIONAL" ? "Provisional" : "Approved grades"}</span></div>
          <div className="mt-4 grid grid-cols-3 divide-x divide-border border-t border-border pt-3 text-center text-xs text-muted-foreground">
            <p><span className="mb-1 block text-base font-semibold text-foreground">{askedCount}</span>Asked</p><p><span className="mb-1 block text-base font-semibold text-foreground">{reviews.length}</span>Answered</p><p><span className="mb-1 block text-base font-semibold text-foreground">{gradedCount}</span>Graded</p>
          </div>
          <details className="mt-3 text-xs leading-5 text-muted-foreground"><summary className="cursor-pointer py-1">Score breakdown</summary><p className="mt-2">Main: {delivery?.scoring?.mainScore?.toFixed(1) ?? "—"} · Grill: {delivery?.scoring?.grillScore?.toFixed(1) ?? "—"}</p><p>Grill adds a bonus only. Unanswered and unapproved questions are excluded, not scored as zero.</p></details>
        </section>
        {!reviews.length && <div className="rounded-xl border border-dashed border-border p-6 text-center"><ShieldCheck size={22} className="mx-auto mb-3 text-brand" /><p className="text-sm font-medium">No answers to review yet</p><p className="mt-1 text-sm text-muted-foreground">{askedCount ? "Waiting for candidate response." : "Send a question from the Questions tab to get started."}</p></div>}
        <div className="space-y-3">{reviews.map(q => <details key={q.id} id={`review-${q.id}`} open={focusedReview === q.id || undefined} className="rounded-xl border border-border bg-surface" onToggle={event => { if (!event.currentTarget.open && focusedReview === q.id) setFocusedReview(null); }}>
          <summary className="cursor-pointer p-4 text-sm"><span className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{q.topic} · {q.difficulty}</span><span className="ml-auto rounded-full bg-background px-2 py-1 text-brand">{q.review?.approvedGrade ? `${q.review.approvedGrade} · ${q.review.approvedScore ?? "—"}` : "Needs review"}</span></span><span className="line-clamp-2 font-medium leading-6">{q.question}</span></summary>
          <div className="border-t border-border p-3"><AnswerReview question={q} /></div>
        </details>)}</div>
      </div>
      <div hidden={tab !== "ask"} role="tabpanel" id="buddy-panel-ask" aria-labelledby="buddy-tab-ask" className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto overscroll-contain space-y-5 p-4">
          {!messages.length && <div className="rounded-xl border border-dashed border-border p-6"><p className="text-sm font-medium">A little help, when you need it</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Ask AI Buddy for questions, explanations, or code solutions. This conversation is private to you.</p></div>}
          {messages.map(message => <article key={message.id} className="min-w-0">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{message.role === "user" ? "You" : "AI Buddy"}</p>
            <div className={`min-w-0 rounded-xl p-3.5 ${message.role === "user" ? "bg-amber-400/10" : "border border-border bg-surface"}`}>
              <AIResponse content={message.text} />
              {message.cards?.length > 0 && <button type="button" onClick={() => setTab("questions")} className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-brand"><ListChecks size={16} />View {message.cards.length} question{message.cards.length === 1 ? "" : "s"}</button>}
              {message.sources?.length > 0 && <details className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Sources ({message.sources.length})</summary><div className="mt-2 space-y-2">{message.sources.filter(source => /^https?:\/\//i.test(source.url)).map((source, i) => <a key={i} href={source.url} target="_blank" rel="noopener noreferrer" className="block break-words text-brand underline">{source.title}</a>)}</div></details>}
            </div>
          </article>)}
        </div>
        {showScrollBottom && <button type="button" onClick={scrollToBottom} aria-label="Scroll to latest message" className="workspace-icon-button absolute bottom-3 right-4 rounded-full bg-background shadow-md"><ArrowDown size={16} /></button>}
      </div>
      {loading && <div role="status" className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2 text-sm text-muted-foreground"><LoadingSpinner className="size-4" label="AI Buddy is thinking" />{tab === "questions" ? "Generating questions…" : "AI Buddy is thinking…"}</div>}
      {(error || warning) && <div role={error ? "alert" : "status"} className={`shrink-0 border-t border-border px-4 py-2 text-xs leading-5 ${error ? "text-danger" : "text-muted-foreground"}`}>{error || warning}{error && canRetry && <button type="button" disabled={loading || syncing} onClick={() => send({ retry: true })} className="ml-2 font-semibold underline">Retry request</button>}</div>}
      {tab !== "evaluations" && <div className="shrink-0 border-t border-border bg-background p-3">
        {tab === "ask" && <div className="mb-2 flex flex-wrap gap-1.5">{["Next question", "Harder", "Easier", "Explain selected"].map(prompt => <button key={prompt} type="button" disabled={loading || !ready || syncing || Boolean(historyError)} onClick={() => send({ text: prompt })} className="rounded-full border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">{prompt}</button>)}</div>}
        <form onSubmit={event => { event.preventDefault(); send({ text: input, forceQuestions: tab === "questions" }); }} className="rounded-xl border border-border bg-surface p-2 focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/10">
          <label htmlFor="buddy-composer" className="sr-only">{tab === "questions" ? "Describe the questions you need" : "Message AI Buddy"}</label>
          <textarea id="buddy-composer" ref={composerRef} rows={2} maxLength={1200} value={input} onChange={event => setInput(event.target.value)} onKeyDown={onMessageKeyDown} placeholder={tab === "questions" ? "e.g. Two medium React questions about hooks…" : "Ask for an explanation, solution, or follow-up…"} className="max-h-28 w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-6 outline-none placeholder:text-muted-foreground" />
          <div className="flex items-center justify-between gap-2 px-1"><span className="text-xs text-muted-foreground">{syncing ? "Syncing history…" : "Shift + Enter for a new line"}</span><button type="submit" disabled={loading || !ready || syncing || Boolean(historyError) || !input.trim()} className="workspace-primary flex items-center gap-2"><Send size={15} />{tab === "questions" ? "Generate" : "Send"}</button></div>
        </form>
      </div>}
      {storageWarning && <p role="status" className="shrink-0 border-b border-border bg-amber-400/5 px-4 py-2 text-xs leading-5 text-brand">{storageWarning}</p>}
    </div>
  );
}
