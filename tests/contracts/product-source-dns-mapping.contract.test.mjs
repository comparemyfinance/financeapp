import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const templates = ['Index.html', 'tabProductSource.html'];

const autoMappedFields = [
  'ltr_reference-number',
  'ltr_client-address-street',
  'ltr_client-address-town',
  'ltr_client-address-postcode',
  'ltr_client-email',
  'ltr_employment-summary',
  'ltr_time-in-employment',
  'ltr_net-income-monthly',
  'ltr_current-lender',
  'ltr_current-finance-type',
  'ltr_current-vehicle-price',
  'ltr_current-deposit',
  'ltr_current-apr',
  'ltr_current-term',
  'ltr_current-monthly-payment',
  'ltr_current-balloon',
  'ltr_current-agreement-start-date',
  'ltr_current-payments-made',
  'ltr_new-lender-name',
  'ltr_new-finance-amount',
  'ltr_new-additional-cash',
  'ltr_new-term-type',
  'ltr_new-apr',
  'ltr_new-term',
  'ltr_new-monthly-payment',
  'ltr_new-balloon',
  'ltr_early-repayment-charges-paid',
  'ltr_potential-commission',
];

const manualOnlyFields = [
  'ltr_staff-name',
  'ltr_primary-demand-need',
  'ltr_secondary-demand-need',
  'ltr_client-demands-needs',
  'ltr_how-option-meets-needs',
  'ltr_term-change-choice',
  'ltr_term-extension-reason',
  'ltr_term-extension-reason-other',
  'ltr_term-reduction-reason',
  'ltr_term-reduction-reason-other',
  'ltr_client-specific-choices-rationale',
];

function readFile(path) {
  return fs.readFileSync(path, 'utf8');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertFieldAutoMapped(html, fieldId) {
  assert.match(
    html,
    new RegExp(
      String.raw`set(?:Val|Field|IfExists)\(\s*['"]${escapeRegex(fieldId)}['"]`,
    ),
    `expected ${fieldId} to be auto-written by Product Source mapping`,
  );
}

function assertFieldNotAutoMapped(html, fieldId) {
  assert.doesNotMatch(
    html,
    new RegExp(
      String.raw`set(?:Val|Field|IfExists)\(\s*['"]${escapeRegex(fieldId)}['"]`,
    ),
    `expected ${fieldId} to remain manual-only`,
  );
}

for (const file of templates) {
  test(`${file}: Product Source writes required DNS fields`, () => {
    const html = readFile(file);

    for (const fieldId of autoMappedFields) {
      assertFieldAutoMapped(html, fieldId);
    }
  });

  test(`${file}: Product Source preserves raw-first fallback precedence`, () => {
    const html = readFile(file);

    assert.match(
      html,
      /rawGet\(raw,\s*\[['"]currentAddressLine1['"]\]\)[\s\S]{0,260}dp\.client\.address && dp\.client\.address\.address1/,
      'expected raw currentAddressLine1 to fall back to client address line 1',
    );
    assert.match(
      html,
      /rawGet\(raw,\s*\[['"]currentCity['"]\]\)[\s\S]{0,120}dp\.client\.address && dp\.client\.address\.town/,
      'expected raw currentCity to fall back to client town',
    );
    assert.match(
      html,
      /rawGet\(raw,\s*\[['"]currentPostcode['"]\]\)[\s\S]{0,160}dp\.client\.postcode[\s\S]{0,120}dp\.client\.address && dp\.client\.address\.postcode/,
      'expected raw currentPostcode to fall back to client postcode fields',
    );
    assert.match(
      html,
      /rawGet\(raw,\s*\[['"]id['"],\s*['"]ID['"],\s*['"]Id['"],\s*['"]dealId['"],\s*['"]dealID['"],\s*['"]DealId['"]\]\)\s*\|\|[\s\S]{0,160}dp\.id[\s\S]{0,120}dp\.dealID[\s\S]{0,120}getActiveDealId\(\)/,
      'expected reference number precedence to be raw id, payload id, then active deal id fallback',
    );
    assert.match(
      html,
      /setVal\(\s*['"]ltr_client-address-street['"][\s\S]{0,80}addressStreet[\s\S]{0,20}\)/,
      'expected late client street mapping to preserve the resolved raw->fallback value',
    );
    assert.match(
      html,
      /setVal\(\s*['"]ltr_client-address-town['"][\s\S]{0,80}addressTown[\s\S]{0,20}\)/,
      'expected late client town mapping to preserve the resolved raw->fallback value',
    );
    assert.match(
      html,
      /setVal\(\s*['"]ltr_client-address-postcode['"][\s\S]{0,80}addressPostcode[\s\S]{0,20}\)/,
      'expected late client postcode mapping to preserve the resolved raw->fallback value',
    );
  });

  test(`${file}: Product Source leaves manual-only DNS fields untouched`, () => {
    const html = readFile(file);

    for (const fieldId of manualOnlyFields) {
      assertFieldNotAutoMapped(html, fieldId);
    }
  });

  test(`${file}: Product Source preview renders mapped DNS data`, () => {
    const html = readFile(file);

    assert.match(
      html,
      /\$\{d\.refNum\}/,
      'expected preview to render the mapped reference number',
    );
    assert.match(
      html,
      /illustrativeDate/,
      'expected preview to keep illustrative date support',
    );
    assert.match(
      html,
      /currentRemainingTerm/,
      'expected preview to keep remaining-term wording support',
    );
    assert.match(
      html,
      /clientAddrHtml/,
      'expected preview to render split address HTML',
    );
    assert.doesNotMatch(
      html,
      /lastName_currentPostcode/,
      'expected preview to stop using the old placeholder reference number',
    );
    assert.match(
      html,
      /const hasSelectedProductComparison[\s\S]{0,200}illData && illData\.newMonthlyPayment[\s\S]{0,120}illData && illData\.newTerm/,
      'expected preview comparison block to require selected-product fields before calculating savings',
    );
    assert.doesNotMatch(
      html,
      /if\s*\(\s*illData\s*&&\s*Object\.keys\(illData\)\.length\s*>\s*0\s*\)/,
      'expected preview to stop treating any non-empty illustration object as a complete comparison',
    );
  });
}
