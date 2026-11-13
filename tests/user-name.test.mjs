import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { getClerkDisplayName, getDisplayName, withDisplayName } from "../lib/user-name.js";

test("optional Clerk name fields never become literal null or undefined", () => {
  assert.equal(getClerkDisplayName({ firstName: "Shaurya Rajput", lastName: null }), "Shaurya Rajput");
  assert.equal(getClerkDisplayName({ firstName: null, lastName: "Rajput" }), "Rajput");
  assert.equal(getClerkDisplayName({ firstName: "  Shaurya ", lastName: " Rajput " }), "Shaurya Rajput");
  assert.equal(getClerkDisplayName({ username: "shaurya" }), "shaurya");
  assert.equal(getClerkDisplayName({ firstName: null, lastName: null }), "User");
});

test("legacy names are cleaned without changing real surnames or other user data", () => {
  for (const name of ["Shaurya Rajput null", "null Shaurya Rajput", "Shaurya Rajput undefined"]) {
    assert.equal(getDisplayName(name), "Shaurya Rajput");
  }
  assert.equal(getDisplayName("null null"), "User");
  assert.equal(getDisplayName(null, "Interviewer"), "Interviewer");
  assert.equal(getDisplayName("Jane Null"), "Jane Null");
  assert.equal(getDisplayName("Jane Nullman"), "Jane Nullman");
  assert.equal(withDisplayName(null), null);
  const original = { name: "Shaurya null", credits: 18 };
  assert.deepEqual(withDisplayName(original), { name: "Shaurya", credits: 18 });
  assert.equal(original.name, "Shaurya null");
});

// Exercise the actual account-sync function with Clerk/Prisma mocked, without
// accessing real accounts, changing balances, or requiring Next's server runtime.
const source = readFileSync(new URL("../lib/checkUser.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "")
  .replace("export const checkUser", "const checkUser");

function setup(existing) {
  const writes = [];
  const db = { user: {
    findUnique: async () => existing,
    update: async ({ data }) => { writes.push(data); return { ...existing, ...data }; },
    create: async ({ data }) => { writes.push(data); return data; },
  } };
  const checkUser = runInNewContext(`${source}\ncheckUser;`, {
    currentUser: async () => ({ id: "test", firstName: "Shaurya Rajput", lastName: null, emailAddresses: [{ emailAddress: "test@example.com" }] }),
    auth: async () => ({ has: () => false }),
    db, getClerkDisplayName, console, Date,
  });
  return { checkUser, writes };
}

for (const role of ["INTERVIEWER", "INTERVIEWEE"]) {
  test(`repairs existing ${role} name without changing credits`, async () => {
    const { checkUser, writes } = setup({ name: "Shaurya Rajput null", role, credits: 18, currentPlan: "free", creditsLastAllocatedAt: new Date() });
    const result = await checkUser();
    assert.equal(result.name, "Shaurya Rajput");
    assert.equal(result.credits, 18);
    assert.deepEqual(Object.keys(writes[0]), ["name"]);
  });
}

test("creates a new account with a clean name and its normal plan credits", async () => {
  const { checkUser } = setup(null);
  const result = await checkUser();
  assert.equal(result.name, "Shaurya Rajput");
  assert.equal(result.credits, 1);
});

test("does not write again once the name and allocation are current", async () => {
  const { checkUser, writes } = setup({ name: "Shaurya Rajput", role: "INTERVIEWEE", currentPlan: "free", creditsLastAllocatedAt: new Date() });
  await checkUser();
  assert.equal(writes.length, 0);
});

test("name repair preserves an otherwise due credit allocation", async () => {
  const { checkUser } = setup({ name: "Shaurya Rajput null", role: "INTERVIEWEE", credits: 18, currentPlan: "free", creditsLastAllocatedAt: null });
  const result = await checkUser();
  assert.equal(result.name, "Shaurya Rajput");
  assert.equal(result.credits, 19);
});
