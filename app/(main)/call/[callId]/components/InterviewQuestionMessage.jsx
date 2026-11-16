"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { MessageSimple, useMessageContext } from "stream-chat-react";
import { toast } from "sonner";
import { getInterviewQuestions, submitInterviewAnswer } from "@/actions/interviewQuestions";
import AIResponse, { CodeView } from "./AIResponse";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import CandidateAnswerEditor from "./CandidateAnswerEditor";

const QuestionContext = createContext(null);
export const useInterviewQuestions = () => useContext(QuestionContext);

export function InterviewQuestionProvider({ callId, userId, isInterviewer, channel, client, children }) {
  const [questions, setQuestions] = useState([]);
  const [scoring, setScoring] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const inFlight = useRef(false);
  const refreshAgain = useRef(false);
  const mounted = useRef(false);
  const revision = useRef(0);
  const invalidate = useCallback(() => { ++revision.current; }, []);
  const refresh = useCallback(async () => {
    if (inFlight.current) { refreshAgain.current = true; return; }
    inFlight.current = true;
    setRefreshing(true);
    do {
      refreshAgain.current = false;
      const request = ++revision.current;
      try {
        const result = await getInterviewQuestions(callId);
        if (!mounted.current || request !== revision.current) continue;
        if (!result.success) { setError(result.error); continue; }
        setQuestions(result.questions);
        setScoring(result.scoring || null);
        setInitialized(true);
        setError("");
      } catch {
        if (mounted.current && request === revision.current) setError("Unable to load questions. Refresh to retry.");
      }
    } while (mounted.current && refreshAgain.current);
    inFlight.current = false;
    if (mounted.current) setRefreshing(false);
  }, [callId]);
  const acceptQuestion = useCallback((question) => {
    ++revision.current;
    setQuestions(previous => [...previous.filter(q => q.id !== question.id), question]);
  }, []);

  useEffect(() => {
    mounted.current = true;
    let timer;
    const initial = setTimeout(refresh, 0);
    const subscription = channel?.on("message.new", event => {
      if (!event.message?.prept_question_id) return;
      // Stream can publish before the database delivery acknowledgment is saved.
      void refresh();
      clearTimeout(timer);
      timer = setTimeout(refresh, 1500);
    });
    const committed = channel?.on("prept.question.updated", () => { void refresh(); });
    const recovered = client?.on("connection.recovered", () => { void refresh(); });
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      mounted.current = false;
      invalidate();
      clearTimeout(initial);
      clearTimeout(timer);
      subscription?.unsubscribe();
      committed?.unsubscribe();
      recovered?.unsubscribe();
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh, channel, client, invalidate]);

  // Events are only wake-ups. Poll while waiting for questions/answers too,
  // so a missed notification cannot hide a durable submission indefinitely.
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 4000);
    return () => clearInterval(timer);
  }, [refresh]);

  const seenAnswers = useRef(null);
  useEffect(() => {
    if (!initialized) return;
    const answered = new Set(questions.filter(q => q.submission).map(q => `${q.id}:${q.submission.revision || 1}`));
    if (isInterviewer && seenAnswers.current) {
      for (const id of answered) if (!seenAnswers.current.has(id)) toast.success("Candidate submitted an answer. Open AI Buddy / Evaluations to review.", { id: `answer-${id}` });
    }
    seenAnswers.current = answered;
  }, [questions, isInterviewer, initialized]);

  return <QuestionContext.Provider value={{ callId, userId, isInterviewer, questions, scoring, error, refreshing, refresh, acceptQuestion }}>
    {children}
  </QuestionContext.Provider>;
}

export function InterviewQuestionStatus() {
  const { error, refresh, refreshing } = useInterviewQuestions();
  return <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-3 py-2 text-xs text-muted-foreground">
    <span role={error ? "alert" : "status"} className={error ? "text-danger" : "flex items-center gap-1.5"}>{!error && <CheckCircle2 size={14} />}{error || "Interview chat"}</span>
    <button type="button" disabled={refreshing} title="Sync saved questions and answers" aria-label="Sync saved questions and answers" className="workspace-icon-button size-8" onClick={refresh}><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /></button>
  </div>;
}

export function InterviewChatMessage(props) {
  const { message } = useMessageContext();
  const context = useInterviewQuestions();
  const id = message.prept_question_id;
  const kind = message.prept_kind;
  // Ordinary Stream messages keep their existing renderer and controls.
  const revision = message.prept_submission_revision || 1;
  const messageId = `prept-${kind}-${id}${kind === "answer" && revision > 1 ? `-r${revision}` : ""}`;
  if (!context || !["question", "answer"].includes(kind) || typeof id !== "string" || message.id !== messageId) {
    return <MessageSimple {...props} />;
  }
  if (kind === "answer") return null;
  const question = context.questions.find(q => q.id === id);
  if (!question) return <div className="m-3 rounded-lg border border-border bg-background p-3 text-sm text-foreground">
    Question delivery is synchronizing.
    <button type="button" className="ml-2 underline" onClick={context.refresh}>Refresh</button>
  </div>;
  return <CandidateQuestionCard key={`${context.userId}:${id}`} question={question} />;
}

const buttonClass = "rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50";

function CandidateQuestionCard({ question }) {
  const { callId, userId, isInterviewer, acceptQuestion } = useInterviewQuestions();
  const draftKey = `prept-answer:${userId}:${callId}:${question.id}`;
  const code = ["CODING", "SQL_QUERY", "DEBUGGING"].includes(question.type);
  const dictation = ["CONCEPTUAL", "SCENARIO", "BEHAVIORAL"].includes(question.type);
  const [answer, setAnswer] = useState("");
  const [optionIndex, setOptionIndex] = useState(null);
  const [language, setLanguage] = useState(question.type === "SQL_QUERY" ? "sql" : "javascript");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [editing, setEditing] = useState(false);
  const [baseRevision, setBaseRevision] = useState(0);
  const requestRef = useRef(null);
  const [speechState, setSpeechState] = useState("checking");
  const [speechError, setSpeechError] = useState("");
  const [speechLanguage, setSpeechLanguage] = useState("en-IN");
  const [interim, setInterim] = useState("");
  const recognition = useRef(null);
  const lock = useRef(false);
  const submitted = question.submission;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setSpeechState(window.SpeechRecognition || window.webkitSpeechRecognition ? "idle" : "unsupported");
      if (!isInterviewer) {
        try {
          const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
          if (typeof saved?.answer === "string") setAnswer(saved.answer.slice(0, 30000));
          if (Number.isInteger(saved?.optionIndex) && saved.optionIndex >= 0 && saved.optionIndex < 4) setOptionIndex(saved.optionIndex);
          if (typeof saved?.language === "string") setLanguage(saved.language);
          if (saved?.editing) setEditing(true);
          if (Number.isInteger(saved?.baseRevision)) setBaseRevision(saved.baseRevision);
          if (saved?.request) requestRef.current = saved.request;
        } catch { /* A missing/corrupt draft must not block writing an answer. */ }
      }
      setReady(true);
    });
    const stopWhenHidden = () => { if (document.hidden) recognition.current?.stop(); };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", stopWhenHidden);
      if (recognition.current) {
        recognition.current.onresult = null;
        recognition.current.onend = null;
        recognition.current.onerror = null;
        recognition.current.abort();
      }
    };
  }, [draftKey, isInterviewer]);

  useEffect(() => {
    if (!ready || isInterviewer) return;
    try {
      if (submitted && !editing) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify({ answer, optionIndex, language, editing, baseRevision, request: requestRef.current }));
    } catch { /* Editing/submitting remains available without browser storage. */ }
    if (submitted && !editing) recognition.current?.abort();
  }, [ready, isInterviewer, submitted, draftKey, answer, optionIndex, language, editing, baseRevision]);

  function toggleDictation() {
    if (recognition.current) { recognition.current.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || (submitted && !editing) || lock.current) return;
    const speech = new SpeechRecognition();
    recognition.current = speech;
    speech.lang = speechLanguage;
    speech.continuous = true;
    speech.interimResults = true;
    setSpeechError("");
    setSpeechState("listening");
    speech.onresult = event => {
      let final = "", partial = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += `${event.results[i][0].transcript} `;
        else partial += event.results[i][0].transcript;
      }
      if (final) setAnswer(previous => `${previous}${previous ? " " : ""}${final.trim()}`.slice(0, 30000));
      setInterim(partial);
    };
    speech.onerror = event => {
      const messages = {
        "not-allowed": "Microphone permission denied. Allow microphone access in browser settings, or type your answer.",
        "service-not-allowed": "Browser dictation is blocked. You can still type your answer.",
        "audio-capture": "No microphone is available. Connect one or type your answer.",
        "no-speech": "No speech detected. Try dictation again or type your answer.",
        network: "Speech service could not connect. Retry dictation or type your answer.",
      };
      if (event.error !== "aborted") setSpeechError(messages[event.error] || "Dictation stopped. Retry or type your answer.");
    };
    speech.onend = () => { recognition.current = null; setSpeechState("idle"); setInterim(""); };
    try { speech.start(); }
    catch { recognition.current = null; setSpeechState("idle"); setSpeechError("Dictation could not start. Check microphone permission or type your answer."); }
  }

  async function submit(event) {
    event.preventDefault();
    if (lock.current || isInterviewer || !ready) return;
    if (recognition.current) { setError("Stop dictation and review the text before submitting."); return; }
    if ((!submitted || editing) && (question.type === "MCQ" ? optionIndex === null : !answer.trim())) {
      setError(question.type === "MCQ" ? "Choose one option." : "Write an answer before submitting."); return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = { callId, questionId: question.id, answer, optionIndex, language };
      if (question.type !== "MCQ" && (!submitted || editing)) {
        payload.expectedRevision = baseRevision;
        const key = JSON.stringify(payload);
        if (requestRef.current?.key !== key) requestRef.current = { key, id: crypto.randomUUID() };
        payload.requestId = requestRef.current.id;
        try { localStorage.setItem(draftKey, JSON.stringify({ answer, optionIndex, language, editing, baseRevision, request: requestRef.current })); } catch { /* Server revision checks still prevent stale writes. */ }
      }
      const result = await submitInterviewAnswer(payload);
      if (!result.success) { setError(result.error); return; }
      acceptQuestion(result.question);
      setEditing(false);
      requestRef.current = null;
      setWarning(result.warning || "");
    } catch { setError("Submission could not be confirmed. Retry safely; your draft is preserved."); }
    finally { lock.current = false; setBusy(false); }
  }

  return <article className="m-2 min-w-0 space-y-4 rounded-xl border border-border bg-background p-4 text-foreground sm:m-3">
    <p className="text-xs text-muted-foreground">{question.topic} · {question.difficulty} · {question.type.replaceAll("_", " ")}</p>
    <AIResponse content={question.question} />
    <p role="status" className="text-xs font-semibold">{submitted ? question.type === "MCQ" ? "Submitted · final answer" : `Submitted · attempt ${submitted.revision || 1}${editing ? " · editing a new attempt" : ""}` : "Sent / Awaiting answer"}</p>
    <form onSubmit={submit} className="space-y-3">
      {question.type === "MCQ" ? <fieldset disabled={isInterviewer || !!submitted || busy || !ready} className="space-y-2">
        <legend className="mb-2 text-sm">Select one answer</legend>
        {question.options.map((option, index) => <label key={index} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm leading-6 transition-colors has-checked:border-brand/50 has-checked:bg-amber-400/10">
          <input className="mt-1.5 accent-amber-500" type="radio" name={`option-${question.id}`} checked={(submitted ? submitted.optionIndex : optionIndex) === index} onChange={() => setOptionIndex(index)} />
          <span>{String.fromCharCode(65 + index)}. {option}</span>
        </label>)}
      </fieldset> : submitted && !editing ? <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs text-success"><CheckCircle2 size={14} />Answer saved to this interview</p>
        {code ? <CodeView code={submitted.answer} language={submitted.language || "text"} /> : <p className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-surface p-3 text-sm leading-6">{submitted.answer}</p>}
        {!isInterviewer && <button type="button" disabled={busy} className={`${buttonClass} mt-3`} onClick={() => { setAnswer(submitted.answer); setLanguage(submitted.language || language); setBaseRevision(submitted.revision || 1); setEditing(true); setError(""); setWarning(""); }}>Edit & resubmit</button>}
      </div> : !isInterviewer && <>
        <CandidateAnswerEditor question={question} answer={answer} setAnswer={setAnswer} language={language} setLanguage={setLanguage} code={code} disabled={busy || !ready} error={error} onSubmit={submit} />
        {dictation && <div className="space-y-2 text-xs">
          {speechState === "unsupported" ? <p>Dictation is not supported by this browser. Type your answer or use a browser with speech recognition.</p> : <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Dictation language" value={speechLanguage} onChange={e => setSpeechLanguage(e.target.value)} disabled={speechState === "listening" || busy} className="rounded border border-border bg-background p-2">
              <option value="en-IN">English (India)</option><option value="hi-IN">Hindi (India)</option>
            </select>
            <button type="button" disabled={busy || !ready || speechState === "checking"} onClick={toggleDictation} className={buttonClass}>{speechState === "listening" ? "Stop dictation" : "Start dictation"}</button>
          </div>}
          <p>Dictation uses your browser’s speech service. Review and edit the text before submitting.</p>
          {interim && <p role="status">Hearing: {interim}</p>}
          {speechError && <p role="alert" className="text-danger">{speechError}</p>}
        </div>}
      </>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {warning && <p role="status" className="text-sm">{warning}</p>}
      {!isInterviewer && submitted && !editing && <p role="status" className="rounded-xl border border-border bg-surface p-3 text-sm font-medium">
        Answer submitted — ready for the next question.
      </p>}
      {!isInterviewer && (!submitted || editing) && <button type="submit" disabled={busy || !ready || speechState === "listening"} className="workspace-primary w-full">
        {busy ? "Saving…" : editing ? "Submit updated answer" : "Submit answer"}
      </button>}
      {editing && <button type="button" disabled={busy} className={buttonClass} onClick={() => { recognition.current?.abort(); setEditing(false); requestRef.current = null; }}>Cancel edit</button>}
      {speechState === "listening" && <p className="text-xs">Stop dictation and review your answer before submitting.</p>}
    </form>
    {submitted?.previousAttempts?.length > 0 && <details className="border-t border-border pt-3 text-sm"><summary className="cursor-pointer text-muted-foreground">Previous attempts ({submitted.previousAttempts.length})</summary>
      {submitted.previousAttempts.map(attempt => <div key={attempt.revision} className="mt-3 space-y-2"><p className="font-medium">Attempt {attempt.revision}</p>{code ? <CodeView code={attempt.answer} language={attempt.language || "text"} /> : <p className="whitespace-pre-wrap">{attempt.answer}</p>}</div>)}
    </details>}
  </article>;
}
