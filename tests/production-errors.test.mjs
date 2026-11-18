import test from 'node:test';
import assert from 'node:assert/strict';
import { productionFailure } from '../lib/production-errors.js';

test('provider limits require explicit evidence of quota exhaustion', () => {
  assert.equal(productionFailure({ status: 429, message: 'Quota exceeded' }).code, 'AI_RATE_LIMITED');
  assert.equal(productionFailure({ status: 429, message: 'RequestsPerDay quota exceeded' }).code, 'AI_QUOTA_EXHAUSTED');
  assert.equal(productionFailure({ status: 503, message: 'Service unavailable' }).code, 'AI_MODEL_UNAVAILABLE');
  assert.equal(productionFailure({ status: 503, message: 'quota exhausted' }).code, 'AI_MODEL_UNAVAILABLE');
  assert.equal(productionFailure({ status: 403 }).code, 'AI_CONFIGURATION_ERROR');
});

test('retry details survive SDK errors without exposing provider payloads', () => {
  const failure = productionFailure({ status: 429, message: 'private provider payload', errorDetails: [{ retryDelay: '12.5s' }] });
  assert.equal(failure.retryAfterSeconds, 13);
  assert.match(failure.error, /13 seconds/);
  assert.doesNotMatch(JSON.stringify(failure), /private provider/);
});

test('database and validation errors retain their own stages and safe messages', () => {
  assert.equal(productionFailure({ code: 'DATABASE_ERROR', message: 'private SQL' }).code, 'DATABASE_ERROR');
  assert.equal(productionFailure({ code: 'FEEDBACK_VALIDATION_FAILED' }).code, 'FEEDBACK_VALIDATION_FAILED');
});
