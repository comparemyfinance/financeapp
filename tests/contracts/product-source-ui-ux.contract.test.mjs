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
      /lenderAppStatus[\s\S]{0,900}lenderAppValidateBtn|lenderAppValidateBtn[\s\S]{0,900}lenderAppStatus/,
      'expected status area to sit beside or near Validate in modal wiring',
    );
    assert.match(
      html,
      /lender-app-modal-body[\s\S]*modal-body-scroll[\s\S]*flex-1/,
      'expected body area to scroll internally',
    );
    assert.match(
      html,
      /lenderAppStatusMessage[\s\S]{0,200}lenderAppStatusSteps/,
      'expected modal status panel to include message and step log regions',
    );
    assert.match(
      html,
      /renderLenderModalStatus\([\s\S]{0,200}buildLenderModalPendingSteps/,
      'expected Validate flow to render pending status steps',
    );
    assert.match(
      html,
      /Array\.isArray\(res\.steps\) && res\.steps\.length[\s\S]{0,220}res && \(res\.operatorMessage \|\| res\.message/,
      'expected Validate flow to render returned status steps and operator message',
    );
    assert.match(
      html,
      /selectedLender,\s*payload:\s*dealPayload/,
      'expected lender modal Validate flow to pass raw payload to backend normalizer',
    );
    assert.doesNotMatch(
      html,
      /id="lenderAppSaveBtn"/,
      'expected Save Draft button to be removed from lender apply modal',
    );
    assert.match(
      html,
      /const LENDER_MODAL_LOGO_URLS = \{/,
      'expected lender modal logo registry to exist',
    );
    assert.match(
      html,
      /finclusion:[\s\S]*alphera:[\s\S]*jigsaw:[\s\S]*cf247:[\s\S]*motonovo:/,
      'expected lender modal logo registry to include mapped lender entries',
    );
  });
}

for (const file of templates) {
  test(`${file}: product source exposes app form shortcut after pre-qual is attempted`, () => {
    const html = readFile(file);

    assert.match(
      html,
      /id="app-form-client-btn"/,
      'expected APP FORM shortcut button markup in Product Source results header',
    );
    assert.match(
      html,
      /preQualAttempted/,
      'expected Product Source runtime state to track app form visibility after pre-qual is pressed',
    );
    assert.match(
      html,
      /preQualAttempted[\s\S]{0,120}softScoreLoaded|softScoreLoaded[\s\S]{0,120}preQualAttempted/,
      'expected Product Source app form visibility to support pre-qual attempt state with soft-score fallback',
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
