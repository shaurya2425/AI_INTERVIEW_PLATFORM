import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import { scoreInterview, SCORING_POLICY_VERSION } from '../lib/interviewScoring.js';
const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'').replaceAll('export ','');
function harness(){
 const booking={id:'b',status:'SCHEDULED',endTime:new Date(Date.now()+86400000),streamCallId:'call',interviewer:{id:'i',clerkUserId:'i'},interviewee:{id:'c',clerkUserId:'c'}};
 let endCalls=0,failEnd=false,ended=false;const revoked=[];
 const question={id:'q',difficulty:'EASY',topic:'DBMS',sentAt:new Date(),submission:null,responseStatus:'AWAITING_ANSWER'};
 const db={booking:{findUnique:async()=>booking,update:async({data})=>Object.assign(booking,data),updateMany:async({where,data})=>{
  if(where.status && where.status!==booking.status)return {count:0};
  if(where.interviewer && where.interviewer.clerkUserId!==booking.interviewer.clerkUserId)return {count:0};
  if(where.completionToken && where.completionToken!==booking.completionToken)return {count:0};
  if(where.OR && !where.OR.some(x=>typeof x.completionState==='object'?x.completionState.in.includes(booking.completionState):x.completionState===booking.completionState && booking.completionStartedAt < x.completionStartedAt.lt))return {count:0};
  Object.assign(booking,data);return {count:1};
 }},interviewQuestion:{updateMany:async({data})=>Object.assign(question,data),findMany:async()=>[question]},$transaction:async fn=>fn(db)};
 const api=runInNewContext(`${source('lib/interviewCompletion.js')};({requestInterviewCompletion,finalizeInterviewCompletion,secureInterviewCall})`,{db,randomUUID,scoreInterview,SCORING_POLICY_VERSION,feedbackBookingInclude:{},prepareMeetingFeedback:async()=>null,Date,process:{env:{}},StreamClient:class{video={getCallType:async()=>({grants:{user:["join-call","end-call-owner","join-ended-call-owner"],call_member:["join-call","end-call","join-ended-call"]}}),updateCallType:async data=>revoked.push(data),call:()=>({updateCallMembers:async()=>{},get:async()=>({call:{ended_at:ended?'ended':null}}),end:async()=>{endCalls++;if(failEnd)throw new Error('network');ended=true}})}}});
 return {...api,booking,question,revoked,db,endCalls:()=>endCalls,fail:()=>{failEnd=true},recover:()=>{failEnd=false}};
}
test('completion before scheduled expiry is permanent, idempotent and marks missing answers explicitly',async()=>{
 const h=harness();await h.requestInterviewCompletion('b','i');const time=h.booking.completedAt;
 assert.equal(h.booking.status,'COMPLETED');assert.equal(h.booking.feedbackState,'PENDING');assert.equal(h.question.responseStatus,'UNANSWERED');assert.equal(h.booking.scoringSummary.overallScore,null);
 await h.requestInterviewCompletion('b','i');assert.equal(h.booking.completedAt,time);assert.equal(h.endCalls(),0);
});
test('candidate cannot complete; cancelled booking is not completed',async()=>{
 const h=harness();await assert.rejects(()=>h.requestInterviewCompletion('b','c'));assert.equal(h.booking.status,'SCHEDULED');
 h.booking.status='CANCELLED';await assert.rejects(()=>h.requestInterviewCompletion('b','i'));assert.equal(h.endCalls(),0);
});
test('failed external end preserves completed state and can be retried without duplicate success',async()=>{
 const h=harness();await h.requestInterviewCompletion('b','i');h.fail();await h.finalizeInterviewCompletion('b');
 assert.equal(h.booking.status,'COMPLETED');assert.equal(h.booking.completionState,'FAILED');assert.equal(h.booking.feedbackState,'PENDING');
 h.recover();await h.finalizeInterviewCompletion('b');assert.equal(h.booking.completionState,'COMPLETE');assert.ok(h.booking.streamEndedAt);
 await h.finalizeInterviewCompletion('b');assert.equal(h.endCalls(),2);
 assert.ok(h.revoked.every(r=>Object.values(r.grants).every(values=>!values.some(p=>p.startsWith('join-ended-call')||p.startsWith('end-call')))));
});
test('concurrent completion workers claim only one shared termination',async()=>{
 const h=harness();await h.requestInterviewCompletion('b','i');await Promise.all([h.finalizeInterviewCompletion('b'),h.finalizeInterviewCompletion('b')]);assert.equal(h.endCalls(),1);
});
test('public completion action checks interviewer before scheduling external work',async()=>{
 const h=harness();let scheduled=0;
 const complete=runInNewContext(`${source('actions/interviewCompletion.js')};completeInterview`,{db:h.db,completionInclude:{},currentUser:async()=>({id:'c'}),after:()=>scheduled++,revalidatePath:()=>{},requestInterviewCompletion:h.requestInterviewCompletion,finalizeInterviewCompletion:h.finalizeInterviewCompletion});
 assert.equal((await complete('b')).success,false);assert.equal(scheduled,0);assert.equal(h.booking.status,'SCHEDULED');
});
