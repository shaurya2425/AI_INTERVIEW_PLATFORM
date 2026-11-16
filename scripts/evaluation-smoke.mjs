// Opt-in live provider check: node --env-file=.env scripts/evaluation-smoke.mjs
// Synthetic answers only. Does not read or write interview records.
import { assessAnswer, evaluationFailure } from "../lib/answerEvaluation.js";

const base = { difficulty: "MEDIUM", type: "CONCEPTUAL", topic: "Binary search", question: "Explain binary search, its prerequisite, time and auxiliary space complexity for an iterative implementation.",
  referenceAnswer: "Requires a sorted random-access sequence. Compare target with midpoint, discard the irrelevant half and repeat until found or range empty. O(log n) time, O(1) auxiliary space." };
const scenarios = [
  ["poor", { ...base, submission: { answer: "It guesses random elements and always takes O(1). No sorting needed." } }, ["POOR"]],
  ["excellent", { ...base, submission: { answer: "Use a sorted array and maintain inclusive low/high bounds. While low <= high, compute mid = low + floor((high-low)/2). Return mid on equality; if a[mid] < target set low=mid+1, else high=mid-1. An empty range means absent. Each step halves the range, so worst-case time is O(log n) and iterative auxiliary space O(1). An empty array immediately returns absent; for duplicates this returns any occurrence, with a bound-search variant needed for the first occurrence." } }, ["EXCELLENT"]],
  ["partial theory", { ...base, submission: { answer: "It checks the middle item and repeatedly halves the search range. Time is O(log n)." } }, ["AVERAGE", "GOOD"]],
  ["coding bug", { type: "CODING", topic: "Arrays", question: "Return the maximum value in a nonempty array of integers, including all-negative arrays.", referenceAnswer: "Initialize the maximum from the first element then scan. O(n) time and O(1) space.", submission: { language: "javascript", answer: "function max(a) { let best = 0; for (const x of a) best = Math.max(best,x); return best; }" } }, ["AVERAGE", "POOR"]],
  ["SQL alternative", { type: "SQL_QUERY", topic: "SQL", question: "Return users having no orders. users(id), orders(id,user_id); orders.user_id can be NULL.", referenceAnswer: "SELECT u.id FROM users u WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id)", submission: { language: "sql", answer: "SELECT u.id FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE o.user_id IS NULL;" } }, ["GOOD", "EXCELLENT"]],
];
scenarios.push(
  ["Hindi-English fundamentals", { ...base, difficulty: "EASY", submission: { answer: "Binary search sorted array par kaam karta hai. Low aur high bounds rakhte hain. Middle element target se chhota ho toh left half hata dete hain, bada ho toh right half. Har step search space aadha hota hai, isliye O(log n) time. Iterative version mein O(1) extra space hai. Low high se bada ho jaye toh target absent hai." } }, ["GOOD", "EXCELLENT"]],
  ["partial hard reasoning", { type: "SCENARIO", difficulty: "HARD", topic: "Distributed systems", question: "Design a distributed rate limiter across regions, discussing consistency, failures and hot keys.", referenceAnswer: "Discuss local token buckets, distributed coordination, partition tradeoffs, bounded overshoot, fallback policy and partitioning hot keys.", submission: { answer: "I would use token buckets in each region with Redis for atomic increments within that region. This avoids a global network round trip on each request. During partitions we could allow bounded overshoot using a small local budget. I have not yet solved how to coordinate exact global limits or handle hot keys." } }, ["AVERAGE", "GOOD"]],
  ["Grill diagnostic", { ...base, difficulty: "HARD", depth: 1, parentId: "synthetic-parent", submission: { answer: "It needs a sorted array. The algorithm halves the candidate range, so O(log n) comparisons. I am unsure about implementation details for duplicate bounds, but would continue searching left after finding a match." } }, ["AVERAGE", "GOOD", "EXCELLENT"]],
);
for (const [name, question, expected] of scenarios) {
  try {
    const result = await assessAnswer(question);
    const ok = expected.includes(result.suggestedGrade) && result.execution === "NOT_EXECUTED";
    console.log(JSON.stringify({ scenario: name, grade: result.suggestedGrade, result: result.result, passed: ok }));
    if (!ok) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ scenario: name, passed: false, error: evaluationFailure(error) }));
    process.exitCode = 1;
  }
}
