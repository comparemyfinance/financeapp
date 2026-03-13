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
    /id="lenderAppModal"[\s\S]*?class="[^"]*overflow-y-auto/,
    'expected overlay to allow viewport scrolling on smaller screens',
  );
  assert.match(
    html,
    /max-h-\[calc\(100vh-2rem\)\]/,
    'expected modal container max-height relative to viewport',
  );
  assert.match(
    html,
    /id="lenderAppValidateBtn"[\s\S]*id="lenderAppPayloadJson"/,
    'expected Validate button to appear before payload content in modal markup',
  );
  assert.match(
    html,
    /modal-content modal-body-scroll flex-1 min-h-0 overflow-y-auto/,
    'expected body area to scroll internally',
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
