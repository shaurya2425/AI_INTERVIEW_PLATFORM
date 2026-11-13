/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GrayTitle } from "@/components/reusables";
import { setAvailability } from "@/actions/dashboard";
import useFetch from "@/hooks/use-fetch";
import { Clock } from "lucide-react";
import { validateTimeWindow } from "@/lib/time-validation";

export default function AvailabilitySection({ initial }) {
  const [startTime, setStartTime] = useState(
    initial?.startTime
      ? new Date(initial.startTime).toTimeString().slice(0, 5)
      : ""
  );
  const [endTime, setEndTime] = useState(
    initial?.endTime ? new Date(initial.endTime).toTimeString().slice(0, 5) : ""
  );
  const [saved, setSaved] = useState(false);

  const { data, loading, error, fn: saveFn, setData, clearError } = useFetch(setAvailability);
  const validationError = validateTimeWindow(startTime, endTime);
  const visibleError = (startTime && endTime && validationError) || error;

  const handleTimeChange = (setTime, value) => {
    setTime(value);
    setSaved(false);
    setData(undefined);
    clearError();
  };

  useEffect(() => {
    if (data?.success) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [data]);

  const toISO = (time) => {
    const [h, m] = time.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const handleSave = () => {
    if (validationError || loading) return;
    saveFn({ startTime: toISO(startTime), endTime: toISO(endTime) });
  };

  const hasWindow = startTime && endTime;
  const duration = hasWindow
    ? (() => {
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);
        const diff = eh * 60 + em - (sh * 60 + sm);
        if (diff <= 0) return null;
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ""}`.trim() : `${m}m`;
      })()
    : null;

  return (
    <section className="bg-card border border-border rounded-2xl p-8 flex flex-col gap-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-lg mb-4">
            <Clock size={18} className="text-brand" />
          </span>
          <h2 className="font-serif text-xl tracking-tight">
            <GrayTitle>Daily availability window</GrayTitle>
          </h2>
          <p className="text-xs text-muted-foreground font-light mt-1">
            Interviewees can book within this window every day.
          </p>
        </div>

        {initial && (
          <Badge
            variant="outline"
            className="shrink-0 border-green-500/20 bg-green-500/10 text-success"
          >
            Active
          </Badge>
        )}
      </div>

      <div className="h-px bg-muted" />

      {/* Time inputs */}
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2 min-w-0">
          <Label htmlFor="availability-start" className="text-muted-foreground text-xs">Start time</Label>
          <Input
            id="availability-start"
            type="time"
            value={startTime}
            disabled={loading}
            aria-invalid={Boolean(startTime && endTime && validationError)}
            aria-describedby={visibleError ? "availability-error" : undefined}
            onChange={(e) => handleTimeChange(setStartTime, e.target.value)}
            className="max-w-full bg-surface border-border text-foreground"
          />
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <Label htmlFor="availability-end" className="text-muted-foreground text-xs">End time</Label>
          <Input
            id="availability-end"
            type="time"
            value={endTime}
            disabled={loading}
            aria-invalid={Boolean(startTime && endTime && validationError)}
            aria-describedby={visibleError ? "availability-error" : undefined}
            onChange={(e) => handleTimeChange(setEndTime, e.target.value)}
            className="max-w-full bg-surface border-border text-foreground"
          />
        </div>
      </div>

      {/* Duration pill */}
      {duration && (
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="border-amber-400/20 bg-amber-400/5 text-brand"
          >
            {duration} window
          </Badge>
          <span className="text-xs text-muted-foreground">
            Interviewees see this as your open booking range
          </span>
        </div>
      )}

      {/* Error */}
      {visibleError && (
        <p id="availability-error" role="alert" className="text-xs text-danger">{visibleError}</p>
      )}

      {/* Save */}
      <Button
        variant="gold"
        disabled={Boolean(validationError) || loading}
        onClick={handleSave}
        className="self-start"
      >
        {loading
          ? "Saving…"
          : saved
          ? "✓ Saved"
          : initial
          ? "Update window"
          : "Set availability"}
      </Button>
    </section>
  );
}
