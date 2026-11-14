import test from "node:test";
import assert from "node:assert/strict";
import { getClerkProfileUpdates } from "../lib/clerk-profile.js";

test("a name edited in Clerk overrides the original Google display name", () => {
  const updates = getClerkProfileUpdates({ name: "Google Name", imageUrl: "avatar" }, {
    firstName: " New ", lastName: " Name ", imageUrl: "avatar",
    externalAccounts: [{ firstName: "Google", lastName: "Name" }],
  });
  assert.deepEqual(updates, { name: "New Name" });
});
test("sync changes only the public name and image, preserving app-owned fields", () => {
  const existing = { name: "Old Name", imageUrl: "old", role: "INTERVIEWER", credits: 12, bio: "My bio" };
  assert.deepEqual(getClerkProfileUpdates(existing, { firstName: "New", lastName: "Name", imageUrl: "new", role: "UNASSIGNED" }), {
    name: "New Name", imageUrl: "new",
  });
  assert.equal(existing.role, "INTERVIEWER");
});
test("identical profiles do not need a database write", () => {
  assert.deepEqual(getClerkProfileUpdates({ name: "New Name", imageUrl: "avatar" }, {
    firstName: "New", lastName: "Name", imageUrl: "avatar",
  }), {});
});
test("cleared profile fields do not leave the old name or avatar behind", () => {
  assert.deepEqual(getClerkProfileUpdates({ name: "Old Name", imageUrl: "old" }, {
    firstName: null, lastName: null, username: "new-user", imageUrl: null,
  }), { name: "new-user", imageUrl: null });
});
