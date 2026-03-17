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
