import test from 'node:test';
import assert from 'node:assert/strict';
import { GRADE_SCORES, questionCalculation, scoreInterview } from '../lib/interviewScoring.js';
const question=(difficulty,grade,extra={})=>({id:Math.random().toString(),difficulty,topic:'DBMS',sentAt:new Date(),submission:grade?{approvedGrade:grade}:null,...extra});
test('fixed grades and question calculations are deterministic',()=>{
 assert.deepEqual(GRADE_SCORES,{POOR:0,AVERAGE:40,GOOD:75,EXCELLENT:100});
 const c=questionCalculation(question('HARD','GOOD',{parentId:'parent'}),'GOOD');
 assert.equal(c.questionWeight,.35);assert.equal(c.weightedScore,26.25);assert.equal(c.approvedScore,75);assert.equal(c.scoringPolicyVersion,'prept-fair-v1');
});
test('main score uses exact difficulty weights',()=>{
 const s=scoreInterview([question('EASY','POOR'),question('MEDIUM','GOOD'),question('HARD','EXCELLENT')]);
 assert.ok(Math.abs(s.mainScore-(0*1.25+75+70)/2.95)<1e-10);assert.equal(s.overallScore,s.mainScore);assert.equal(s.state,'AVAILABLE');
});
test('failed hard Grill cannot reduce the main score; excellent Grill can add a bonus',()=>{
 const main=[question('EASY','GOOD'),question('MEDIUM','GOOD')];
 const fail=scoreInterview([...main,question('HARD','POOR',{parentId:main[0].id})]);assert.equal(fail.mainScore,75);assert.equal(fail.grillScore,0);assert.equal(fail.overallScore,75);
 const bonus=scoreInterview([...main,question('HARD','EXCELLENT',{depth:1})]);assert.equal(bonus.overallScore,78.75);
});
test('unsent, cancelled, unanswered and unapproved evidence never become zero grades',()=>{
 const rows=[question('EASY','EXCELLENT',{sentAt:null}),question('HARD',null),question('EASY',null,{submission:{evaluation:{suggestedGrade:'POOR'}}})];
 const s=scoreInterview(rows);assert.equal(s.overallScore,null);assert.equal(s.state,'UNAVAILABLE');
 assert.deepEqual(s.breakdown.map(q=>q.status),['NOT_DELIVERED','AWAITING_ANSWER','AWAITING_APPROVAL']);
 assert.equal(scoreInterview([question('EASY','EXCELLENT')],'CANCELLED').overallScore,null);
 assert.equal(scoreInterview([question('EASY',null)],'COMPLETED').breakdown[0].status,'UNANSWERED');
});
test('Grill-only evidence is unavailable; single-main evidence is provisional; overrides recalculate',()=>{
 assert.equal(scoreInterview([question('HARD','EXCELLENT',{depth:1})]).overallScore,null);
 const q=question('EASY','POOR');assert.equal(scoreInterview([q]).state,'PROVISIONAL');
 q.submission.approvedGrade='EXCELLENT';assert.equal(scoreInterview([q]).overallScore,100);
});
