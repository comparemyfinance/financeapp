/**
 * Lenderapi.gs (placeholder-preparation, Pattern B-lite)
 * ------------------------------------------------------
 * Mirrors the CURRENT UI lender list + defaults and uses the SAME calculation approach
 * as CMF_WHATSAPP_IMPORT_FIXED_v4.html (Product Sourcing):
 *   - balloon = settlementFigure * getBalloonPerc(term, origLoan) * (highlight multiplier)
 *   - monthly = calcMonthly(settlementFigure, term, apr, balloon)
 *   - totalPayable = monthly * term + balloon
 *   - commission = settlementFigure * (commissionPct/100)
 *
 * NOTE: This is placeholder mode only; no live lender calls yet.
 */

function listLenders_() {
  return getLenderDefaults_().map(function(x) {
    return {
      lenderKey: toLenderKey_(x.lender),
      lender: x.lender,
      apr: x.apr,
      commissionPct: x.commissionPct,
      highlight: x.highlight
    };
  });
}

function getLenderQuote(payload) {
  payload = payload || {};
  var lenderKey = String(payload.lenderKey || payload.lender || '').trim();
  var settlementFigure = toNumber_(payload.settlementFigure);
  var remainingTerm = toInt_(payload.remainingTerm);
  var origLoan = toNumber_(payload.origLoan);

  if (!lenderKey) return { success: false, error: "lenderKey required" };
  if (!isFinite(settlementFigure) || settlementFigure <= 0) return { success: false, error: "settlementFigure required" };
  if (!isFinite(remainingTerm) || remainingTerm <= 0) return { success: false, error: "remainingTerm required" };
  if (!isFinite(origLoan) || origLoan <= 0) return { success: false, error: "origLoan required" };

  var defaults = getLenderDefaults_();
  var keyNorm = toLenderKey_(lenderKey);
  var lenderDef = null;
  for (var i = 0; i < defaults.length; i++) {
    if (toLenderKey_(defaults[i].lender) === keyNorm) { lenderDef = defaults[i]; break; }
  }
  if (!lenderDef) {
    // Unknown lender: return a safe placeholder with no overrides
    return {
      success: true,
      lenderKey: keyNorm,
      mode: "placeholder",
      quoteInputs: {},
      quoteOutputs: {},
      reasons: ["unknown_lender_key"],
      raw: {}
    };
  }

  var product = computeProduct_(lenderDef, settlementFigure, remainingTerm, origLoan);

  return {
    success: true,
    lenderKey: toLenderKey_(lenderDef.lender),
    mode: "placeholder",
    quoteInputs: {
      apr: lenderDef.apr,
      commissionPct: lenderDef.commissionPct,
      balloon: product.calculatedBalloonPayment
    },
    quoteOutputs: {
      lender: product.lender,
      term: product.term,
      calculatedMonthlyPayment: product.calculatedMonthlyPayment,
      calculatedBalloonPayment: product.calculatedBalloonPayment,
      calculatedCommission: product.calculatedCommission,
      totalPayable: product.totalPayable
    },
    reasons: [],
    raw: {}
  };
}

function getLenderQuotesBatch(payload) {
  payload = payload || {};
  var settlementFigure = toNumber_(payload.settlementFigure);
  var remainingTerm = toInt_(payload.remainingTerm);
  var origLoan = toNumber_(payload.origLoan);

  if (!isFinite(settlementFigure) || settlementFigure <= 0) return { success: false, error: "settlementFigure required" };
  if (!isFinite(remainingTerm) || remainingTerm <= 0) return { success: false, error: "remainingTerm required" };
  if (!isFinite(origLoan) || origLoan <= 0) return { success: false, error: "origLoan required" };

  var defaults = getLenderDefaults_();
  var products = defaults.map(function(def) {
    return computeProduct_(def, settlementFigure, remainingTerm, origLoan);
  });

  // Mirror UI sort: ascending APR
  products.sort(function(a,b) { return a.apr - b.apr; });

  return {
    success: true,
    mode: "placeholder",
    settlementFigure: settlementFigure,
    remainingTerm: remainingTerm,
    origLoan: origLoan,
    products: products,
    lenders: listLenders_()
  };
}

function computeProduct_(lenderDef, settlementFigure, remainingTerm, origLoan) {
  // Same as UI: base balloon uses settlementFigure and term/origLoan curve
  var baseBalloon = settlementFigure * getBalloonPerc_(remainingTerm, origLoan);

  // Same as UI highlight multipliers
  var v = 1.0;
  if (lenderDef.highlight) {
    if (lenderDef.lender === "Alphera") v = 1.05;
    else if (lenderDef.lender === "Motonovo") v = 0.98;
    else if (lenderDef.lender === "Northridge Finance") v = 1.10;
  }
  var balloon = baseBalloon * v;

  var commission = settlementFigure * (lenderDef.commissionPct / 100);
  var monthly = calcMonthly_(settlementFigure, remainingTerm, lenderDef.apr, balloon);
  var total = (monthly * remainingTerm) + balloon;

  return {
    lenderKey: toLenderKey_(lenderDef.lender),
    lender: lenderDef.lender,
    apr: lenderDef.apr,
    commissionPct: lenderDef.commissionPct,
    term: remainingTerm,
    calculatedMonthlyPayment: monthly,
    calculatedBalloonPayment: balloon,
    calculatedCommission: commission,
    totalPayable: total
  };
}

// === UI-MIRROR CALCS (keep in sync with v4 HTML) ===

function getBalloonPerc_(term, price) {
  term = Math.max(0, toInt_(term));
  price = toNumber_(price);
  if (term <= 0 || !isFinite(price) || price <= 0) return 0;
  var dp = [
    { m: 24, p: 0.5865 },
    { m: 37, p: 0.5352 },
    { m: 49, p: 0.4542 },
    { m: 60, p: 0.3597 }
  ];
  if (term <= dp[0].m) return dp[0].p;
  if (term >= dp[dp.length - 1].m) return dp[dp.length - 1].p;
  var lb = dp[0], ub = dp[dp.length - 1];
  for (var i = 0; i < dp.length - 1; i++) {
    if (term >= dp[i].m && term <= dp[i + 1].m) { lb = dp[i]; ub = dp[i + 1]; break; }
  }
  return lb.p + (term - lb.m) * (ub.p - lb.p) / (ub.m - lb.m);
}

function calcMonthly_(p, t, apr, b) {
  p = toNumber_(p); t = toInt_(t); apr = toNumber_(apr); b = toNumber_(b);
  if (t <= 0) return 0;
  var r = apr / 100 / 12;
  if (r === 0) return (p - b) / t;
  var n = p - (b / Math.pow(1 + r, t));
  var d = (1 - Math.pow(1 + r, -t)) / r;
  return n / d;
}

// === LENDER DEFAULTS (MUST MATCH UI lenderData) ===

function getLenderDefaults_() {
  return [
  {
    "lender": "BNP Paribas Finance",
    "apr": 12.9,
    "commissionPct": 4,
    "highlight": false
  },
  {
    "lender": "Motonovo",
    "apr": 11.9,
    "commissionPct": 4,
    "highlight": true
  },
  {
    "lender": "V12",
    "apr": 15.9,
    "commissionPct": 5,
    "highlight": false
  },
  {
    "lender": "Close Brothers",
    "apr": 12.9,
    "commissionPct": 4.5,
    "highlight": false
  },
  {
    "lender": "Credit Agricole",
    "apr": 14.0,
    "commissionPct": 3,
    "highlight": false
  },
  {
    "lender": "Northridge Finance",
    "apr": 9.9,
    "commissionPct": 3.5,
    "highlight": true
  },
  {
    "lender": "Alphera",
    "apr": 10.9,
    "commissionPct": 4,
    "highlight": true
  },
  {
    "lender": "Zopa",
    "apr": 17.9,
    "commissionPct": 4,
    "highlight": false
  },
  {
    "lender": "Advantage Finance",
    "apr": 31.4,
    "commissionPct": 4,
    "highlight": false
  },
  {
    "lender": "Automoney",
    "apr": 28.0,
    "commissionPct": 4,
    "highlight": false
  },
  {
    "lender": "Moneybarn",
    "apr": 33.7,
    "commissionPct": 2.6,
    "highlight": false
  },
  {
    "lender": "Moneyway",
    "apr": 26.65,
    "commissionPct": 4,
    "highlight": false
  },
  {
    "lender": "Oodle",
    "apr": 23.1,
    "commissionPct": 4,
    "highlight": false
  },
  {
    "lender": "Lendable",
    "apr": 29.8,
    "commissionPct": 4,
    "highlight": false
  },
  {
    "lender": "Startline Finance",
    "apr": 24.3,
    "commissionPct": 4,
    "highlight": false
  },
  {
    "lender": "Tandem",
    "apr": 22.25,
    "commissionPct": 4,
    "highlight": false
  },
  {
    "lender": "Billing Finance",
    "apr": 35.4,
    "commissionPct": 1.3,
    "highlight": false
  }
];
}

// === Helpers ===

function toLenderKey_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function toNumber_(v) {
  var n = Number(v);
  return isFinite(n) ? n : NaN;
}

function toInt_(v) {
  var n = parseInt(v, 10);
  return isFinite(n) ? n : NaN;
}
