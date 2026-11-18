// Read-only generation diagnostic: no database writes and no private evidence output.
import { loadEnvFile } from 'node:process';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { StreamClient } from '@stream-io/node-sdk';
import { StreamChat } from 'stream-chat';
import { scoreInterview, GRADE_SCORES } from '../lib/interviewScoring.js';
import { productionError, productionFailure } from '../lib/production-errors.js';
loadEnvFile();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
const db = {
  interviewQuestion: { findMany: async ({ where }) => (await pool.query(`SELECT q.id, q."sourceId", q.question, q.topic, q.type, q.difficulty, q.options, q."sentAt", q."parentId", q.depth, q."responseStatus",
    jsonb_build_object('answer',s.answer,'optionIndex',s."optionIndex",'language',s.language,'approvedGrade',s."approvedGrade",'approvedAt',s."approvedAt",'evaluationStatus',s."evaluationStatus",'previousAttempts',s."previousAttempts") AS submission
    FROM "InterviewQuestion" q LEFT JOIN "InterviewSubmission" s ON s."questionId"=q.id
    WHERE q."bookingId"=$1 AND q."sentAt" IS NOT NULL ORDER BY q."createdAt",q.id`, [where.bookingId])).rows },
  aIBuddyMessage: { findMany: async ({ where }) => (await pool.query('SELECT "questionIds" FROM "AIBuddyMessage" WHERE "bookingId"=$1 AND role=$2', [where.bookingId, 'assistant'])).rows },
};
const source = readFileSync(new URL('../lib/meeting-feedback.js', import.meta.url), 'utf8').replace(/^import[\s\S]*?;\r?\n/gm, '').replaceAll('export ', '');
const api = runInNewContext(`${source}; ({ collectEvidence, generateMeetingFeedback })`, {
  db, createHash, scoreInterview, GRADE_SCORES, productionError, productionFailure,
  GoogleGenerativeAI, StreamClient, StreamChat, fetch, AbortSignal, Date, console,
  process: { env: { ...process.env, GEMINI_FEEDBACK_MODEL: 'gemini-2.5-flash' } },
});
try {
  const { rows } = await pool.query(`SELECT b.*, jsonb_build_object('id',i.id,'clerkUserId',i."clerkUserId",'categories',i.categories) AS interviewer,
    jsonb_build_object('clerkUserId',c."clerkUserId") AS interviewee, to_jsonb(f) AS feedback
    FROM "Booking" b JOIN "User" i ON i.id=b."interviewerId" JOIN "User" c ON c.id=b."intervieweeId"
    LEFT JOIN "Feedback" f ON f."bookingId"=b.id WHERE b.id=$1`, ['fe5105b1-d321-4319-9479-ff6961594a87']);
  const collected = await api.collectEvidence(rows[0]);
  console.log(JSON.stringify({ evidenceCount: collected.evidence.length, candidates: collected.evidence.filter(e => e.candidateEvidence).length }));
  const result = await api.generateMeetingFeedback(rows[0], collected);
  console.log(JSON.stringify({ generated: true, version: result.report.version, state: result.report.state }));
} catch (error) {
  const failure = productionFailure(error);
  console.log(JSON.stringify({ code: failure.code, status: failure.status, validationReasons: error.validationReasons }));
  process.exitCode = 1;
} finally { await pool.end(); }
