// Synthetic provider generation plus read-only schema verification; no interview records are read.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { randomUUID } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { Pool } from "pg";
import { INTERVIEW_CATALOG, QUESTION_TYPES, makeDefaultPreferences } from "../lib/interviewCatalog.js";
import { QUESTION_BANK } from "../lib/questionBank.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  await pool.query('SELECT q."parentId", q."depth", s."evaluationStatus", s."approvedGrade" FROM "InterviewQuestion" q LEFT JOIN "InterviewSubmission" s ON s."questionId" = q.id LIMIT 0');
  console.log("Task 3 database columns: available");
} catch (error) {
  console.log("Database check failed", { code: error.code || "CONNECTION_ERROR" });
  process.exitCode = 1;
} finally { await pool.end(); }

const source = readFileSync(new URL("../actions/aiQuestions.js", import.meta.url), "utf8")
  .replace(/^import[\s\S]*?;\r?\n/gm, "").replaceAll("export const ", "const ");
const generate = runInNewContext(`${source}; generateInterviewQuestions`, {
  GoogleGenAI, randomUUID, performance, console, process, INTERVIEW_CATALOG, QUESTION_TYPES, QUESTION_BANK,
  actionFailure: error => ({ success: false, error }),
  currentUser: async () => ({ id: "synthetic-interviewer" }),
  db: { booking: { findUnique: async () => ({ id: "synthetic-booking", interviewer: { clerkUserId: "synthetic-interviewer" } }) },
    interviewQuestion: { findMany: async () => [] } },
});
const harder = process.argv.includes("--harder");
const mcq = process.argv.includes("--mcq");
const easy = process.argv.includes("--easy");
const result = await generate({ callId: "synthetic-call", preferences: { ...makeDefaultPreferences(), questionCount: harder ? 5 : 1, webResearch: "OFF", ...(mcq ? { subject: "CORE_CS", topic: "DBMS", questionType: "MCQ", difficulty: easy ? "EASY" : "MIXED" } : {}) },
  instruction: harder ? "Harder" : "Give one conceptual question about binary search", forceQuestions: !harder,
  activeQuestion: mcq ? { id: "synthetic-mcq", category: "CORE_CS", topic: "DBMS", type: "MCQ", difficulty: easy ? "EASY" : "MEDIUM", question: "Which normal form eliminates multivalued dependencies?", answer: "Fourth Normal Form (4NF)", candidateAnswer: "Second Normal Form (2NF)", depth: 0 } : harder ? { id: "synthetic-parent", category: "DSA", topic: "Arrays", type: "CONCEPTUAL", difficulty: "MEDIUM",
    question: "Explain binary search on a sorted array.", answer: "Halve the remaining search range at each step.", depth: 0 } : null });
console.log(JSON.stringify({ generation: result.questions?.length === 1 ? "passed" : "failed", code: result.code }));
if (result.questions?.length !== 1) process.exitCode = 1;
if (harder && result.questions?.[0]?.difficulty !== (easy ? "MEDIUM" : "HARD")) process.exitCode = 1;
