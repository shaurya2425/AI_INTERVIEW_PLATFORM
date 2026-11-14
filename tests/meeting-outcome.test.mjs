import test from "node:test";
import assert from "node:assert/strict";
import { getMeetingOutcome } from "../lib/meeting-outcome.js";

const now = Date.parse("2026-11-14T12:00:00Z");
const booking = { status: "SCHEDULED", endTime: "2026-11-14T11:00:00Z" };

test("an expired booking with no Stream session is reported as not held", () => {
  assert.equal(getMeetingOutcome(booking, { current_session_id: "" }, [], now).state, "missed");
});
test("a future booking is not marked as missed", () => {
  assert.equal(getMeetingOutcome({ ...booking, endTime: "2026-11-15T11:00:00Z" }, {}, [], now).state, "pending");
});
test("missing transcripts do not imply the meeting did not happen", () => {
  for (const call of [{ current_session_id: "session-1" }, { session: { started_at: "start", ended_at: "end" } }]) {
    assert.equal(getMeetingOutcome(booking, call, [], now).state, "pending");
  }
  for (const attended of [{ ...booking, status: "COMPLETED" }, { ...booking, recordingUrl: "recording" }]) {
    assert.equal(getMeetingOutcome(attended, {}, [], now).state, "pending");
  }
});
test("an active session is pending even after the scheduled end", () => {
  assert.equal(getMeetingOutcome(booking, { session: { started_at: "start" } }, [{}], now).state, "pending");
});
test("saved transcripts allow recovery after a session ends", () => {
  assert.equal(getMeetingOutcome(booking, { session: { ended_at: "end" } }, [{}], now).state, "transcript");
});
test("cancelled meetings never generate performance feedback", () => {
  assert.equal(getMeetingOutcome({ ...booking, status: "CANCELLED" }, {}, [{}], now).state, "cancelled");
});
