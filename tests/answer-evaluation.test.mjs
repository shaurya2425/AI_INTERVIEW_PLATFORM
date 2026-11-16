import { GRADE_SCORES, questionCalculation, scoreInterview, SCORING_POLICY_VERSION } from "../lib/interviewScoring.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
const source = file => readFileSync(new URL('../'+file, import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'').replaceAll('export ','');
const assessment = (suggestedGrade='GOOD', result='CORRECT') => ({ result, suggestedGrade, reasoning:'The explanation is supported by the submitted answer.', recommendedFollowUp:'Explain a relevant edge case.', strengths:['Clear approach'], weaknesses:[], confidence:'HIGH', uncertainty:'Static review only.', mistakes:[], missingConcepts:[] });
function evaluator(output=assessment()) {
  const calls=[];
  const api=runInNewContext(`${source('lib/answerEvaluation.js')}; ({assessAnswer,validateEvaluation,evaluationFailure})`, {
    GRADE_SCORES, process:{env:{GEMINI_API_KEY:'test'}}, GoogleGenAI: class { models={ generateContent: async req=>{ calls.push(req); if(output instanceof Error) throw output; return {text:JSON.stringify(output)}; } }; },
  });
  return {...api,calls};
}
const q = (type='CONCEPTUAL')=>({id:'q',type,difficulty:'MEDIUM',question:'Explain binary search',topic:'Search',options:['A','B','C','D'],correctOptionIndex:1,referenceAnswer:'Requires sorted data; halves the search space.',submission:{answer:'Halve a sorted range',optionIndex:0,language:'javascript'}});
test('incorrect and correct MCQ use only the private server key, never AI',async()=>{
  const api=evaluator(); const question=q('MCQ');
  assert.equal((await api.assessAnswer(question)).suggestedGrade,'POOR');
  question.submission.optionIndex=1;
  assert.equal((await api.assessAnswer(question)).suggestedGrade,'EXCELLENT');
  assert.equal(api.calls.length,0);
});
for(const [grade,result] of [['POOR','INCORRECT'],['AVERAGE','PARTIAL'],['EXCELLENT','CORRECT']]) test(`validates structured ${grade} theory assessment`,async()=>{
  const api=evaluator(assessment(grade,result));const resultData=await api.assessAnswer(q());
  assert.equal(resultData.suggestedGrade,grade); assert.equal(resultData.result,result);
  assert.match(api.calls[0].config.systemInstruction,/technically sound alternatives/);
});
for(const type of ['CODING','SQL_QUERY','SCENARIO']) test(`${type} uses reference and rubric without claiming execution`,async()=>{
  const api=evaluator();const result=await api.assessAnswer(q(type));assert.equal(result.execution,'NOT_EXECUTED');
  assert.match(api.calls[0].config.systemInstruction,/edge cases/);assert.match(api.calls[0].config.systemInstruction,/Code has NOT been executed/);
  assert.equal(JSON.parse(api.calls[0].contents).referenceAnswer,q().referenceAnswer);
});
test('rejects missing fields, invalid grades and unsupported execution claims',()=>{
 const api=evaluator();
 for(const data of [null,{},assessment('GREAT'),{...assessment(),missingConcepts:'none'},{...assessment(),reasoning:'Passed all test cases.'}]) assert.throws(()=>api.validateEvaluation(data));
});
test('quota and malformed response failures expose safe retry/manual messages',async()=>{
 const error=Object.assign(new Error('private provider quota detail'),{status:429});const api=evaluator(error);
 await assert.rejects(()=>api.assessAnswer(q())); assert.equal(api.calls.length,1);
 assert.match(api.evaluationFailure(error),/quota.*manually/);assert.doesNotMatch(api.evaluationFailure(error),/private provider/);
 assert.match(api.evaluationFailure({code:'INVALID_EVALUATION'}),/invalid assessment/);
});
function actions(role='INTERVIEWER') {
 const record={...q(),sourceId:'source',bookingId:'booking',sentAt:new Date(),depth:0,submission:{...q().submission,submittedAt:new Date(),evaluationStatus:'FAILED',evaluation:assessment(),approvedGrade:null,interviewerNotes:'private',evaluationError:'quota'}};
 const booking={id:'booking',intervieweeId:'candidate',interviewer:{id:'interviewer',clerkUserId:'i',role:'INTERVIEWER'},interviewee:{id:'candidate',clerkUserId:'c',role:'INTERVIEWEE'}};
 const jobs=[];let writes=0;
 const api=runInNewContext(`${source('actions/interviewQuestions.js')}; ({getInterviewQuestions,retryInterviewEvaluation,approveInterviewGrade,publicQuestion,sendInterviewQuestion})`,{
  GRADE_SCORES, questionCalculation, scoreInterview, SCORING_POLICY_VERSION, currentUser:async()=>({id:role==='INTERVIEWER'?'i':role==='INTERVIEWEE'?'c':'stranger'}),GRADES:['POOR','AVERAGE','GOOD','EXCELLENT'],
  after:job=>jobs.push(job), evaluateSubmission:async()=>{}, console, Date,createHash:()=>({update(){return this},digest(){return 'new-id'}}),QUESTION_TYPES:{CONCEPTUAL:{}},
  db:{$transaction:async function(fn){return fn(this)},booking:{findUnique:async()=>booking,update:async()=>({...booking,status:'SCHEDULED'})},interviewQuestion:{findMany:async()=>[record],findFirst:async()=>record,findUnique:async()=>record},interviewSubmission:{findUnique:async()=>record.submission,update:async({data})=>{writes++;Object.assign(record.submission,data)}}},
 });
 return {...api,record,jobs,writes:()=>writes};
}
test('candidate projections exclude every private evaluation/reference field',async()=>{
 const api=actions('INTERVIEWEE');const result=await api.getInterviewQuestions('call');const output=JSON.stringify(result);
 for(const key of ['referenceAnswer','correctOptionIndex','evaluation','approvedGrade','interviewerNotes','reasoning','private']) assert.ok(!output.includes(key),key);
 assert.equal(result.questions[0].submission.answer,q().submission.answer);
});
test('interviewer can manually grade after AI failure and override, with notes and approver persisted',async()=>{
 const api=actions();
 let result=await api.approveInterviewGrade({callId:'call',questionId:'q',grade:'GOOD',notes:'Valid alternative'});
 assert.equal(result.question.review.approvedGrade,'GOOD');assert.equal(api.record.submission.approvedBy,'interviewer');
 result=await api.approveInterviewGrade({callId:'call',questionId:'q',grade:'AVERAGE',notes:'Missed edge case'});
 assert.equal(result.question.review.notes,'Missed edge case');assert.equal(api.writes(),2);
});
test('candidate and outsider cannot grade or retry evaluations',async()=>{
 for(const role of ['INTERVIEWEE','OUTSIDER']) {const api=actions(role);
 assert.equal((await api.approveInterviewGrade({callId:'call',questionId:'q',grade:'GOOD'})).success,false);
 assert.equal((await api.retryInterviewEvaluation({callId:'call',questionId:'q'})).success,false);assert.equal(api.writes(),0);assert.equal(api.jobs.length,0);}
});
test('retry returns before provider work and queues only authorized saved answers',async()=>{
 const api=actions();assert.equal((await api.retryInterviewEvaluation({callId:'call',questionId:'q'})).success,true);assert.equal(api.jobs.length,1);
});
test('worker failure persists retryable state without modifying answer or approved result; successful retry preserves approval',async()=>{
 const record={evaluationStatus:'PENDING',answer:'original',approvedGrade:'GOOD',interviewerNotes:'keep'};let fail=true;
 const db={interviewSubmission:{updateMany:async({where,data})=>{
   if(where.OR && !where.OR.some(x=>x.evaluationStatus===record.evaluationStatus))return {count:0};
   if(where.evaluationToken && where.evaluationToken!==record.evaluationToken)return {count:0};
   Object.assign(record,data);return {count:1};
 }},interviewQuestion:{findUnique:async()=>({...q(),submission:record})}};
 const evaluate=runInNewContext(`${source('lib/evaluationWorker.js')}; evaluateSubmission`,{db,randomUUID,Date,questionCalculation,assessAnswer:async()=>{if(fail)throw new Error('offline');return assessment()},evaluationFailure:()=> 'Retry or grade manually'});
 await evaluate('q');assert.equal(record.evaluationStatus,'FAILED');assert.equal(record.answer,'original');
 fail=false;await evaluate('q',true);assert.equal(record.evaluationStatus,'COMPLETE');assert.equal(record.approvedGrade,'GOOD');assert.equal(record.interviewerNotes,'keep');
 await evaluate('q',true);assert.equal(record.evaluationStatus,'COMPLETE');
});
test('concurrent worker callbacks claim one evaluation',async()=>{
 let status='PENDING',calls=0;
 const db={interviewSubmission:{updateMany:async({where,data})=>{if(where.OR){if(status!=='PENDING')return {count:0};status='RUNNING'}else status=data.evaluationStatus;return {count:1}}},interviewQuestion:{findUnique:async()=>q()}};
 const evaluate=runInNewContext(`${source('lib/evaluationWorker.js')}; evaluateSubmission`,{db,randomUUID,Date,questionCalculation,assessAnswer:async()=>{calls++;return assessment()},evaluationFailure:()=>''});
 await Promise.all([evaluate('q'),evaluate('q')]);assert.equal(calls,1);assert.equal(status,'COMPLETE');
});

test('Grill delivery persists validated same-booking parent and independent depth',async()=>{
 const parent={id:'parent-db',sourceId:'parent-source',depth:2};let saved=null;
 const booking={id:'b',status:'SCHEDULED',streamCallId:'call',intervieweeId:'c',interviewer:{id:'i',clerkUserId:'i',role:'INTERVIEWER'},interviewee:{id:'c',clerkUserId:'c',role:'INTERVIEWEE'}};
 const api=runInNewContext(`${source('actions/interviewQuestions.js')}; sendInterviewQuestion`,{
   SCORING_POLICY_VERSION,currentUser:async()=>({id:'i'}),createHash:()=>({update(){return this},digest(){return 'child'}}),QUESTION_TYPES:{CONCEPTUAL:{}},console,process:{env:{}},
   db:{$transaction:async function(fn){return fn(this)},booking:{findUnique:async()=>booking,update:async()=>booking},interviewQuestion:{findUnique:async()=>saved,findFirst:async({where})=>{assert.equal(where.bookingId,'b');return parent},createMany:async({data})=>{saved=data[0]}}},
 });
 const result=await api({callId:'call',question:{id:'child-source',parentId:'parent-source',question:'Why this edge case?',topic:'Search',category:'DSA',type:'CONCEPTUAL',difficulty:'HARD',answer:'Reference'}});
 assert.equal(saved.parentId,'parent-db');assert.equal(saved.depth,3);assert.equal(saved.id,'child');
 assert.equal(result.success,false);assert.match(result.error,/Question saved/);
});

test('submission is durable before evaluation is scheduled and response contains no private review',async()=>{
 let saved=null;const jobs=[];
 const question={...q(),id:'q',bookingId:'b',recipientId:'c',sentAt:new Date(),submission:null};
 const booking={id:'b',status:'SCHEDULED',streamCallId:'call',interviewer:{id:'i',clerkUserId:'i',role:'INTERVIEWER'},interviewee:{id:'c',clerkUserId:'c',role:'INTERVIEWEE'}};
 const api=runInNewContext(`${source('actions/interviewQuestions.js')}; submitInterviewAnswer`,{
  GRADE_SCORES, questionCalculation, scoreInterview, SCORING_POLICY_VERSION, currentUser:async()=>({id:'c'}),console,process:{env:{}},after:job=>{assert.ok(saved);jobs.push(job)},evaluateSubmission:async()=>{},
  db:{$transaction:async function(fn){return fn(this)},booking:{findUnique:async()=>booking,update:async()=>booking},interviewQuestion:{update:async()=>question,findFirst:async()=>question,findUnique:async()=>({...question,submission:saved})},interviewSubmission:{
    createMany:async({data})=>{saved={...data[0],submittedAt:new Date(),evaluationStatus:'PENDING'}},findUnique:async()=>saved,
  }},
 });
 const result=await api({callId:'call',questionId:'q',answer:'actual answer'});
 assert.equal(result.success,true);assert.equal(saved.answer,'actual answer');assert.equal(jobs.length,1);assert.equal(result.question.review,undefined);
 assert.equal(result.warning,undefined);
});

test('numerical score is derived from grade, ignoring model-supplied numbers',()=>{
 const api=evaluator();const result=api.validateEvaluation({...assessment('GOOD'),score:99});
 assert.equal(result.score,75);
});
test('uncertain assessments preserve explicit confidence and uncertainty',()=>{
 const api=evaluator();const result=api.validateEvaluation({...assessment('AVERAGE','UNCERTAIN'),confidence:'LOW',uncertainty:'Insufficient detail to verify the approach.'});
 assert.equal(result.result,'UNCERTAIN');assert.equal(result.confidence,'LOW');assert.equal(result.score,40);
});
test('evaluation rubric explicitly accepts Hindi-English and distinguishes difficulty and Grill',async()=>{
 const api=evaluator();const question={...q('SCENARIO'),difficulty:'HARD',depth:1,parentId:'parent'};await api.assessAnswer(question);
 const prompt=api.calls[0].config.systemInstruction;assert.match(prompt,/Hindi-English/);assert.match(prompt,/Hard: credit partial valid reasoning/);
 const data=JSON.parse(api.calls[0].contents);assert.equal(data.difficulty,'HARD');assert.equal(data.followUp,true);
});
test('credential, model and network failures retain manual-grading fallback',()=>{
 const api=evaluator();assert.match(api.evaluationFailure({status:401}),/credentials.*manually/);assert.match(api.evaluationFailure({status:404}),/model.*manually/);assert.match(api.evaluationFailure({status:503}),/saved.*manually/);
});

test('hint confirmation is explicit, revision-bound, reversible and private',async()=>{
 const api=actions();Object.assign(api.record.submission,{revision:2,previousAttempts:[{revision:1,answer:'old',interviewerNotes:'SECRET',approvedGrade:'POOR'}]});
 const input={callId:'call',questionId:'q',grade:'EXCELLENT',submissionRevision:2,correctionWithHint:true};
 assert.equal((await api.approveInterviewGrade({...input,submissionRevision:1})).success,false);
 let result=await api.approveInterviewGrade(input);assert.equal(result.success,true);assert.equal(result.question.review.approvedScore,95);
 assert.equal(api.record.submission.previousAttempts[0].hintConfirmedBy,'interviewer');
 const candidate=api.publicQuestion(api.record,'INTERVIEWEE');assert.ok(!JSON.stringify(candidate).includes('SECRET'));assert.ok(!JSON.stringify(candidate).includes('hintConfirmedBy'));
 result=await api.approveInterviewGrade({...input,correctionWithHint:false});assert.equal(result.question.review.approvedScore,100);
});

test('non-MCQ resubmission archives evidence, resets approval and evaluation, and rejects stale drafts',async()=>{
 const question={...q(),sentAt:new Date(),submission:{...q().submission,id:'answer-q',revision:1,submittedAt:new Date(),previousAttempts:[],approvedGrade:'GOOD',interviewerNotes:'keep private',evaluationToken:'old-worker',evaluationStatus:'COMPLETE'}};
 const booking={id:'b',status:'SCHEDULED',streamCallId:'call',interviewer:{id:'i',clerkUserId:'i',role:'INTERVIEWER'},interviewee:{id:'c',clerkUserId:'c',role:'INTERVIEWEE'}};
 let summary;const jobs=[];
 const db={$transaction:async fn=>fn(db),booking:{findUnique:async()=>booking,update:async({data})=>{if(data.scoringSummary)summary=data.scoringSummary;return booking}},interviewQuestion:{findFirst:async()=>question,findUnique:async()=>question,findMany:async()=>[question],update:async()=>question},interviewSubmission:{findUnique:async()=>question.submission,update:async({data})=>{const revision=data.revision?question.submission.revision+1:question.submission.revision;Object.assign(question.submission,data,{revision});return question.submission}}};
 const submit=runInNewContext(source('actions/interviewQuestions.js')+'; submitInterviewAnswer',{db,Prisma:{DbNull:null},GRADE_SCORES,questionCalculation,scoreInterview,SCORING_POLICY_VERSION,currentUser:async()=>({id:'c'}),after:f=>jobs.push(f),evaluateSubmission:async()=>{},console,Date,process:{env:{}}});
 const input={callId:'call',questionId:'q',answer:'corrected independently',expectedRevision:1,requestId:'request-2'};
 let result=await submit(input);assert.equal(result.success,true);assert.equal(question.submission.revision,2);assert.equal(question.submission.previousAttempts[0].answer,'Halve a sorted range');assert.equal(question.submission.previousAttempts[0].interviewerNotes,'keep private');
 assert.equal(question.submission.approvedGrade,null);assert.equal(question.submission.evaluationToken,null);assert.equal(question.submission.evaluationStatus,'PENDING');assert.equal(summary.overallScore,null);assert.equal(jobs.length,1);assert.equal(result.warning,undefined);
 result=await submit(input);assert.equal(result.success,true);assert.equal(question.submission.revision,2);
 result=await submit({...input,requestId:'stale-request'});assert.equal(result.success,false);assert.equal(question.submission.revision,2);
 question.type='MCQ';result=await submit({...input,optionIndex:1,expectedRevision:2,requestId:'mcq-retry'});assert.equal(result.success,true);assert.equal(question.submission.revision,2);
});
