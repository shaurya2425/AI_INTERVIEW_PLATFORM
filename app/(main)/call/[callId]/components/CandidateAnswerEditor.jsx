"use client";

import { useState } from "react";
import { Code2, Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import AIResponse from "./AIResponse";

export default function CandidateAnswerEditor({ question, answer, setAnswer, language, setLanguage, code, disabled, error, onSubmit }) {
  const [expanded, setExpanded] = useState(false);
  const editor = <div className="overflow-hidden rounded-xl border border-border bg-background">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2">
      <span className="flex items-center gap-2 text-xs font-medium"><Code2 size={15} />{code ? "Solution editor" : "Your answer"}</span>
      {code && <select aria-label="Answer language" value={language} onChange={event => setLanguage(event.target.value)} disabled={disabled} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
        {["javascript", "typescript", "python", "java", "cpp", "c", "csharp", "go", "rust", "sql", "plaintext"].map(item => <option key={item} value={item}>{item}</option>)}
      </select>}
      {code && !expanded && <button type="button" onClick={() => setExpanded(true)} className="flex min-h-8 items-center gap-1.5 text-xs text-brand"><Maximize2 size={14} />Expand</button>}
    </div>
    <textarea aria-label={code ? "Code or SQL answer" : "Your answer"} rows={code ? 12 : 6} maxLength={30000} value={answer}
      onChange={event => setAnswer(event.target.value)} disabled={disabled} spellCheck={!code} autoCapitalize={code ? "off" : "sentences"} autoCorrect={code ? "off" : "on"}
      onKeyDown={event => {
        if (!code || event.key !== "Tab" || event.shiftKey) return;
        event.preventDefault();
        const element = event.currentTarget, start = element.selectionStart, end = element.selectionEnd;
        if (answer.length - (end - start) + 2 > 30000) return;
        setAnswer(answer.slice(0, start) + "  " + answer.slice(end));
        requestAnimationFrame(() => { element.selectionStart = element.selectionEnd = start + 2; });
      }}
      placeholder={code ? "Write your solution here, or paste it from your IDE…" : "Explain your reasoning and approach…"}
      className={`block w-full resize-y bg-transparent p-4 text-sm leading-6 outline-none focus:ring-2 focus:ring-inset focus:ring-brand/40 disabled:opacity-60 ${code ? "min-h-64 whitespace-pre font-mono" : "min-h-36"} ${expanded ? "min-h-[45dvh]" : ""}`} />
    <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border px-3 py-2 text-xs text-muted-foreground"><span>{code ? "Tab to indent · Shift + Tab to leave editor" : "Review your answer before submitting"}</span><span>{answer.length.toLocaleString()} / 30,000</span></div>
  </div>;
  return <>
    {!expanded && editor}
    <Dialog open={expanded} onOpenChange={setExpanded}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-4 sm:max-w-5xl sm:p-6">
        <DialogHeader><DialogTitle>Write your solution</DialogTitle><DialogDescription>Your draft stays intact when you close this editor. Submit once you are ready.</DialogDescription></DialogHeader>
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="min-w-0"><p className="mb-3 text-xs font-medium text-muted-foreground">{question.topic} · {question.difficulty}</p><AIResponse content={question.question} /></div>
          <div className="min-w-0 space-y-3">{expanded && editor}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setExpanded(false)} className="workspace-secondary">Keep editing in chat</button><button type="button" onClick={onSubmit} disabled={disabled || !answer.trim()} className="workspace-primary">{disabled ? "Saving…" : "Submit solution"}</button></div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
