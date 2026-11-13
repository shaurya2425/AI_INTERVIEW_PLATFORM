import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { actionFailure, runAction, UNEXPECTED_ACTION_ERROR } from "../lib/action-result.js";
import { validateTimeWindow, validateDateRange } from "../lib/time-validation.js";

function loadAction(file, name, overrides = {}) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
    .replace(/^import[\s\S]*?;\r?\n/gm, "")
    .replaceAll("export const ", "const ");
  return runInNewContext(`${source}\n${name};`, {
    actionFailure, runAction, validateTimeWindow, validateDateRange,
    currentUser: async () => null,
    createRateLimiter: () => ({}),
    Resend: class {},
    process: { env: { ADMIN_PAYOUT_PASSWORD: "test-only-password" } },
    console: { error() {} },
    ...overrides,
  });
}

test("availability rejects the screenshot's reversed range and equal times", () => {
  assert.match(validateTimeWindow("18:00", "12:00"), /after start time/);
  assert.match(validateTimeWindow("12:00", "12:00"), /after start time/);
  assert.match(validateTimeWindow("", "12:00"), /both/);
  assert.match(validateTimeWindow("25:00", "26:00"), /valid/);
  assert.equal(validateTimeWindow("18:00", "22:00"), null);
});

test("server rejects invalid dates and reversed ranges, including UTC offsets", () => {
  assert.match(validateDateRange("invalid", "also invalid"), /valid/);
  assert.match(validateDateRange(null, "2026-11-13T12:00:00Z"), /both/);
  assert.match(validateDateRange("2026-11-13T18:00:00+05:30", "2026-11-13T12:00:00+05:30"), /after/);
  assert.equal(validateDateRange("2026-11-13T18:00:00+05:30", "2026-11-13T22:00:00+05:30"), null);
});

test("availability returns a serializable error and never writes an invalid range", async () => {
  let writes = 0;
  const save = loadAction("actions/dashboard.js", "setAvailability", {
    currentUser: async () => ({ id: "test" }),
    db: { user: { findUnique: async () => ({ id: "test", role: "INTERVIEWER" }) },
      availability: { findFirst: async () => { writes++; } } },
  });
  for (const [startTime, endTime] of [["invalid", "invalid"], ["2026-11-13T18:00:00Z", "2026-11-13T12:00:00Z"]]) {
    const result = await save({ startTime, endTime });
    assert.equal(result.success, false);
    assert.equal(typeof JSON.parse(JSON.stringify(result)).error, "string");
  }
  assert.equal(writes, 0);
});

for (const existing of [null, { id: "availability-1" }]) {
  test(`valid availability ${existing ? "updates" : "creates"} and returns success`, async () => {
    const writes = [];
    const save = loadAction("actions/dashboard.js", "setAvailability", {
      currentUser: async () => ({ id: "test" }),
      db: { user: { findUnique: async () => ({ id: "test", role: "INTERVIEWER" }) },
        availability: {
          findFirst: async () => existing,
          create: async (args) => writes.push(["create", args]),
          update: async (args) => writes.push(["update", args]),
        } },
      revalidatePath() {},
    });
    const result = await save({ startTime: "2026-11-13T18:00:00Z", endTime: "2026-11-13T22:00:00Z" });
    assert.equal(result.success, true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0][0], existing ? "update" : "create");
  });
}

for (const [file, name] of [
  ["actions/dashboard.js", "setAvailability"],
  ["actions/dashboard.js", "requestWithdrawal"],
  ["actions/bookings.js", "bookSlot"],
  ["actions/onboarding.js", "completeOnboarding"],
  ["actions/aiQuestions.js", "generateInterviewQuestions"],
]) {
  test(`${name} returns authentication failures instead of throwing`, async () => {
    const result = await loadAction(file, name)({});
    assert.equal(result.success, false);
    assert.equal(typeof result.error, "string");
  });
}

test("payout password errors are returned without touching the database", async () => {
  const approve = loadAction("actions/payout.js", "approvePayout");
  assert.equal((await approve({})).error, "Password required");
  assert.equal((await approve({ adminPassword: "wrong" })).error, "Incorrect password");
});

function loadHook(callback) {
  const values = [];
  const toasts = [];
  const source = readFileSync(new URL("../hooks/use-fetch.js", import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "")
    .replace("export default useFetch;", "useFetch;");
  const runMockedHook = runInNewContext(source, {
    UNEXPECTED_ACTION_ERROR,
    useState(initial) {
      const index = values.length;
      values.push(initial);
      return [initial, (value) => { values[index] = value; }];
    },
    toast: { error: (message) => toasts.push(message) },
  });
  return { hook: runMockedHook(callback), values, toasts };
}

test("shared hook displays expected errors and clears stale success data", async () => {
  let fail = false;
  const { hook, values, toasts } = loadHook(async () => fail ? actionFailure("Slot already booked") : { success: true });
  await hook.fn();
  assert.equal(values[0].success, true);
  fail = true;
  await hook.fn();
  assert.equal(values[0], undefined);
  assert.equal(values[1], false);
  assert.equal(values[2], "Slot already booked");
  assert.deepEqual(toasts, ["Slot already booked"]);
  hook.clearError();
  assert.equal(values[2], null);
});

test("shared hook never exposes minified React errors or raw network errors", async () => {
  for (const error of [new Error("Minified React error #441"), new Error("internal database connection details"), "network failure"]) {
    const { hook, values, toasts } = loadHook(async () => { throw error; });
    await hook.fn();
    assert.equal(values[0], undefined);
    assert.equal(values[1], false);
    assert.equal(values[2], UNEXPECTED_ACTION_ERROR);
    assert.deepEqual(toasts, [UNEXPECTED_ACTION_ERROR]);
  }
});

test("unexpected server failures return only the safe fallback", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  const result = await runAction(async () => {
    throw new Error("private database details");
  }, "Unable to save availability. Please try again.");
  assert.equal(result.success, false);
  assert.equal(result.error, "Unable to save availability. Please try again.");
  assert.equal(JSON.stringify(result).includes("private database"), false);
  assert.equal(log.mock.callCount(), 1);
});
