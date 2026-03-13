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
