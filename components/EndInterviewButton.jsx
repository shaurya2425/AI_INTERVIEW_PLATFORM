"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { completeInterview } from "@/actions/interviewCompletion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function EndInterviewButton({ bookingId, retry = false }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  async function finish() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      const result = await completeInterview(bookingId);
      if (!result.success) { setMessage(result.error); return; }
      setMessage(result.message);
      setOpen(false);
      // Stay in the call until Stream disconnects everyone. If termination is pending,
      // the lifecycle watcher offers a retry and the ordinary Leave control still works.
      if (retry) router.refresh();
    } catch { setMessage("Completion could not be confirmed. Retry safely."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="space-y-2">
    <Button type="button" variant="outline" disabled={busy} onClick={() => retry ? finish() : setOpen(true)}>
      {busy ? "Completing…" : retry ? "Retry finishing shared call" : "End Interview & Generate Feedback"}
    </Button>
    {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
    <Dialog open={open} onOpenChange={value => { if (!lock.current) setOpen(value); }}>
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Permanently end this interview?</DialogTitle>
          <DialogDescription>This ends the call for both participants immediately, even before the scheduled end time. Rejoining will be disabled. Saved answers, grades, chat and recording evidence are preserved. The interview will move to Past Interviews with Preparing Feedback status.</DialogDescription>
        </DialogHeader>
        {message && <p role="alert" className="text-sm">{message}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={busy} onClick={finish}>{busy ? "Completing…" : "End Interview & Generate Feedback"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
