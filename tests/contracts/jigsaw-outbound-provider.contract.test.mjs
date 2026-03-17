import test from 'node:test';
import assert from 'node:assert/strict';
import { createGasContext, loadGasRuntime } from '../helpers/gas-test-harness.mjs';

function boot() {
  const ctx = createGasContext();
  loadGasRuntime(ctx);
  return ctx;
}

test('validateJigsawAction posts built referral and records validation writeback', () => {
  const ctx = boot();
  const calls = {
    build: null,
    post: null,
    update: null,
    log: null,
  };

  ctx.withLock_ = (_ms, fn) => fn();
  ctx.getSheet_ = () => ({});
  ctx.buildJigsawReferralFromDeal_ = (deal, draft) => {
    calls.build = { deal, draft };
    return { ReferrerRef: 'CMFREF123', payload: true };
  };
  ctx.jigsawPostJson_ = (path, payload) => {
    calls.post = { path, payload };
    return { status: 200, bodyText: '{"status":"ok"}' };
  };
  ctx.updateDealFields_ = (_sheet, dealId, fields) => {
    calls.update = { dealId, fields };
  };
  ctx.appendJigsawLog_ = (eventName, meta) => {
    calls.log = { eventName, meta };
  };

  const out = ctx.validateJigsawAction_({
    deal: { id: 'D-100' },
    draft: { draftId: 'draft-1' },
  });

  assert.equal(out.success, true);
  assert.equal(out.status, 200);
  assert.deepEqual(out.data, { status: 'ok' });
  assert.equal(calls.build.deal.id, 'D-100');
  assert.equal(calls.build.draft.draftId, 'draft-1');
  assert.equal(calls.post.path, '/api/validateJigsawReferral');
  assert.deepEqual(calls.post.payload, { ReferrerRef: 'CMFREF123', payload: true });
  assert.equal(calls.update.dealId, 'D-100');
  assert.equal(calls.update.fields.jigsawValidationStatus, 200);
  assert.deepEqual(calls.update.fields.jigsawValidationResult, { status: 'ok' });
  assert.equal(calls.log.eventName, 'validate');
  assert.equal(calls.log.meta.introducerReference, 'CMFREF123');
});

test('submitJigsawAction blocks on failed pre-submit validation when enabled', () => {
  const ctx = boot();
  const calls = [];

  ctx.boolProp_ = () => true;
  ctx.buildJigsawReferralFromDeal_ = () => ({ ReferrerRef: 'CMFREF456' });
  ctx.jigsawPostJson_ = (path) => {
    calls.push(path);
    if (path === '/api/validateJigsawReferral') {
      return { status: 422, bodyText: '{"error":"invalid"}' };
    }
    return { status: 200, bodyText: '{"submitted":true}' };
  };
  ctx.appendJigsawLog_ = () => {};

  const out = ctx.submitJigsawAction_({ deal: { id: 'D-200' } });

  assert.equal(out.success, false);
  assert.equal(out.stage, 'validate');
  assert.equal(out.status, 422);
  assert.deepEqual(out.data, { error: 'invalid' });
  assert.deepEqual(calls, ['/api/validateJigsawReferral']);
});

test('submitJigsawAction submits and writes back sent status after validation passes', () => {
  const ctx = boot();
  const calls = {
    update: null,
    log: null,
    postPaths: [],
  };

  ctx.boolProp_ = () => true;
  ctx.withLock_ = (_ms, fn) => fn();
  ctx.getSheet_ = () => ({});
  ctx.buildJigsawReferralFromDeal_ = () => ({ ReferrerRef: 'CMFREF789' });
  ctx.jigsawPostJson_ = (path) => {
    calls.postPaths.push(path);
    if (path === '/api/validateJigsawReferral') {
      return { status: 200, bodyText: '{"validated":true}' };
    }
    return { status: 201, bodyText: '{"submitted":true}' };
  };
  ctx.updateDealFields_ = (_sheet, dealId, fields) => {
    calls.update = { dealId, fields };
  };
  ctx.appendJigsawLog_ = (eventName, meta) => {
    calls.log = { eventName, meta };
  };

  const out = ctx.submitJigsawAction_({ deal: { id: 'D-300' } });

  assert.equal(out.success, true);
  assert.equal(out.status, 201);
  assert.deepEqual(out.data, { submitted: true });
  assert.deepEqual(calls.postPaths, [
    '/api/validateJigsawReferral',
    '/api/submitJigsawReferral',
  ]);
  assert.equal(calls.update.dealId, 'D-300');
  assert.equal(calls.update.fields.jigsawStatus, 'Sent');
  assert.equal(calls.update.fields.jigsawSubmitStatus, 201);
  assert.deepEqual(calls.update.fields.jigsawLastSubmitResponse, { submitted: true });
  assert.equal(calls.log.eventName, 'submit');
  assert.equal(calls.log.meta.introducerReference, 'CMFREF789');
});
