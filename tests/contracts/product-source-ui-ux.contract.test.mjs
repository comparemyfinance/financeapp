import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function readFile(path) {
  return fs.readFileSync(path, 'utf8');
}

const templates = ['tabProductSource.html', 'Index.html'];

for (const file of templates) {
  test(`${file}: lender apply modal has viewport max-height and internally scrolling body`, () => {
    const html = readFile(file);

    assert.match(
      html,
      /(id="lenderAppModal"[\s\S]{0,220}overflow-y-auto|overflow-y-auto[\s\S]{0,220}id="lenderAppModal")/,
      'expected overlay to allow viewport scrolling on smaller screens',
    );
    assert.match(
      html,
      /#lenderAppModal \.lender-app-modal-panel[\s\S]{0,120}max-height: min\(90vh, 860px\);/,
      'expected modal container max-height relative to viewport',
    );
    assert.match(
      html,
      /id="lenderAppValidateBtn"[\s\S]*id="lenderAppPayloadJson"/,
      'expected Validate button to appear before payload content in modal markup',
    );
    assert.match(
      html,
      /lender-app-modal-body[\s\S]*modal-body-scroll[\s\S]*flex-1/,
      'expected body area to scroll internally',
    );
    assert.doesNotMatch(
      html,
      /id="lenderAppSaveBtn"/,
      'expected Save Draft button to be removed from lender apply modal',
    );
  });
}

for (const file of templates) {
  test(`${file}: product source exposes app form shortcut with deal-backed soft-score gating`, () => {
    const html = readFile(file);

    assert.match(
      html,
      /id="app-form-client-btn"/,
      'expected APP FORM shortcut button markup in Product Source results header',
    );
    assert.match(
      html,
      /currentLookupDealId|currentLookupFoundInDeals|softScoreLoaded/,
      'expected Product Source runtime state to track deal-backed soft-score routing',
    );
  });
}

test('Index.html: app form shortcut routes back through delegated sales-pipeline bridge', () => {
  const html = readFile('Index.html');

  assert.match(html, /const appFormBtn = e\.target\.closest\('#app-form-client-btn'\);/);
  assert.match(html, /switchTab\('sales-pipeline-crm'\)/);
  assert.match(html, /App\.ui\.openCustomerModalLocked\(dealId\)/);
  assert.match(html, /No live client application found for this VRN\./);
});

test('lender broker rows use a shared helper and pastel purple class styling', () => {
  const html = readFile('tabProductSource.html');

  assert.match(
    html,
    /const LENDER_BROKER_IDS = new Set\(\["jigsaw", "carmoney", "cf247"\]\);/,
  );
  assert.match(html, /getLenderIdForProduct\(product\)\.replace\(\/\\s\+\/g, ""\)/);
  assert.match(html, /isLenderBrokerProduct\(p\) \? "lender-broker-row" : ""/);
  assert.match(html, /tbody tr\.lender-broker-row \{\s*background-color: #f3ecff;/);
});
