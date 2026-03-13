import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function readProductSourceTemplate() {
  return fs.readFileSync('tabProductSource.html', 'utf8');
}

test('lender apply modal has viewport max-height and internally scrolling body', () => {
  const html = readProductSourceTemplate();

  assert.match(
    html,
    /<div class="[^"]*overflow-y-auto" id="lenderAppModal"/,
    'expected overlay to allow viewport scrolling on smaller screens',
  );
  assert.match(
    html,
    /#lenderAppModal \.lender-app-modal-panel \{\s*max-height: min\(90vh, 860px\);/,
    'expected modal container max-height relative to viewport',
  );
  assert.match(
    html,
    /id="lenderAppValidateBtn"[\s\S]*id="lenderAppPayloadJson"/,
    'expected Validate button to appear before payload content in modal markup',
  );
  assert.match(
    html,
    /class="lender-app-modal-body p-6 space-y-6 modal-content modal-body-scroll flex-1"/,
    'expected body area to scroll internally',
  );
  assert.doesNotMatch(
    html,
    /id="lenderAppSaveBtn"/,
    'expected Save Draft button to be removed from lender apply modal',
  );
});

test('lender broker rows use a shared helper and pastel purple class styling', () => {
  const html = readProductSourceTemplate();

  assert.match(
    html,
    /const LENDER_BROKER_IDS = new Set\(\["jigsaw", "carmoney", "cf247"\]\);/,
  );
  assert.match(html, /const isLenderBrokerProduct = \(product\) =>/);
  assert.match(html, /isLenderBrokerProduct\(p\) \? "lender-broker-row" : ""/);
  assert.match(html, /tbody tr\.lender-broker-row \{\s*background-color: #f3ecff;/);
});
