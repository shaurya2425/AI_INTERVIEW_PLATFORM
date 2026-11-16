// Deletes only the exact synthetic identities created by task3-integration-smoke.mjs.
// Dry run by default; --delete is required to mutate anything.
import { Pool } from "pg";
import { StreamClient } from "@stream-io/node-sdk";
import { StreamChat } from "stream-chat";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
const connection = await pool.connect();
try {
  await connection.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  const { rows: users } = await connection.query(`SELECT id, "clerkUserId", email, name, role FROM "User" WHERE "clerkUserId" LIKE 'prept-task3-%' FOR UPDATE`);
  const identity = /^prept-task3-(interviewer|candidate)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
  for (const u of users) {
    const match = identity.exec(u.clerkUserId);
    if (!match || u.email !== `${u.clerkUserId}@example.invalid` ||
      u.name !== `Task 3 synthetic ${match[1]}` || u.role !== (match[1] === "interviewer" ? "INTERVIEWER" : "INTERVIEWEE")) throw new Error("Fixture identity mismatch");
  }
  const userIds = users.map(u => u.id);
  const byId = new Map(users.map(u => [u.id, u]));
  const { rows: bookings } = await connection.query(`SELECT id, "interviewerId", "intervieweeId", "streamCallId", "creditsCharged" FROM "Booking" WHERE "interviewerId" = ANY($1::text[]) OR "intervieweeId" = ANY($1::text[]) FOR UPDATE`, [userIds]);
  for (const b of bookings) {
    const i = byId.get(b.interviewerId), c = byId.get(b.intervieweeId);
    const suffix = i && identity.exec(i.clerkUserId)?.[2];
    if (!suffix || c?.clerkUserId !== `prept-task3-candidate-${suffix}` || b.streamCallId !== `prept-task3-smoke-${suffix}` || b.creditsCharged !== 0) throw new Error("Non-fixture booking association; aborting");
  }
  const bookingIds = bookings.map(b => b.id);
  for (const [table, field] of [["Availability", "interviewerId"], ["Payout", "interviewerId"], ["CreditTransaction", "userId"]]) {
    const { rows } = await connection.query(`SELECT count(*)::int AS count FROM "${table}" WHERE "${field}" = ANY($1::text[])`, [userIds]);
    if (rows[0].count) throw new Error("Unexpected activity on synthetic account; aborting");
  }
  const { rows: crossQuestions } = await connection.query(`SELECT id FROM "InterviewQuestion" WHERE ("authorId" = ANY($1::text[]) OR "recipientId" = ANY($1::text[])) AND NOT ("bookingId" = ANY($2::text[]))`, [userIds, bookingIds]);
  if (crossQuestions.length) throw new Error("Unexpected question association; aborting");
  console.log(JSON.stringify({ syntheticInterviewers: users.filter(u => u.role === "INTERVIEWER").length, syntheticCandidates: users.filter(u => u.role === "INTERVIEWEE").length, syntheticBookings: bookings.length, identityAndAssociationChecks: "passed" }));
  if (!process.argv.includes("--delete")) { await connection.query("ROLLBACK"); }
  else {
    // Booking cascades remove only its question/submission/feedback/reminder records.
    await connection.query(`DELETE FROM "Booking" WHERE id = ANY($1::text[])`, [bookingIds]);
    const result = await connection.query(`DELETE FROM "User" WHERE id = ANY($1::text[])`, [userIds]);
    await connection.query("COMMIT");
    console.log(JSON.stringify({ deletedSyntheticAccounts: result.rowCount, deletedSyntheticBookings: bookings.length }));
    const video = new StreamClient(process.env.NEXT_PUBLIC_STREAM_API_KEY, process.env.STREAM_SECRET_KEY, { timeout: 10000 });
    const chat = StreamChat.getInstance(process.env.NEXT_PUBLIC_STREAM_API_KEY, process.env.STREAM_SECRET_KEY);
    let remoteErrors = 0;
    for (const b of bookings) {
      for (const remove of [() => video.video.call("default", b.streamCallId).delete({ hard: true }), () => chat.channel("messaging", b.streamCallId).delete({ hard_delete: true })]) {
        try { await remove(); }
        catch (e) { if (![16, 404].includes(Number(e.code)) && Number(e.status || e.statusCode || e.StatusCode || e.response?.status) !== 404) { remoteErrors++; console.log("Synthetic Stream cleanup error", { code: e.code, status: e.status }); } }
      }
    }
    if (users.length) await video.deleteUsers({ user_ids: users.map(u => u.clerkUserId), user: "hard", messages: "hard", conversations: "keep" });
    const { rows } = await connection.query(`SELECT count(*)::int AS count FROM "User" WHERE "clerkUserId" LIKE 'prept-task3-%'`);
    console.log(JSON.stringify({ remainingSyntheticAccounts: rows[0].count, streamCleanupRequestsSubmitted: true, remoteErrors }));
    if (remoteErrors) process.exitCode = 1;
  }
} catch (error) {
  await connection.query("ROLLBACK").catch(() => {});
  console.error("Cleanup failed", { code: error.code || error.name, message: /^Fixture|^Non-fixture|^Unexpected/.test(error.message) ? error.message : "Details suppressed to protect credentials" });
  process.exitCode = 1;
} finally { connection.release(); await pool.end(); }
process.exit(process.exitCode || 0);
