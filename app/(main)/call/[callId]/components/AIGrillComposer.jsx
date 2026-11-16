
"use client";

import { useState } from "react";
import { Flame, X } from "lucide-react";

export default function AIGrillComposer({
  onSubmit,
  onCancel,
  disabled = false,
}) {
  const [hint, setHint] = useState("");
  const [depth, setDepth] = useState("DEEPER");

  function submit(event) {
    event.preventDefault();

    onSubmit({
      hint: hint.trim(),
      depth,
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Flame size={15} className="text-brand" />
          Grill deeper
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close Grill"
        >
          <X size={16} />
        </button>
      </div>

      <textarea
        value={hint}
        rows={2}
        maxLength={600}
        disabled={disabled}
        onChange={(e) => setHint(e.target.value)}
        placeholder="Optional hint: probe race conditions, edge cases, complexity, tradeoffs..."
        className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-amber-400/30"
      />

      <div className="grid grid-cols-3 gap-1.5">
        {[
          ["CLARIFY", "Clarify"],
          ["DEEPER", "Deeper"],
          ["CHALLENGE", "Challenge"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onClick={() => setDepth(value)}
            className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
              depth === value
                ? "border-amber-400/50 bg-amber-400/10 text-brand"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="h-9 w-full rounded-lg bg-amber-400 text-sm font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-50"
      >
        Generate follow-up
      </button>
    </form>
  );
}
